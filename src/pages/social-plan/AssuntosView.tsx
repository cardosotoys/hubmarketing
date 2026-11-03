import { useEffect, useMemo, useState } from 'react';
import type { SocialPlanItem, SocialTopic } from '../../types/database';
import { driveTarget } from './DrivePlayer';
import { addDays, addMonths, brShort, DOW, dowIndex, effective, thumbDe, monthName, pieceState, slug, todayISO, ymOf, type ChannelMap } from './shared';

/* Assuntos como mural de criativos: uma grade de artes por semana, do jeito que vão aparecer.
 * O que ainda não tem arte fica tracejado; a etiqueta diz o que falta. Clicar abre o assunto ao lado
 * (no celular, por cima). O editor vem pronto do pai (TopicSheet em modo inline). */

type Situacao = 'arte' | 'ajuste' | 'aprovacao' | 'pronto' | 'publicado' | 'rascunho';
const SIT: Record<Situacao, { label: string; tone: string }> = {
  arte: { label: 'Falta arte', tone: 'red' },
  ajuste: { label: 'Com ajuste', tone: 'red' },
  aprovacao: { label: 'Em aprovação', tone: 'warn' },
  pronto: { label: 'Pronto para agendar', tone: 'ok' },
  publicado: { label: 'Publicado', tone: 'done' },
  rascunho: { label: 'Rascunho', tone: '' },
};
const FILTROS: { key: 'todos' | Situacao; label: string }[] = [
  { key: 'todos', label: 'Todos' }, { key: 'arte', label: 'Falta arte' }, { key: 'aprovacao', label: 'Em aprovação' },
  { key: 'pronto', label: 'Prontos' }, { key: 'publicado', label: 'Publicados' },
];

function situacao(t: SocialTopic, its: SocialPlanItem[], chans: ChannelMap): { sit: Situacao; matriz?: SocialPlanItem } {
  const matriz = its.find((x) => x.link_kind === 'matriz') ?? its[0];
  const vivos = its.filter((x) => !(x.channel_id && chans.get(x.channel_id)?.future));
  const states = vivos.map((x) => pieceState(x, matriz, t, false));
  if (vivos.length && vivos.every((x) => x.stage === 'publicado')) return { sit: 'publicado', matriz };
  if (states.some((s) => s.tone === 'red')) return { sit: 'ajuste', matriz };
  if (matriz && !effective(matriz, matriz).creative) return { sit: 'arte', matriz };
  if (states.length && states.every((s) => s.ready)) return { sit: 'pronto', matriz };
  if (states.some((s) => s.tone === 'warn')) return { sit: 'aprovacao', matriz };
  return { sit: 'rascunho', matriz };
}

const segunda = (iso: string) => addDays(iso, -dowIndex(iso)); // DOW começa na segunda

