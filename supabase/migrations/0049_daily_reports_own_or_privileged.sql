-- Cardoso Marketing Hub — Relatório Diário: cada um vê só os seus; adm/diretoria veem todos
-- Roda depois de 0001..0048. Retry-safe/idempotente.
--
-- Antes o SELECT era using(true) (qualquer logado lia todos os relatórios). Agora o usuário
-- comum só enxerga os próprios; Diretoria/Administrador (is_privileged) seguem vendo todos.

set lock_timeout = '5s';

drop policy if exists "daily_reports_select_authenticated" on public.daily_reports;
drop policy if exists "daily_reports_select_own_or_privileged" on public.daily_reports;
create policy "daily_reports_select_own_or_privileged" on public.daily_reports
  for select to authenticated using (
    public.is_privileged() or user_id = auth.uid()
  );
