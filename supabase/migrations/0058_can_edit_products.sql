-- Cardoso Marketing Hub — permissão por pessoa para editar produtos
-- Roda depois de 0001..0057. Retry-safe/idempotente.
--
-- Antes, quem era do departamento "assistente" não conseguia editar os campos de produto.
-- Agora dá pra LIBERAR pessoas específicas: um toggle "pode editar produtos" no perfil
-- (gerenciado em Configurações → Usuários). Quem tiver isso ligado passa a editar produtos,
-- mesmo sendo assistente. O RLS da tabela products já permite escrita a qualquer logado;
-- este flag controla só o que o app libera no front.

set lock_timeout = '5s';

alter table public.profiles add column if not exists can_edit_products boolean not null default false;
