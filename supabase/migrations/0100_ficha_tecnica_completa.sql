-- Cardoso Marketing Hub — os dados técnicos que não tinham onde morar
-- Roda depois de 0001..0099. Idempotente e aditivo: nenhuma coluna existente muda
-- de tipo, nenhum dado é apagado, e o que já está no ar continua funcionando igual.
--
-- É o Anexo B da auditoria virando schema: 19 dados que hoje vivem em planilha,
-- e-mail ou na cabeça de alguém, e por isso não chegam a quem cota.
--
-- ONDE CADA COISA FOI PARAR, E POR QUÊ
--
--   public.products            o que é físico e universal — serve aos quatro tipos
--                              de cotação ao mesmo tempo (frete, varejo, gráfica,
--                              fornecedor). Fica no cadastro central.
--   product_logistics   (1:1)  palete, empilhamento e container: muitos campos,
--                              um assunto só, consultados juntos.
--   product_packaging_spec (1:N) a especificação gráfica de CADA peça de embalagem
--                              (um produto pode ter caixinha + display + blister).
--   product_sourcing    (1:1)  fornecedor, MOQ, incoterm e preço. Leitura restrita:
--                              preço de compra não é dado de time inteiro.
--
-- A FRONTEIRA COM O MÓDULO DE DESENVOLVIMENTO (0037)
--
-- public.product_dev_packaging já existe e continua como está. Ela é do produto em
-- PROJETO: guarda estado de processo (arte aprovada? rotulagem validada? teste de
-- proteção?) e morre quando o projeto termina. O que entra aqui é a especificação
-- VIGENTE do produto que já está no catálogo — os 315 nunca passaram pelo módulo de
-- desenvolvimento, e a ficha deles precisa existir independente dele.
-- Para não haver dúvida de origem, product_packaging_spec carrega a referência à
-- linha de desenvolvimento que a originou, quando houver. Nada é duplicado: o dado
-- desce do projeto para a ficha quando o produto nasce.

set lock_timeout = '5s';

begin;

-- ======================================================== 1) o cadastro central
alter table public.products
  add column if not exists carton_tare_kg numeric(10, 3),
  add column if not exists carton_net_weight_kg numeric(10, 3),
  add column if not exists package_type text not null default '',
  add column if not exists pallet_boxes_per_layer integer,
  add column if not exists pallet_layers integer;

comment on column public.products.carton_tare_kg is
  'Peso da caixa master vazia. Bruto − tara = líquido.';
comment on column public.products.carton_net_weight_kg is
  'Peso líquido da caixa master. A nota fiscal e o frete pedem os dois, e hoje só existia o bruto.';
comment on column public.products.package_type is
  'Formato da embalagem individual: caixa, blister, sacola, display, cinta. Vazio = ainda não classificado.';
comment on column public.products.pallet_boxes_per_layer is
  'Caixas em cada camada do pallet — o A do lastro "AxB".';
comment on column public.products.pallet_layers is
  'Quantidade de camadas — o B do lastro "AxB".';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_package_type_check') then
    alter table public.products add constraint products_package_type_check
      check (package_type in ('', 'caixa', 'blister', 'sacola', 'display', 'cinta', 'bandeja', 'outro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_liquido_ate_bruto') then
    alter table public.products add constraint products_liquido_ate_bruto
      check (carton_net_weight_kg is null or carton_gross_weight_kg is null
             or carton_net_weight_kg <= carton_gross_weight_kg);
  end if;
end
$$;

-- Estes dois NÃO se digitam: o Postgres calcula e nunca deixa divergir. É o que
-- resolve, de vez, o campo "Unidades totais" que respondia outra pergunta.
alter table public.products
  add column if not exists cartons_per_pallet integer
    generated always as (pallet_boxes_per_layer * pallet_layers) stored,
  add column if not exists units_per_pallet integer
    generated always as (pallet_boxes_per_layer * pallet_layers * carton_quantity) stored;

comment on column public.products.cartons_per_pallet is
  'Calculado pelo banco: caixas por camada × camadas. Não editável.';
comment on column public.products.units_per_pallet is
  'Calculado pelo banco: caixas no pallet × unidades por caixa. É a resposta que o comprador pede — e que o antigo pallet_total_units, apesar do rótulo "Unidades totais", NÃO dava: lá são caixas.';

-- ======================================================== 2) logística
create table if not exists public.product_logistics (
  product_id uuid primary key references public.products (id) on delete cascade,
  pallet_type text not null default '',
  pallet_length_mm integer,
  pallet_width_mm integer,
  pallet_base_height_mm integer,
  stackable boolean,
  max_stack integer,
  cartons_per_20ft integer,
  cartons_per_40ft integer,
  cartons_per_40hq integer,
  notes text not null default '',
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

comment on table public.product_logistics is
  'Como o produto viaja: palete, empilhamento e container. Um registro por produto.';
comment on column public.product_logistics.pallet_base_height_mm is
  'Altura da base de madeira. A auditoria não conseguiu cravar o valor do catálogo — 120 mm fecha em 214 produtos e o PBR de 145 mm em 195 — então é campo, não constante.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_logistics_pallet_type_check') then
    alter table public.product_logistics add constraint product_logistics_pallet_type_check
      check (pallet_type in ('', 'pbr', 'euro', 'descartavel', 'outro'));
  end if;
end
$$;

-- ======================================================== 3) especificação gráfica
create table if not exists public.product_packaging_spec (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  piece text not null default 'individual',
  material text not null default '',
  flute text not null default '',
  grammage_g_m2 integer,
  flat_length_mm integer,
  flat_width_mm integer,
  print_colors text not null default '',
  finish text not null default '',
  die_line_asset_id uuid,
  supplier_note text not null default '',
  from_dev_packaging_id uuid references public.product_dev_packaging (id) on delete set null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (product_id, piece)
);
create index if not exists product_packaging_spec_produto on public.product_packaging_spec (product_id);

