-- Cardoso Black: pedido manual pela equipe.
-- Quem opera a Black no Hub entra na página de pedido como um cliente aprovado e faz o pedido por ele,
-- com as mesmas regras do cliente (mínimo, limite 0300/0301, estoque e reserva).
-- Pode rodar de novo sem apagar nada.

create or replace function public.black_entrar_como(p_inscrito uuid)
returns json language plpgsql security definer set search_path = public, extensions
as $fn$
declare v_token text;
begin
  if not public.black_staff() then raise exception 'sem permissão'; end if;
  if not exists (select 1 from public.black_inscritos where id = p_inscrito and status = 'aprovado' and origem <> 'previa') then
    return json_build_object('erro', 'O cadastro precisa estar aprovado.');
  end if;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into public.black_sessoes (token, inscrito_id, expira_em) values (v_token, p_inscrito, now() + interval '3 hours');
  return json_build_object('token', v_token);
end
$fn$;
revoke all on function public.black_entrar_como(uuid) from public, anon;
grant execute on function public.black_entrar_como(uuid) to authenticated;
