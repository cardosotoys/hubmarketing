-- Cardoso Marketing Hub — as postagens começam de fato hoje, terça 20/10/2026.
--
-- Segunda 19/10 passou sem post. Ficaram atrasados Miniaturas Spidey (Playmi) e Carrinho de Boneca (Tópi).
-- O Natal Musical também era de 19/10, mas está em espera (0120).
--   · Miniaturas Spidey e Carrinho de Boneca saem hoje às 12h, com os Stories às 19h30.
--   · Totokinha Spidey (era hoje) vai para quarta 21/10 12h, um dia livre da Playmi; a sequência dos dois
--     Spidey continua na ordem.
--   · Os outros destinos desses 3 assuntos andam junto. O resto do calendário não muda.
--
-- Casa pelo assunto + rede + formato + vínculo, então vale qualquer que seja a data que está no banco hoje.
-- Não mexe em destino agendado ou publicado. Idempotente.

update public.social_plan_items i
   set pub_date = v.nova, weekday = v.dia, month_label = 'Out/26', updated_at = now()
  from public.social_topics t,
       (values
         ('plano-2026-10b:t001', 'Instagram', 'Reels',   'matriz',      '2026-10-20'::date, 'Terça'),
         ('plano-2026-10b:t001', 'Instagram', 'Stories', 'reaproveita', '2026-10-20'::date, 'Terça'),
         ('plano-2026-10b:t001', 'YouTube',   null,      null,          '2026-10-21'::date, 'Quarta'),
         ('plano-2026-10b:t001', 'WhatsApp',  null,      null,          '2026-10-22'::date, 'Quinta'),
         ('plano-2026-10b:t004', 'Instagram', 'Reels',   'matriz',      '2026-10-21'::date, 'Quarta'),
         ('plano-2026-10b:t004', 'Instagram', 'Stories', 'reaproveita', '2026-10-21'::date, 'Quarta'),
         ('plano-2026-10b:t004', 'YouTube',   null,      null,          '2026-10-22'::date, 'Quinta'),
         ('plano-2026-10b:t004', 'WhatsApp',  null,      null,          '2026-10-22'::date, 'Quinta'),
         ('plano-2026-10b:t005', 'Instagram', 'Reels',   'matriz',      '2026-10-20'::date, 'Terça'),
         ('plano-2026-10b:t005', 'Instagram', 'Stories', 'reaproveita', '2026-10-20'::date, 'Terça'),
         ('plano-2026-10b:t005', 'Instagram', 'Stories', 'adapta',      '2026-10-21'::date, 'Quarta'),
         ('plano-2026-10b:t005', 'TikTok',    null,      null,          '2026-10-21'::date, 'Quarta')
       ) as v(ext_key, rede, tipo, vinculo, nova, dia)
 where t.id = i.topic_id
   and t.ext_key = v.ext_key
   and i.network like v.rede || '%'
   and (v.tipo is null or i.piece_type = v.tipo)
   and (v.vinculo is null or i.link_kind = v.vinculo)
   and not i.archived
   and i.stage not in ('agendado', 'publicado')
   and i.pub_date <> v.nova;

-- Conferência: deve vir vazio (nada atrasado)
--   select pub_date, pub_time, brand, network, piece_type, pauta from public.social_plan_items
--    where not archived and pub_date < '2026-10-20' and stage <> 'publicado' order by 1, 2;
