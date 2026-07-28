-- Cardoso Marketing Hub — permite editar/excluir relatório diário
-- Roda uma vez no SQL Editor, depois de 0001..0017 já terem rodado.

create policy "daily_reports_update_own_or_privileged" on public.daily_reports
  for update to authenticated using (auth.uid() = user_id or public.is_privileged());

create policy "daily_reports_delete_own_or_privileged" on public.daily_reports
  for delete to authenticated using (auth.uid() = user_id or public.is_privileged());
