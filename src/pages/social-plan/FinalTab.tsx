import { useMemo, useState } from 'react';
import { useThumbs } from '../../lib/thumbs';
import type { CommercialBanner, ContentMaterial, SocialPlanItem, SocialTopic } from '../../types/database';
import FinalBoard, { type FinalData, type FinalPiece } from './FinalBoard';
import { effective, pieceState, todayISO, ymOf, type ChannelMap } from './shared';
import type { ProductLite } from './useCommercial';

/* Aba Visão final: o resultado, sem o andamento, montado direto do que o Hub já tem.
 * Entra só peça pronta (duas etapas e licenciador), banner liberado e material liberado. */
export default function FinalTab({ live, byTopic, topicById, chans, banners, materials, products }: {
  live: SocialPlanItem[];
  byTopic: Map<string, SocialPlanItem[]>;
  topicById: Map<string, SocialTopic>;
  chans: ChannelMap;
  banners: CommercialBanner[];
  materials: ContentMaterial[];
  products: ProductLite[];
}) {
  const [month, setMonth] = useState(() => ymOf(todayISO()));
  const thumb = useThumbs();
  const data = useMemo<FinalData>(() => {
    const pieces: FinalPiece[] = [];
    live.forEach((x) => {
      const ch = x.channel_id ? chans.get(x.channel_id) : undefined;
      if (!ch || ch.future) return;
      const sibs = x.topic_id ? byTopic.get(x.topic_id) ?? [] : [];
      const matriz = sibs.find((s) => s.link_kind === 'matriz');
      const topic = x.topic_id ? topicById.get(x.topic_id) ?? null : null;
      if (!pieceState(x, matriz, topic, false).ready) return;
      const eff = effective(x, matriz);
      pieces.push({
        id: x.id, date: x.pub_date, time: x.pub_time ? x.pub_time.slice(0, 5) : null, brand: x.brand, account: ch.account,
        channel: ch.name, network: ch.network, format: ch.formats.length ? x.piece_type : '', mirror_facebook: x.mirror_facebook,
        kind: x.link_kind, title: topic?.title || x.pauta, product: x.product, caption: eff.caption, creative: eff.creative, stage: x.stage,
        grid: x.piece_type === 'Reels' ? 'reels' : /carross/i.test(x.format) ? 'carrossel' : 'post',
      });
    });
    pieces.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
    const prod = new Map(products.map((p) => [p.id, p]));
    return {
      ok: true, today: todayISO(), from: `${month}-01`, to: `${month}-31`, pieces,
      banners: banners.filter((b) => b.released),
      materials: materials.filter((m) => m.status === 'liberado').map((m) => {
        const p = m.product_id ? prod.get(m.product_id) : undefined;
        return { id: m.id, kind: m.kind, name: m.name, drive_url: m.drive_url, product_code: p?.code ?? null, product_name: p?.name ?? null,
          subject: m.subject, brand: p?.brand ?? m.brand, image: p?.image_url ? thumb(p.image_url) : '' };
      }),
    };
  }, [live, byTopic, topicById, chans, banners, materials, products, month, thumb]);

  return (
    <>
      <p className="sp-calhint" style={{ marginTop: 0 }}>O resultado, sem o meio: só o que passou pelas duas etapas (e pelo licenciador), os banners e os materiais liberados.</p>
      <FinalBoard data={data} month={month} onMonth={setMonth} />
    </>
  );
}
