import type { SocialPlanItem, SocialTopic } from '../../types/database';
import { brShort, hhmm, monthName, slug, ymOf, type ChannelMap } from './shared';

/* Lista de assuntos agrupada por mês da matriz. Cada cartão mostra os destinos como chips. */
export default function AssuntosView({ topics, byTopic, chans, onOpenTopic }: {
  topics: SocialTopic[];
  byTopic: Map<string, SocialPlanItem[]>;
  chans: ChannelMap;
  onOpenTopic: (id: string) => void;
}) {
  const rows = topics
    .map((t) => {
      const its = byTopic.get(t.id) ?? [];
      const m = its.find((x) => x.link_kind === 'matriz') ?? its[0];
      return { t, its, date: m?.pub_date ?? '', time: m?.pub_time ?? null };
    })
    .filter((r) => r.its.length)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return <div className="sp-empty"><b>Nenhum assunto com esses filtros</b>Ajuste ou limpe os filtros, ou crie um assunto novo.</div>;
  const meses = [...new Set(rows.map((r) => ymOf(r.date)))];
  return (
    <>
      {meses.map((ym) => {
        const doMes = rows.filter((r) => ymOf(r.date) === ym);
        return (
          <div className="sp-month" key={ym}>
            <div className="sp-mhead"><h2>{monthName(ym)}</h2><span>{doMes.length} assuntos</span></div>
            <div className="sp-topics">
              {doMes.map(({ t, its, date, time }) => {
                const ok = its.filter((x) => x.status === 'aprovada').length;
                return (
                  <button type="button" key={t.id} className={`sp-topic b-${slug(t.brand)}`} onClick={() => onOpenTopic(t.id)}>
                    <span className="sp-topic-meta"><span className={`sp-badge b-${slug(t.brand)}`}>{t.brand}</span>{brShort(date)}{time ? ` · ${hhmm(time)}` : ''}{t.licensed ? ' · licenciado' : ''}</span>
                    <span className="sp-topic-t">{t.title || t.product || 'Assunto sem título'}</span>
                    {t.front && <span className="sp-topic-f">{t.front}</span>}
                    <span className="sp-topic-chips">
                      {its.map((x) => {
                        const ch = x.channel_id ? chans.get(x.channel_id) : undefined;
                        const nome = ch ? ch.name.replace('WhatsApp · ', 'WA ').replace('YouTube · playlist ', 'YT ').replace(' · post nativo', '') : x.network;
                        return <span key={x.id} className={`sp-tchip k-${x.link_kind} ${ch?.future ? 'future' : ''}`}>{nome}{ch?.formats.length ? ` ${x.piece_type}` : ''}</span>;
                      })}
                    </span>
                    <span className="sp-topic-foot">{its.length} destino{its.length === 1 ? '' : 's'} · {ok} aprovado{ok === 1 ? '' : 's'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
