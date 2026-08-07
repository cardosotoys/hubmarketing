-- Cardoso Marketing Hub — Brand Center: personagens licenciados gerenciáveis
-- Roda depois de 0001..0058. Retry-safe/idempotente.
--
-- Antes os licenciados eram fixos no código e o "Guia de uso da marca" era só um selo. Agora cada
-- licenciado é uma linha editável, com o link do guia (Google Drive OU site próprio) e um link de
-- acesso rápido por asset: logotipos, paleta de cores, tipografia, ícones e pattern.

set lock_timeout = '5s';

create table if not exists public.brand_licensees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  licensor text not null default '',
  color text not null default 'var(--accent)',                    -- cor da borda do card (hex ou var CSS)
  source_type text not null default 'site' check (source_type in ('site', 'drive')),
  guide_url text not null default '',                             -- guia completo (Drive ou site)
  logos_url text not null default '',
  colors_url text not null default '',
  typography_url text not null default '',
  icons_url text not null default '',
  pattern_url text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_licensees enable row level security;
drop policy if exists "brand_licensees_select" on public.brand_licensees;
create policy "brand_licensees_select" on public.brand_licensees for select to authenticated using (true);
drop policy if exists "brand_licensees_insert" on public.brand_licensees;
create policy "brand_licensees_insert" on public.brand_licensees for insert to authenticated with check (true);
drop policy if exists "brand_licensees_update" on public.brand_licensees;
create policy "brand_licensees_update" on public.brand_licensees for update to authenticated using (true);
drop policy if exists "brand_licensees_delete" on public.brand_licensees;
create policy "brand_licensees_delete" on public.brand_licensees for delete to authenticated using (public.is_privileged());

-- Seed inicial (só se a tabela estiver vazia) — mesma lista de hoje + a origem que você passou.
insert into public.brand_licensees (name, licensor, color, source_type, position)
select v.name, v.licensor, v.color, v.source_type, v.position
from (
  values
    ('Os Smurfs', 'Schtroumpfs / IMPS', 'var(--blue)', 'site', 1),
    ('Galinha Pintadinha', 'Pintadinha Ltda', 'var(--yellow)', 'site', 2),
    ('Marvel Spidey', 'Disney/Marvel', 'var(--red)', 'site', 3),
    ('Disney (Ariel, Mickey, Minnie, Buzz, Woody)', 'Disney', 'var(--violet)', 'site', 4),
    ('Bluey', 'BBC Studios', 'var(--accent)', 'site', 5),
    ('O Show da Luna', 'Mundo Luna', 'var(--green)', 'drive', 6),
    ('Pocoyo', 'Zinkia', 'var(--playmi)', 'drive', 7)
) as v(name, licensor, color, source_type, position)
where not exists (select 1 from public.brand_licensees);
