import { useEffect, useMemo, useState } from 'react';
import type { SocialPlanItem, SocialTopic } from '../../types/database';
import { addMonths, brShort, monthName, slug, todayISO, ymOf, type ChannelMap } from './shared';

/* Assuntos, como no protótipo: lista enxuta à esquerda (um mês por vez) e o assunto aberto à direita.
 * O editor da direita vem pronto do pai (TopicSheet em modo inline). */
export default function AssuntosView({ topics, byTopic, chans, selectedId, onSelect, editor }: {
  topics: SocialTopic[];
  byTopic: Map<string, SocialPlanItem[]>;
  chans: ChannelMap;
  selectedId: string | null;
  onSelect: (id: string) => void;
  editor: React.ReactNode;
}) {
  const rows = useMemo(() => topics
    .map((t) => {
      const its = byTopic.get(t.id) ?? [];
      const m = its.find((x) => x.link_kind === 'matriz') ?? its[0];
      return { t, its, date: m?.pub_date ?? '' };
    })
    .filter((r) => r.its.length)
    .sort((a, b) => a.date.localeCompare(b.date)), [topics, byTopic]);
  const months = useMemo(() => [...new Set(rows.map((r) => ymOf(r.date)))].sort(), [rows]);
  const hoje = ymOf(todayISO());
  const [ym, setYm] = useState(() => (months.includes(hoje) ? hoje : months[0] ?? hoje));
  // o assunto aberto puxa o mês dele
  useEffect(() => {
    const r = rows.find((x) => x.t.id === selectedId);
    if (r && ymOf(r.date) !== ym) setYm(ymOf(r.date));
  }, [selectedId]);
  const doMes = rows.filter((r) => ymOf(r.date) === ym);

  return (
    <div className="coc-split">
      <aside className="coc-alist">
        <div className="coc-alist-head">
          <button className="sp-ebtn" aria-label="Mês anterior" onClick={() => setYm(addMonths(ym, -1))}>‹</button>
          <div><b>{monthName(ym)}</b><span>{doMes.length} assunto{doMes.length === 1 ? '' : 's'}</span></div>
          <button className="sp-ebtn" aria-label="Próximo mês" onClick={() => setYm(addMonths(ym, 1))}>›</button>
        </div>
        <div className="coc-alist-body">
          {doMes.length ? doMes.map(({ t, its, date }) => {
            const prontos = its.filter((x) => x.stage === 'agendado' || x.stage === 'publicado' || (x.status === 'aprovada' && x.creative_status === 'aprovada')).length;
            return (
              <button type="button" key={t.id} className="coc-aitem" aria-current={t.id === selectedId} onClick={() => onSelect(t.id)}>
                <span className="coc-ameta"><span className={`sp-dot b-${slug(t.brand)}`} /> {t.brand} · {brShort(date)}{t.licensed ? ' · licenciado' : ''}</span>
                <span className="coc-at">{t.title || t.product || 'Assunto sem título'}</span>
                <span className="coc-achips">
                  {its.map((x) => {
                    const ch = x.channel_id ? chans.get(x.channel_id) : undefined;
                    const nome = ch ? ch.name.replace('WhatsApp · ', 'WA ').replace('YouTube · playlist ', 'YT ').replace(' · post nativo', '') : x.network;
                    return <span key={x.id} className={`coc-achip ${ch?.future ? 'future' : ''}`}>{nome}{ch?.formats.length ? ` ${x.piece_type}` : ''}</span>;
                  })}
                </span>
                <span className="coc-aprog"><i style={{ width: `${its.length ? (prontos / its.length) * 100 : 0}%` }} /></span>
                <span className="coc-afoot">{prontos} de {its.length} destino{its.length === 1 ? '' : 's'} pronto{prontos === 1 ? '' : 's'}</span>
              </button>
            );
          }) : <p className="sp-calhint">Nenhum assunto neste mês com esses filtros.</p>}
        </div>
      </aside>
      <section className="coc-editor">
        {editor ?? (
          <div className="coc-editor-empty">
            <b>Escolha um assunto à esquerda</b>
            <span>Ou clique em “Novo assunto” para criar um. Um assunto é a ideia; os destinos são onde e quando ela sai.</span>
          </div>
        )}
      </section>
    </div>
  );
}
