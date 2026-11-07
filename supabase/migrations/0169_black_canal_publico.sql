-- Cardoso Black: o canal do WhatsApp é público; o link vai para todo mundo que envia o pré-cadastro
-- (aprovado ou em análise), para a loja já seguir o canal e receber o link da live por lá.
create or replace function public.black_config_publica()
returns json language sql stable security definer set search_path = public
as $fn$
  select json_build_object(
    'inscricoes_ate', inscricoes_ate, 'abre_em', abre_em, 'fecha_em', fecha_em,
    'pedido_minimo', pedido_minimo, 'frete_gratis_sp_rj', frete_gratis_sp_rj, 'live_data', live_data, 'ipi_pct', ipi_pct, 'canal_link', canal_link,
    'agora', now(), 'aberto', now() between abre_em and fecha_em, 'encerrado', now() > fecha_em)
  from public.black_config where id = 1;
$fn$;
