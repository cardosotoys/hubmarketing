-- Cardoso Black: "Ver como cliente" por estado.
-- A equipe escolhe a UF e entra na página de pedido como uma loja de demonstração daquele estado,
-- vendo os preços exatamente como o lojista da região vê (SP, −6% ou −9%).
-- Cada UF tem a sua loja de demonstração (origem 'previa'): fica fora das listas, não reserva estoque e não envia pedido.
-- SP continua com o CNPJ 00000000000000 de sempre. Pode rodar de novo.
begin;

drop function if exists public.black_previa_entrar();

create or replace function public.black_previa_entrar(p_uf text default 'SP')
returns json language plpgsql security definer set search_path = public, extensions
as $fn$
declare
  ufs constant text[] := array['SP','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SE','TO'];
  v_uf text := upper(trim(coalesce(p_uf, 'SP')));
  v_i int; v_cnpj text; v_id uuid; v_token text;
begin
  if not public.black_staff() then raise exception 'sem permissão'; end if;
  v_i := array_position(ufs, v_uf);
  if v_i is null then raise exception 'UF inválida: %', v_uf; end if;
  v_cnpj := case when v_uf = 'SP' then '00000000000000' else '000000000000' || lpad((v_i - 1)::text, 2, '0') end;
  insert into public.black_inscritos (cnpj, razao_social, fantasia, cidade, uf, representante, comprador, email, celular,
                                      canais, status, origem, alertas, motivo)
  values (v_cnpj, 'LOJA DE DEMONSTRAÇÃO', 'Prévia da equipe · ' || v_uf, '', v_uf, 'Equipe Cardoso',
          'Equipe Cardoso', 'previa@cardosotoys.com.br', '(11) 00000-0000', '{}', 'aprovado', 'previa', '{}', 'prévia interna')
  on conflict (cnpj) do update set status = 'aprovado', origem = 'previa', uf = excluded.uf, fantasia = excluded.fantasia
  returning id into v_id;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.black_sessoes (token, inscrito_id, expira_em) values (v_token, v_id, now() + interval '12 hours');
  return json_build_object('token', v_token, 'uf', v_uf);
end
$fn$;
revoke all on function public.black_previa_entrar(text) from public, anon;
grant execute on function public.black_previa_entrar(text) to authenticated;

commit;
