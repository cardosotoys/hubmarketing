-- Cardoso Marketing Hub — Centro de Operações de Conteúdo, Fase 4: visão final por link sem login.
--
-- O cenário final de tudo (redes sociais, calendário e área comercial), só com o que está pronto,
-- para qualquer pessoa ver o resultado e não o meio. Mesmo modelo do Campo do Trade (0082):
-- o link carrega um token; quem abre nunca toca nas tabelas, só chama final_view(token), uma função
-- security definer que devolve apenas o que já passou pelas aprovações.
--
-- "Pronto" nas redes = agendada/publicada, ou etapas 1 e 2 aprovadas (e licenciador, quando houver).
-- Nunca sai: rascunho, ajuste, comentário, quem aprovou, prazo interno, peça em canal futuro.
-- Área comercial: só banner liberado e material liberado.
--
-- Roda depois de 0111. Idempotente.

set lock_timeout = '5s';

create table if not exists public.final_view_links (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),   -- 128 bits, sem depender de extensão
  label text not null default '',
  active boolean not null default true,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  views int not null default 0
);

alter table public.final_view_links enable row level security;
drop policy if exists "fvl_select" on public.final_view_links;
create policy "fvl_select" on public.final_view_links for select to authenticated using (public.can_release_content());
drop policy if exists "fvl_insert" on public.final_view_links;
create policy "fvl_insert" on public.final_view_links for insert to authenticated with check (public.can_release_content());
drop policy if exists "fvl_update" on public.final_view_links;
create policy "fvl_update" on public.final_view_links for update to authenticated
  using (public.can_release_content()) with check (public.can_release_content());

create or replace function public.final_view(p_token text, p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare lk public.final_view_links; d0 date; d1 date;
begin
  select * into lk from public.final_view_links where token = p_token and active;
  if not found then return jsonb_build_object('ok', false); end if;
  d0 := coalesce(p_from, date_trunc('month', current_date)::date);
  d1 := least(coalesce(p_to, d0 + 41), d0 + 120);   -- no máximo ~4 meses por chamada
  update public.final_view_links set last_seen_at = now(), views = views + 1 where token = p_token;

  return jsonb_build_object(
    'ok', true,
    'label', lk.label,
    'today', current_date,
    'from', d0,
    'to', d1,
    'pieces', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', i.id, 'date', i.pub_date, 'time', to_char(i.pub_time, 'HH24:MI'),
          'brand', i.brand, 'account', c.account, 'channel', c.name, 'network', c.network,
          'format', case when cardinality(c.formats) > 0 then i.piece_type else '' end,
          'mirror_facebook', i.mirror_facebook, 'kind', i.link_kind,
          'title', coalesce(nullif(t.title, ''), i.pauta), 'product', i.product,
          'caption', case when i.link_kind = 'reaproveita' then m.caption else i.caption end,
          'creative', case when i.link_kind = 'matriz' or (i.link_kind = 'adapta' and i.creative_changed)
                           then i.creative_url else m.creative_url end,
          'stage', i.stage
        ) order by i.pub_date, i.pub_time nulls last), '[]'::jsonb)
        from public.social_plan_items i
        join public.social_channels c on c.id = i.channel_id and not c.future
        left join public.social_topics t on t.id = i.topic_id
        left join lateral (
          select mm.caption, mm.creative_url from public.social_plan_items mm
           where mm.topic_id = i.topic_id and mm.link_kind = 'matriz' and not mm.archived limit 1
        ) m on true
       where not i.archived
         and i.pub_date between d0 and d1
         and (i.stage in ('agendado', 'publicado')
              or (i.status = 'aprovada' and i.creative_status = 'aprovada'
                  and not (coalesce(t.licensed, false) and not coalesce(t.licensor_ok, false))))
    ),
    'banners', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', b.id, 'seal', b.seal, 'title', b.title, 'subtitle', b.subtitle, 'cta', b.cta,
          'starts_on', b.starts_on, 'ends_on', b.ends_on, 'art_url', b.art_url
        ) order by b.starts_on), '[]'::jsonb)
        from public.commercial_banners b
       where b.released and b.ends_on >= current_date - 30
    ),
    'materials', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', cm.id, 'kind', cm.kind, 'name', cm.name, 'drive_url', cm.drive_url,
          'product_code', p.code, 'product_name', p.name, 'subject', cm.subject,
          'brand', coalesce(br.label, cm.brand),
          'image', coalesce(mt.thumb_url, p.image_url, '')
        ) order by p.code nulls last, cm.subject, cm.kind), '[]'::jsonb)
        from public.content_materials cm
        left join public.products p on p.id = cm.product_id
        left join public.brands br on br.id = p.brand_id
        left join public.media_thumbs mt on mt.source_url = p.image_url
       where cm.status = 'liberado'
    )
  );
end;
$$;

revoke all on function public.final_view(text, date, date) from public;
grant execute on function public.final_view(text, date, date) to anon, authenticated;
