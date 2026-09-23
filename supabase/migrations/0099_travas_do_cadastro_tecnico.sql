-- Cardoso Marketing Hub — o banco passa a recusar dado técnico impossível
-- Roda depois de 0001..0098. Idempotente.
--
-- Por que: a calculadora impede o erro de quem usa a calculadora. Quem edita
-- pelo Table Editor do Supabase, por importação ou por qualquer caminho futuro
-- continua podendo gravar a letra X num código de barras. Estas travas moram no
-- banco, então valem para todo mundo e para sempre.
--
-- COMO ELAS TRATAM O PASSIVO: todas entram como NOT VALID. Isso significa que
-- o Postgres passa a recusar violação em linha NOVA ou EDITADA, mas não varre
-- as 315 linhas existentes nem reprova o deploy. Os 391 apontamentos da
-- auditoria continuam lá, quietos, até serem confirmados um a um.
--
-- EFEITO COLATERAL QUE VOCÊ PRECISA SABER: ao editar QUALQUER campo de um
-- produto que hoje viola uma destas regras, o salvamento vai falhar até que a
-- violação seja corrigida. São 6 produtos no caso dos códigos de barras
-- (2010, 2011, 3052, 7151, 7152, 7201). Isso é proposital: quem encosta no
-- registro, arruma. Se atrapalhar antes da hora, o fim do arquivo tem o
-- comando para soltar cada trava.
--
-- O QUE NÃO ESTÁ AQUI, DE PROPÓSITO: unicidade de EAN e coerência entre volume
-- e medidas. As duas dependem de resposta que ainda não veio — se os quatro
-- Robô-Blocks forem um sortido, o EAN repetido está certo; e se o volume que a
-- Engenharia informa for cubagem contratada e não medida externa, a divergência
-- tem explicação. Travar antes da resposta seria cravar uma suposição.

set lock_timeout = '5s';

begin;

-- ---------------------------------------------- 1) dígito verificador GS1
-- Algoritmo módulo 10 das GS1 General Specifications, o mesmo para GTIN-8, 12,
-- 13 e 14: pesos 3 e 1 alternados da direita do corpo para a esquerda.
-- Conferido contra o catálogo: aprova 578 códigos e reprova 6 — exatamente os
-- que a auditoria já apontava por outros dois caminhos independentes.
create or replace function public.gtin_valido(codigo text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  d text;
  n int;
  i int;
  peso int;
  soma int := 0;
begin
  d := regexp_replace(coalesce(codigo, ''), '\D', '', 'g');
  if d = '' then
    return true;                -- em branco é ausência de dado, não erro de dado
  end if;
  n := length(d);
  if n not in (8, 12, 13, 14) then
    return false;
  end if;
  for i in 1 .. n - 1 loop
    peso := case when (n - 1 - i) % 2 = 0 then 3 else 1 end;
    soma := soma + substr(d, i, 1)::int * peso;
  end loop;
  return ((10 - soma % 10) % 10) = substr(d, n, 1)::int;
end;
$$;

comment on function public.gtin_valido(text) is
  'true se o código passa no dígito verificador GS1 (módulo 10). Texto vazio é aceito: ausência de código não é código errado.';

-- ---------------------------------------------- 2) as travas
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('products_ean_valido',
       'ean = '''' or public.gtin_valido(ean)'),
      ('products_dun_valido',
       'dun = '''' or public.gtin_valido(dun)'),
      -- o X da planilha e o .0 do Excel nunca mais entram como se fossem código
      ('products_dun_formato',
       'dun = '''' or dun ~ ''^[0-9]{8,14}([ -]?[0-9])?$'''),
      ('products_quantidade_positiva',
       'carton_quantity is null or carton_quantity > 0'),
      ('products_pesos_nao_negativos',
       'coalesce(product_weight_kg, 0) >= 0 and coalesce(package_weight_kg, 0) >= 0 '
       'and coalesce(carton_gross_weight_kg, 0) >= 0'),
      ('products_medidas_nao_negativas',
       'coalesce(product_length_mm, 0) >= 0 and coalesce(product_width_mm, 0) >= 0 '
       'and coalesce(product_height_mm, 0) >= 0 and coalesce(package_length_mm, 0) >= 0 '
       'and coalesce(package_width_mm, 0) >= 0 and coalesce(package_height_mm, 0) >= 0 '
       'and coalesce(carton_length_mm, 0) >= 0 and coalesce(carton_width_mm, 0) >= 0 '
       'and coalesce(carton_height_mm, 0) >= 0')
    ) as v(nome, regra)
  loop
    if not exists (select 1 from pg_constraint where conname = t.nome) then
      execute format('alter table public.products add constraint %I check (%s) not valid', t.nome, t.regra);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------- 3) o selo de completude
-- Não trava nada: só responde, por produto, o que ainda falta para ele poder
-- ser cotado. É leitura pura, então pode entrar na tela do Banco de Produtos
-- como uma coluna de status sem risco nenhum.
create or replace view public.produto_completude as
with base as (
  select
    p.id,
    p.code,
    p.name,
    array_remove(array[
      case when coalesce(p.carton_length_mm, 0) = 0
             or coalesce(p.carton_width_mm, 0) = 0
             or coalesce(p.carton_height_mm, 0) = 0 then 'medidas da caixa master' end,
      case when coalesce(p.carton_gross_weight_kg, 0) = 0 then 'peso bruto da caixa' end,
      case when coalesce(p.carton_quantity, 0) = 0     then 'unidades por caixa' end,
      case when coalesce(p.pallet_layer_pattern, '') = '' then 'lastro' end,
      case when coalesce(p.pallet_height_m, 0) = 0     then 'altura do pallet' end
    ], null) as falta_frete,
    array_remove(array[
      case when coalesce(p.ean, '') = ''            then 'EAN' end,
      case when coalesce(p.dun, '') = ''
             or not public.gtin_valido(p.dun)       then 'DUN utilizável' end,
      case when coalesce(p.ncm, '') = ''            then 'NCM' end,
      case when coalesce(p.inmetro_number, '') = '' then 'nº INMETRO' end,
      case when coalesce(p.package_length_mm, 0) = 0 then 'medidas da embalagem' end,
      case when coalesce(p.package_weight_kg, 0) = 0 then 'peso da embalagem' end
    ], null) as falta_varejo
  from public.products p
)
select
  id,
  code,
  name,
  cardinality(falta_frete)  = 0 as pronto_para_frete,
  cardinality(falta_varejo) = 0 as pronto_para_varejo,
  falta_frete,
  falta_varejo,
  cardinality(falta_frete) + cardinality(falta_varejo) as pendencias
from base;

comment on view public.produto_completude is
  'O que falta em cada produto para ele poder ser cotado: frete (cubagem e paletização) e varejo (fiscal e identificação). Só leitura — não trava nada.';

grant select on public.produto_completude to authenticated;

commit;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------- desfazer
-- Se alguma trava atrapalhar antes da hora, solte só ela:
--   alter table public.products drop constraint products_ean_valido;
--   alter table public.products drop constraint products_dun_valido;
--   alter table public.products drop constraint products_dun_formato;
--
-- E quando o passivo estiver limpo, promova a trava a definitiva — o comando
-- varre as linhas existentes e só passa se todas estiverem certas:
--   alter table public.products validate constraint products_ean_valido;
