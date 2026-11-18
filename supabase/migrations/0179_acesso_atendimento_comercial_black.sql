-- Acesso de atendimento.comercial@cardosotoys.com.br: só a área da Cardoso Black.
-- Antes: criar o usuário em Supabase → Authentication → Users → "Invite user" (ou "Add user").
-- A Cardoso Black é liberada em extra_modules (isso também dá acesso aos dados da Black via black_staff());
-- todos os outros módulos ficam ocultos. Pode rodar de novo.

do $do$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = 'atendimento.comercial@cardosotoys.com.br';
  if v_id is null then
    raise exception 'Usuário atendimento.comercial@cardosotoys.com.br ainda não existe. Crie em Authentication → Users e rode de novo.';
  end if;

  update public.profiles set
    name = case when coalesce(name, '') in ('', 'atendimento.comercial') then 'Atendimento Comercial' else name end,
    avatar_initials = 'AC',
    role = 'equipe',
    extra_modules = array['cardoso-black'],
    hidden_modules = array['dashboard','relatorios','projetos','demandas','calendario','redes-sociais','biblioteca','produtos',
      'monitor-precos','tabela-precos','brand','campanhas','design-produto','embalagens','marcas','ia','monday','relatorio-diario',
      'auditoria','notificacoes','configuracoes','trade-marketing','reunioes','aprovacoes','pesquisa-mercado','concorrentes',
      'certificacoes','fotos','videos','templates','documentos','usuarios','permissoes']
  where id = v_id;

  raise notice 'Acesso só à Cardoso Black liberado para atendimento.comercial@cardosotoys.com.br.';
end
$do$;
