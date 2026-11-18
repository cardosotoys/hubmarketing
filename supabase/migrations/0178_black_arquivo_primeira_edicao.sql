-- Cardoso Black: guarda a 1ª edição (e-commerce, 12–13/11/2026) e libera as tabelas para a Black Varejo.
-- Tudo da 1ª edição é COPIADO para tabelas black_arq_* (com a coluna edicao = 'ecommerce-nov26')
-- e só depois apagado das tabelas da operação. A loja de demonstração (origem 'previa') fica.
-- Não mexe em: carteira de clientes, produtos (a lista nova entra à parte), funções e telas.
-- Pode rodar de novo: se a 1ª edição já estiver no arquivo, não faz nada.

begin;

do $do$
declare
  v_ed constant text := 'ecommerce-nov26';
  t text;
  v_ja boolean;
  n_ped int; n_it int; n_ins int;
begin
  if to_regclass('public.black_arq_pedidos') is not null then
    execute 'select exists (select 1 from public.black_arq_pedidos where edicao = $1)' into v_ja using v_ed;
    if v_ja then
      raise notice 'A edição % já está no arquivo; nada a fazer.', v_ed;
      return;
    end if;
  end if;

  -- 1) cópias (estrutura + dados), cada uma com a coluna edicao na frente
  foreach t in array array['black_inscritos','black_credenciais','black_sessoes','black_pedidos','black_pedido_itens',
                           'black_carrinhos','black_carrinho_eventos','black_eventos','black_acessos','black_produtos','black_config'] loop
    execute format('create table if not exists public.%I as select %L::text as edicao, x.* from public.%I x where false',
                   replace(t, 'black_', 'black_arq_'), v_ed, t);
  end loop;

  insert into public.black_arq_inscritos select v_ed, x.* from public.black_inscritos x where x.origem <> 'previa';
  insert into public.black_arq_credenciais select v_ed, c.* from public.black_credenciais c
    join public.black_inscritos i on i.id = c.inscrito_id where i.origem <> 'previa';
  insert into public.black_arq_sessoes select v_ed, s.* from public.black_sessoes s
    join public.black_inscritos i on i.id = s.inscrito_id where i.origem <> 'previa';
  insert into public.black_arq_pedidos select v_ed, x.* from public.black_pedidos x;
  insert into public.black_arq_pedido_itens select v_ed, x.* from public.black_pedido_itens x;
  insert into public.black_arq_carrinhos select v_ed, x.* from public.black_carrinhos x;
  insert into public.black_arq_carrinho_eventos select v_ed, x.* from public.black_carrinho_eventos x;
  insert into public.black_arq_eventos select v_ed, x.* from public.black_eventos x;
  insert into public.black_arq_acessos select v_ed, x.* from public.black_acessos x;
  insert into public.black_arq_produtos select v_ed, x.* from public.black_produtos x;
  insert into public.black_arq_config select v_ed, x.* from public.black_config x;

  -- 2) só a equipe lê o arquivo
  foreach t in array array['black_arq_inscritos','black_arq_credenciais','black_arq_sessoes','black_arq_pedidos','black_arq_pedido_itens',
                           'black_arq_carrinhos','black_arq_carrinho_eventos','black_arq_eventos','black_arq_acessos','black_arq_produtos','black_arq_config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.black_staff())', t || '_staff', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;

  -- 3) confere que a cópia está inteira antes de apagar
  if (select count(*) from public.black_arq_pedidos where edicao = v_ed) <> (select count(*) from public.black_pedidos)
     or (select count(*) from public.black_arq_pedido_itens where edicao = v_ed) <> (select count(*) from public.black_pedido_itens)
     or (select count(*) from public.black_arq_inscritos where edicao = v_ed) <> (select count(*) from public.black_inscritos where origem <> 'previa') then
    raise exception 'Cópia incompleta: nada foi apagado.';
  end if;

  -- 4) limpa a operação para a nova Black (a ordem respeita as chaves)
  delete from public.black_carrinho_eventos;
  delete from public.black_carrinhos;
  delete from public.black_eventos;
  delete from public.black_pedido_itens;
  delete from public.black_pedidos;
  delete from public.black_acessos;
  delete from public.black_inscritos where origem <> 'previa';   -- credenciais e sessões saem junto

  raise notice 'Edição % arquivada.', v_ed;
end
$do$;

-- 5) datas e textos da Black Varejo (dá para mudar depois em Cardoso Black → Ajustes)
update public.black_config set
  inscricoes_ate = '2026-11-23 18:00:00-03',
  abre_em        = '2026-11-24 10:00:00-03',
  fecha_em       = '2026-11-26 10:00:00-03',
  live_data      = 'Terça-feira, 24/11 · 10h',
  presentes_live = 0,
  canal_link     = '',             -- o link do canal novo entra nos Ajustes assim que ele for criado
  atualizado_em  = now()
where id = 1;

commit;
