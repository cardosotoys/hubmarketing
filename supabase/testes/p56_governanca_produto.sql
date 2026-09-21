-- P5.6 — quem pode mexer no catalogo central. Somente leitura de verdade:
-- cada tentativa de escrita roda dentro de um bloco que se desfaz sozinho
-- (grava e levanta ZZ999 de proposito, entao a subtransacao volta atras).
-- Nenhuma linha de public.products muda por causa deste arquivo.
--
-- Faz o papel de cada pessoa do cadastro com set local role + claim de JWT,
-- que e exatamente o caminho que o PostgREST usa.

do $$
declare
  r          record;
  deve       boolean;
  leu        integer;
  editou     boolean;
  inseriu    boolean;
  excluiu    boolean;
  marca        uuid;
  codigo_ok    text;   -- qualquer produto, para ler e editar
  codigo_livre text;   -- produto sem vinculo comercial, para o teste de exclusao
  codigo_preso text;   -- produto JA ligado a um lead: a FK tem que barrar todo mundo
  barrou_preso boolean;
  passou     int := 0;
  falhou     int := 0;
  linha      text;
  detalhe    text := '';
begin
  select id into marca from public.brands limit 1;
  select code into codigo_ok from public.products order by code limit 1;

  -- Exclusao so faz sentido num produto que ninguem esta usando: a FK
  -- lead_produtos -> products(code) e ON DELETE RESTRICT de proposito, entao um
  -- produto vendido nao sai nem para a diretoria. Isso e testado a parte.
  select p.code into codigo_livre from public.products p
   where not exists (select 1 from crm.lead_produtos lp where lp.produto_codigo = p.code)
     and not exists (select 1 from crm.vitrine_eventos ev where ev.produto_codigo = p.code)
   order by p.code limit 1;
  select lp.produto_codigo into codigo_preso from crm.lead_produtos lp limit 1;

  for r in
    select p.id, p.role, p.department, p.can_edit_products,
           (p.role in ('diretoria','administrador') or p.can_edit_products) as autorizado
      from public.profiles p order by p.role, p.department, p.id
  loop
    deve := r.autorizado;

    execute format('set local role authenticated');
    perform set_config('request.jwt.claims',
      json_build_object('sub', r.id::text, 'role', 'authenticated')::text, true);

    -- LEITURA: todo mundo tem que conseguir
    begin
      select count(*) into leu from public.products;
    exception when others then leu := -1;
    end;

    -- EDICAO
    begin
      update public.products set description = description where code = codigo_ok;
      if not found then editou := false; else editou := true; end if;
      raise exception 'ZZ999' using errcode = 'ZZ999';
    exception
      when sqlstate 'ZZ999' then null;
      when insufficient_privilege then editou := false;
      when others then editou := false;
    end;

    -- INSERCAO
    begin
      insert into public.products (code, name, brand_id) values ('ZZ-TESTE-P56', 'teste', marca);
      inseriu := true;
      raise exception 'ZZ999' using errcode = 'ZZ999';
    exception
      when sqlstate 'ZZ999' then null;
      when insufficient_privilege then inseriu := false;
      when others then inseriu := false;
    end;

    -- EXCLUSAO (num produto sem vinculo comercial)
    begin
      delete from public.products where code = codigo_livre;
      excluiu := found;
      raise exception 'ZZ999' using errcode = 'ZZ999';
    exception
      when sqlstate 'ZZ999' then null;
      when insufficient_privilege then excluiu := false;
      when others then excluiu := false;
    end;

    reset role;
    perform set_config('request.jwt.claims', null, true);

    linha := format('%s/%s (botao %s)', r.role, r.department,
                    case when r.can_edit_products then 'ligado' else 'desligado' end);

    if leu <> 315 then
      detalhe := detalhe || format(' | leitura %s: leu %s', linha, leu); falhou := falhou + 1;
    else passou := passou + 1; end if;

    if editou <> deve then
      detalhe := detalhe || format(' | edicao %s: editou=%s esperado=%s', linha, editou, deve); falhou := falhou + 1;
    else passou := passou + 1; end if;

    if inseriu <> deve then
      detalhe := detalhe || format(' | insercao %s: inseriu=%s esperado=%s', linha, inseriu, deve); falhou := falhou + 1;
    else passou := passou + 1; end if;

    -- exclusao e mais restrita: so is_privileged() (diretoria/administrador)
    if excluiu <> (r.role in ('diretoria','administrador')) then
      detalhe := detalhe || format(' | exclusao %s: excluiu=%s esperado=%s', linha, excluiu,
                    (r.role in ('diretoria','administrador'))); falhou := falhou + 1;
    else passou := passou + 1; end if;
  end loop;

  -- A trava do historico: produto ligado a lead nao sai nem para a diretoria.
  for r in select p.id from public.profiles p
            where p.role in ('diretoria','administrador') limit 1
  loop
    execute format('set local role authenticated');
    perform set_config('request.jwt.claims',
      json_build_object('sub', r.id::text, 'role', 'authenticated')::text, true);
    begin
      delete from public.products where code = codigo_preso;
      barrou_preso := false;
      raise exception 'ZZ999' using errcode = 'ZZ999';
    exception
      when sqlstate 'ZZ999' then null;
      when foreign_key_violation then barrou_preso := true;
      when others then barrou_preso := true;
    end;
    reset role;
    perform set_config('request.jwt.claims', null, true);
  end loop;
  if barrou_preso then passou := passou + 1;
  else detalhe := detalhe || ' | produto ligado a lead foi excluido, e nao devia'; falhou := falhou + 1;
  end if;

  raise notice 'P5.6: % passaram, % falharam', passou, falhou;
  if falhou > 0 then
    raise exception 'P5.6 FALHOU: % de % verificacoes. %', falhou, passou + falhou, detalhe;
  end if;
end $$;

-- Prova de que nada mudou: o catalogo segue intacto.
select
  (select count(*) from public.products) as produtos,
  (select count(*) from public.products where code = 'ZZ-TESTE-P56') as lixo_de_teste,
  (select count(*) from crm.produtos) as catalogo_no_crm;
