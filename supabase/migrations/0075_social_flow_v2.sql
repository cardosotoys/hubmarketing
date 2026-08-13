-- Cardoso Marketing Hub — Social: revisão do fluxo (aprovação no planejamento, gate mLabs,
-- etapa Acompanhamento) + vínculo de SKU. Roda depois de 0072..0074. Idempotente.

set lock_timeout = '5s';

-- vínculo opcional com um produto/SKU do catálogo (usado principalmente em Playmi/Tópi)
alter table public.social_content add column if not exists product_id uuid references public.products (id);

-- etapas: acrescenta 'acompanhamento' (mantém as antigas por compatibilidade)
alter table public.social_content drop constraint if exists social_content_stage_check;
alter table public.social_content add constraint social_content_stage_check
  check (stage in ('planejamento', 'aprov_conteudo', 'producao', 'aprov_arte', 'mlabs', 'publicado', 'lojistas', 'acompanhamento'));

-- aprovação também no gate 'mlabs' (sinal: aprovado/alteração, sem detalhar)
alter table public.social_content_approvals drop constraint if exists social_content_approvals_gate_check;
alter table public.social_content_approvals add constraint social_content_approvals_gate_check
  check (gate in ('conteudo', 'arte', 'mlabs'));
