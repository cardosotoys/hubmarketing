-- Cardoso Marketing Hub — Brand Center: paleta de cores cadastrável por licenciado
-- Roda depois de 0001..0060. Retry-safe/idempotente.
--
-- Além de anexar arquivo/link em "Paleta de cores", agora dá pra cadastrar as cores em si
-- (nome + hex) e vê-las como amostras (swatches) direto no guia. Guardado como JSON:
-- [{ "name": "Azul Smurf", "hex": "#2EBADA" }, ...]

set lock_timeout = '5s';

alter table public.brand_licensees add column if not exists palette jsonb not null default '[]'::jsonb;
