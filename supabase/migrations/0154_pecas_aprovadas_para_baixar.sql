-- PEÇAS APROVADAS PARA BAIXAR, POR LINK SEM LOGIN (03/11/2026)
-- O Comercial e o Marketing abrem /pecas?t=<token> e baixam as peças aprovadas direto do Drive, sem entrar no Hub
-- e sem precisar de acesso ao Drive compartilhado. Quem entrega o arquivo é a função drive-baixar (conta de serviço),
-- e ela só entrega um arquivo se ele for a arte (ou uma lâmina) de uma peça que a final_view mostraria:
-- agendada, publicada, ou aprovada nas duas etapas (e pelo licenciador, quando houver).
-- 1) final_view passa a devolver as lâminas do carrossel ('slides')
-- 2) final_view_file(token, id do arquivo): diz se aquele arquivo pode sair por aquele link
-- 3) os dois links: Comercial e Marketing (o token aparece na conferência do fim)
-- Idempotente: pode rodar de novo.

set lock_timeout = '5s';

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
          'creative', case when i.link_kind = 'matriz' or i.creative_changed
                           then i.creative_url else m.creative_url end,
          'slides', case when i.link_kind = 'matriz' or i.creative_changed
                         then i.creative_slides else m.creative_slides end,
          'stage', i.stage
        ) order by i.pub_date, i.pub_time nulls last), '[]'::jsonb)
        from public.social_plan_items i
        join public.social_channels c on c.id = i.channel_id and not c.future
        left join public.social_topics t on t.id = i.topic_id
        left join lateral (
          select mm.caption, mm.creative_url, mm.creative_slides from public.social_plan_items mm
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


create or replace function public.final_view_file(p_token text, p_file text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- id de arquivo do Drive: letras, números, _ e -; curto demais casaria com pedaço de outro endereço
  if p_file is null or p_file !~ '^[A-Za-z0-9_-]{20,}$' then return false; end if;
  if not exists (select 1 from public.final_view_links where token = p_token and active) then return false; end if;
  return exists (
    select 1
      from public.social_plan_items i
      join public.social_channels c on c.id = i.channel_id and not c.future
      left join public.social_topics t on t.id = i.topic_id
      left join lateral (
        select mm.creative_url, mm.creative_slides from public.social_plan_items mm
         where mm.topic_id = i.topic_id and mm.link_kind = 'matriz' and not mm.archived limit 1
      ) m on true
      cross join lateral (
        select case when i.link_kind = 'matriz' or i.creative_changed then i.creative_url else m.creative_url end as url,
               case when i.link_kind = 'matriz' or i.creative_changed then i.creative_slides else m.creative_slides end as slides
      ) e
     where not i.archived
       and (i.stage in ('agendado', 'publicado')
            or (i.status = 'aprovada' and i.creative_status = 'aprovada'
                and not (coalesce(t.licensed, false) and not coalesce(t.licensor_ok, false))))
       and (position(p_file in coalesce(e.url, '')) > 0
            or exists (select 1 from unnest(coalesce(e.slides, '{}'::text[])) s where position(p_file in s) > 0))
  );
end;
$$;

revoke all on function public.final_view_file(text, text) from public;
grant execute on function public.final_view_file(text, text) to anon, authenticated;

-- os dois links (um por equipe, para desligar um sem mexer no outro)
insert into public.final_view_links (label)
select x from (values ('Comercial'), ('Marketing')) v(x)
 where not exists (select 1 from public.final_view_links l where l.label = v.x);

notify pgrst, 'reload schema';

-- CONFERÊNCIA — os dois links (o endereço é https://cardoso-marketing.vercel.app/pecas?t=<token>)
select label, active, 'https://cardoso-marketing.vercel.app/pecas?t=' || token as link
  from public.final_view_links
 where label in ('Comercial', 'Marketing')
 order by label;