comment on table public.product_packaging_spec is
  'O que a gráfica precisa para cotar, por peça de embalagem. Um produto pode ter caixinha, display e blister ao mesmo tempo — daí uma linha por peça.';
comment on column public.product_packaging_spec.flat_length_mm is
  'Medida planificada: o tamanho da chapa antes de dobrar. É isso que a gráfica cota, não a caixa montada.';
comment on column public.product_packaging_spec.die_line_asset_id is
  'A faca fica guardada como id de ativo da Biblioteca, nunca como URL — mesmo princípio do espelho do Drive.';
comment on column public.product_packaging_spec.from_dev_packaging_id is
  'De qual linha do módulo de Desenvolvimento esta especificação desceu, quando veio de lá. Serve de rastro, não de cópia.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_packaging_spec_piece_check') then
    alter table public.product_packaging_spec add constraint product_packaging_spec_piece_check
      check (piece in ('individual', 'master', 'display', 'blister', 'cinta', 'encarte', 'berco'));
  end if;
  -- a faca só ganha chave estrangeira se o espelho do Drive (0098) já tiver rodado
  if to_regclass('public.library_assets') is not null
     and not exists (select 1 from pg_constraint where conname = 'product_packaging_spec_die_line_fk') then
    alter table public.product_packaging_spec
      add constraint product_packaging_spec_die_line_fk
      foreign key (die_line_asset_id) references public.library_assets (id) on delete set null;
  end if;
end
$$;

-- ======================================================== 4) fornecedor (restrito)
create table if not exists public.product_sourcing (
  product_id uuid primary key references public.products (id) on delete cascade,
  origin text not null default '',
  supplier_name text not null default '',
  supplier_country text not null default '',
  moq integer,
  moq_unit text not null default 'pecas',
  lead_time_days integer,
  incoterm text not null default '',
  currency text not null default 'BRL',
  target_price numeric(12, 2),
  last_quoted_price numeric(12, 2),
  last_quoted_at date,
  notes text not null default '',
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

comment on table public.product_sourcing is
  'De onde o produto vem e em que condição. Tabela separada porque preço de compra não é dado de time inteiro: a leitura é restrita.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_sourcing_origin_check') then
    alter table public.product_sourcing add constraint product_sourcing_origin_check
      check (origin in ('', 'nacional', 'importado'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_sourcing_incoterm_check') then
    alter table public.product_sourcing add constraint product_sourcing_incoterm_check
      check (incoterm in ('', 'EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'));
  end if;
end
$$;

-- ======================================================== 5) o lastro vira número
-- Só migra o que é consistente: 256 produtos em que o lastro "AxB" bate com o
-- pallet_total_units gravado. Os 16 divergentes e os 43 sem lastro ficam nulos
-- de propósito — entram pela revisão, não por suposição.
update public.products p
   set pallet_boxes_per_layer = split_part(upper(trim(p.pallet_layer_pattern)), 'X', 1)::int,
       pallet_layers          = split_part(upper(trim(p.pallet_layer_pattern)), 'X', 2)::int
 where p.pallet_boxes_per_layer is null
   and p.pallet_layer_pattern ~ '^\s*\d+\s*[Xx]\s*\d+\s*$'
   and p.pallet_total_units is not null
   and split_part(upper(trim(p.pallet_layer_pattern)), 'X', 1)::int
     * split_part(upper(trim(p.pallet_layer_pattern)), 'X', 2)::int = p.pallet_total_units;

-- Peso líquido, onde a tara já for conhecida por diferença não dá para inventar:
-- fica nulo até alguém informar a tara. Nada é deduzido aqui.

do $$
declare n int;
begin
  select count(*) into n from public.products where pallet_boxes_per_layer is not null;
  raise notice 'lastro convertido em número em % produtos', n;
end
$$;

-- ======================================================== 6) quem lê e quem escreve
alter table public.product_logistics enable row level security;
drop policy if exists "product_logistics_select" on public.product_logistics;
create policy "product_logistics_select" on public.product_logistics
  for select to authenticated using (true);
drop policy if exists "product_logistics_write" on public.product_logistics;
create policy "product_logistics_write" on public.product_logistics
  for all to authenticated using (not public.is_assistente()) with check (not public.is_assistente());

alter table public.product_packaging_spec enable row level security;
drop policy if exists "product_packaging_spec_select" on public.product_packaging_spec;
create policy "product_packaging_spec_select" on public.product_packaging_spec
  for select to authenticated using (true);
drop policy if exists "product_packaging_spec_write" on public.product_packaging_spec;
create policy "product_packaging_spec_write" on public.product_packaging_spec
  for all to authenticated using (not public.is_assistente()) with check (not public.is_assistente());

-- Fornecedor e preço: só diretoria e administrador, leitura inclusive.
alter table public.product_sourcing enable row level security;
drop policy if exists "product_sourcing_select" on public.product_sourcing;
create policy "product_sourcing_select" on public.product_sourcing
  for select to authenticated using (public.is_privileged());
drop policy if exists "product_sourcing_write" on public.product_sourcing;
create policy "product_sourcing_write" on public.product_sourcing
  for all to authenticated using (public.is_privileged()) with check (public.is_privileged());

grant select, insert, update, delete on public.product_logistics to authenticated;
grant select, insert, update, delete on public.product_packaging_spec to authenticated;
grant select, insert, update, delete on public.product_sourcing to authenticated;

commit;

notify pgrst, 'reload schema';
