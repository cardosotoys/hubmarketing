-- Cardoso Black: número de presentes na live, para o funil da Medição (preenchido pela equipe no Hub,
-- a partir do relatório de presença do Meet ou do Zoom). Pode rodar de novo sem apagar nada.
alter table public.black_config add column if not exists presentes_live integer
  check (presentes_live is null or presentes_live >= 0);
