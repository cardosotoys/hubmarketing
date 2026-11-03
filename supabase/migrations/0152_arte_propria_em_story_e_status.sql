-- ARTE PRÓPRIA EM STORY E STATUS (03/11/2026)
-- Nem sempre o Story ou o Status usa a mesma arte do feed: muitas vezes existe outra versão. Até aqui, só quem "adapta"
-- podia ter arte própria (e aí também precisava de legenda e aprovação de legenda próprias). Agora qualquer destino pode
-- ter ARTE PRÓPRIA (creative_changed = true) e continuar REAPROVEITANDO a legenda da matriz.
--   · a arte própria tem aprovação de criativo própria (etapa 2); a legenda segue a matriz (etapa 1)
--   · sem arte própria, o destino continua herdando a arte e a aprovação do feed, como antes
-- Ajusta as regras de herança, a trava das lâminas do carrossel e a visão final por link. Pode rodar de novo.

create or replace function public.social_gate_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare m record;
begin
  -- conteúdo mudou depois de decidido → precisa de nova aprovação
  if tg_op = 'UPDATE' then
    if new.link_kind <> 'reaproveita' and new.caption is distinct from old.caption and new.status <> 'pendente'
       and old.status = new.status then
      new.status := 'pendente'; new.status_by := null; new.status_at := now();
    end if;
    if (new.link_kind = 'matriz' or new.creative_changed)
       and new.creative_url is distinct from old.creative_url and new.creative_status <> 'pendente'
       and old.creative_status = new.creative_status then
      new.creative_status := 'pendente'; new.creative_by := null; new.creative_at := now();
    end if;
  end if;

  -- herança
  if new.link_kind <> 'matriz' and new.topic_id is not null then
    select status, status_by, status_at, creative_status, creative_by, creative_at into m
      from public.social_plan_items
     where topic_id = new.topic_id and link_kind = 'matriz' and id <> new.id and not archived
     limit 1;
    if found then
      if new.link_kind = 'reaproveita' then
        new.status := m.status; new.status_by := m.status_by; new.status_at := m.status_at;
      end if;
      if not new.creative_changed then
        new.creative_status := m.creative_status; new.creative_by := m.creative_by; new.creative_at := m.creative_at;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.social_gate_propagate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.link_kind = 'matriz' and new.topic_id is not null
     and (tg_op = 'INSERT'
          or new.status is distinct from old.status
          or new.creative_status is distinct from old.creative_status) then
    -- o "update" vazio dispara o trigger de herança de cada irmã, que copia da matriz
    update public.social_plan_items
       set updated_at = updated_at
     where topic_id = new.topic_id and id <> new.id and not archived
       and (link_kind = 'reaproveita' or not creative_changed);
  end if;
  return null;
end;
$$;

create or replace function public.social_slides_gate()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.link_kind = 'matriz' or new.creative_changed)
     and new.creative_slides is distinct from old.creative_slides
     and new.creative_status <> 'pendente' and old.creative_status = new.creative_status then
    new.creative_status := 'pendente'; new.creative_by := null; new.creative_at := now();
  end if;
  return new;
end $$;

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

notify pgrst, 'reload schema';

-- CONFERÊNCIA — a regra nova está no banco (as duas colunas têm que vir true)
select position('or new.creative_changed)' in pg_get_functiondef('public.social_gate_rules'::regproc)) > 0 as regra_arte_propria,
       position('or i.creative_changed' in pg_get_functiondef('public.final_view(text, date, date)'::regprocedure)) > 0 as visao_final;
