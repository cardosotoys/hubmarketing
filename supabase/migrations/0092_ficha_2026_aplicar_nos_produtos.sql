-- Cardoso Hub — aplica a FICHA TECNICA 2026 (arquivo -2) no cadastro do produto.
-- Depende da 0090 (colunas) e da 0091 (carga da tabela de apoio). Idempotente.
--
-- Por que existe: a 0089 ja trouxe esta mesma planilha, mas gravou em name a
-- versao em CAIXA ALTA e deixou line com valores de outra origem (inclusive
-- "SOLAPAS", que e tipo de embalagem e nao linha). Quem manda no nome e a
-- coluna NOME DO PRODUTO ATUAL - CADASTRO, e a linha sai de LINHA (PLAYMI) ou,
-- quando vazia, de CATEGORIA (TOPI).
--
-- Duas correcoes mecanicas sobre a planilha, ambas conferidas uma a uma:
--   1. espaco repetido vira espaco simples — a planilha tem "Caminho  Air Truck"
--      e "Caixa  Individual" em 3 produtos;
--   2. "PLAY&LEAR" vira "PLAY&LEARN" — erro de digitacao da coluna LINHA em 6
--      produtos da familia Fofush.
-- Sem as duas, 9 produtos sairiam diferentes do que o comercial ve hoje.
--
-- No fim ha uma trava: se o resultado nao bater produto a produto com o que o
-- CRM mostra hoje, a migration levanta excecao e nada e gravado.

set lock_timeout = '5s';

begin;

with n as (
  select
    s.ref,
    btrim(regexp_replace(s.cadastro,       '\s+', ' ', 'g')) as cadastro,
    btrim(regexp_replace(s.nome_antigo,    '\s+', ' ', 'g')) as nome_antigo,
    btrim(regexp_replace(s.nome_embalagem, '\s+', ' ', 'g')) as nome_embalagem,
    btrim(regexp_replace(s.sub_categoria,  '\s+', ' ', 'g')) as sub_categoria,
    btrim(regexp_replace(s.nome_tecnico,   '\s+', ' ', 'g')) as nome_tecnico,
    btrim(regexp_replace(s.idade,          '\s+', ' ', 'g')) as idade,
    btrim(s.ean) as ean,
    case
      when btrim(coalesce(nullif(s.linha,''), s.categoria)) = 'PLAY&LEAR' then 'PLAY&LEARN'
      else btrim(regexp_replace(coalesce(nullif(s.linha,''), s.categoria), '\s+', ' ', 'g'))
    end as linha
  from public.ficha_2026_stage s
)
update public.products p set
  name           = n.cadastro,
  previous_name  = n.nome_antigo,
  packaging_name = n.nome_embalagem,
  sub_category   = n.sub_categoria,
  line           = n.linha,
  technical_name = case when n.nome_tecnico <> '' then n.nome_tecnico else p.technical_name end,
  age_range      = case when n.idade        <> '' then n.idade        else p.age_range      end,
  ean            = case when n.ean          <> '' then n.ean          else p.ean            end
from n
where n.ref = regexp_replace(split_part(p.code, ' - ', 1), '^0+', '');

-- Trava: o que o comercial ve hoje no CRM tem que continuar igual.
do $$
declare
  n_nome int;
  n_linha int;
  n_orfao int;
begin
  select count(*) into n_orfao
    from public.products p
   where not exists (
     select 1 from public.ficha_2026_stage s
      where s.ref = regexp_replace(split_part(p.code, ' - ', 1), '^0+', ''));
  if n_orfao > 0 then
    raise exception 'ABORTADO: % produto(s) do Hub sem linha correspondente na ficha', n_orfao;
  end if;

  select count(*) into n_nome
    from public.products p join crm.produtos c on c.codigo = p.code
   where p.name <> c.nome;
  select count(*) into n_linha
    from public.products p join crm.produtos c on c.codigo = p.code
   where p.line <> c.linha_comercial;

  if n_nome > 0 or n_linha > 0 then
    raise exception 'ABORTADO: % nome(s) e % linha(s) sairiam diferentes do que o CRM mostra hoje', n_nome, n_linha;
  end if;
end $$;

commit;