export default function AssuntosView({ topics, byTopic, chans, selectedId, onSelect, onBack, editor }: {
  topics: SocialTopic[];
  byTopic: Map<string, SocialPlanItem[]>;
  chans: ChannelMap;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack?: () => void;
  editor: React.ReactNode;
}) {
  const rows = useMemo(() => topics
    .map((t) => {
      const its = byTopic.get(t.id) ?? [];
      const { sit, matriz } = situacao(t, its, chans);
      const eff = matriz ? effective(matriz, matriz) : null;
      const ch = matriz?.channel_id ? chans.get(matriz.channel_id) : undefined;
      return {
        t, its, sit, date: matriz?.pub_date ?? '', time: matriz?.pub_time?.slice(0, 5) ?? '',
        thumb: eff ? thumbDe(eff) : null,
        pasta: driveTarget(eff?.slides[0] ?? eff?.creative)?.kind === 'folder',
        slides: eff?.slides.length ?? 0,
        vertical: /Reels|Stories|Shorts|TikTok/.test(`${matriz?.piece_type} ${ch?.name ?? ''}`),
        onde: ch ? `${ch.name.replace('YouTube · playlist ', 'YouTube ').replace('WhatsApp · ', 'WhatsApp ')}${ch.formats.length && matriz ? ` ${matriz.piece_type}` : ''}` : matriz?.network ?? '',
      };
    })
    .filter((r) => r.its.length)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), [topics, byTopic, chans]);

  const months = useMemo(() => [...new Set(rows.map((r) => ymOf(r.date)))].sort(), [rows]);
  const hoje = ymOf(todayISO());
  const [ym, setYm] = useState(() => (months.includes(hoje) ? hoje : months[0] ?? hoje));
  const [filtro, setFiltro] = useState<'todos' | Situacao>('todos');
  // o assunto aberto puxa o mês dele
  useEffect(() => {
    const r = rows.find((x) => x.t.id === selectedId);
    if (r && ymOf(r.date) !== ym) setYm(ymOf(r.date));
  }, [selectedId]);

  const doMes = rows.filter((r) => ymOf(r.date) === ym);
  const conta = (k: 'todos' | Situacao) => (k === 'todos' ? doMes.length : doMes.filter((r) => (k === 'arte' ? r.sit === 'arte' || r.sit === 'ajuste' : r.sit === k)).length);
  const vis = filtro === 'todos' ? doMes : doMes.filter((r) => (filtro === 'arte' ? r.sit === 'arte' || r.sit === 'ajuste' : r.sit === filtro));
  const semanas = useMemo(() => {
    const m = new Map<string, typeof vis>();
    for (const r of vis) { const k = segunda(r.date); (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
    return [...m.entries()];
  }, [vis]);

  return (
    <div className={`coc-mural-wrap ${editor ? 'has-sel' : ''}`}>
      <section className="coc-mural">
        <div className="coc-mural-head">
          <div className="coc-mural-month">
            <button type="button" aria-label="Mês anterior" onClick={() => setYm(addMonths(ym, -1))}>‹</button>
            <div><b>{monthName(ym)}</b><span>{doMes.length} assunto{doMes.length === 1 ? '' : 's'}</span></div>
            <button type="button" aria-label="Próximo mês" onClick={() => setYm(addMonths(ym, 1))}>›</button>
          </div>
          <div className="coc-mural-filters" role="tablist">
            {FILTROS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filtro === f.key} onClick={() => setFiltro(f.key)}>
                {f.label}<span>{conta(f.key)}</span>
              </button>
            ))}
          </div>
        </div>

        {semanas.length ? semanas.map(([seg, lista]) => (
          <div key={seg} className="coc-week">
            <h4>Semana de {brShort(seg)} <small>{lista.length} assunto{lista.length === 1 ? '' : 's'}</small></h4>
            <div className="coc-tiles">
              {lista.map((r) => {
                const sit = SIT[r.sit];
                const outros = r.its.length - 1;
                return (
                  <button type="button" key={r.t.id} className={`coc-tile b-${slug(r.t.brand)} ${r.thumb ? '' : r.pasta ? 'folder' : 'empty'}`} aria-current={r.t.id === selectedId} onClick={() => onSelect(r.t.id)}>
                    <span className="coc-tile-art">
                      {r.thumb ? <img src={r.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                        : r.pasta ? <span className="coc-tile-noart"><b>Pasta no Drive</b><small>escolha o arquivo final da arte</small></span>
                        : <span className="coc-tile-noart"><b>Sem arte</b><small>abrir e escolher do Drive</small></span>}
                      <span className="coc-tile-date"><b>{r.date.slice(8, 10)}</b>{DOW[dowIndex(r.date)].slice(0, 3)}{r.time ? ` · ${r.time}` : ''}</span>
                      {r.vertical && r.thumb && <span className="coc-tile-kind" aria-label="vídeo">▶</span>}
                      {r.slides > 1 && <span className="coc-tile-kind">{r.slides} lâminas</span>}
                    </span>
                    <span className="coc-tile-info">
                      <span className="coc-tile-brand"><i className={`sp-dot b-${slug(r.t.brand)}`} />{r.t.brand}{r.t.licensed ? ' · licenciado' : ''}</span>
                      <span className="coc-tile-title">{r.t.title || r.t.product || 'Assunto sem título'}</span>
                      <span className="coc-tile-foot">
                        <span className={`coc-sit ${sit.tone}`}>{sit.label}</span>
                        <small>{r.onde}{outros > 0 ? ` + ${outros}` : ''}</small>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )) : <p className="coc-mural-empty">{doMes.length ? 'Nenhum assunto com essa situação neste mês.' : 'Nenhum assunto neste mês com esses filtros.'}</p>}
      </section>

      {editor && (
        <section className="coc-editor">
          {onBack && <button type="button" className="coc-back" onClick={onBack}>‹ Voltar ao mural de {monthName(ym)}</button>}
          {editor}
        </section>
      )}
    </div>
  );
}
