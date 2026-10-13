import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { SocialPlanDeadline, SocialPlanItem, SocialStrategyNote, SocialTopic } from '../../types/database';
import { MES_ABREV, addDays, addMonths, brShort, monthName, parseYmd, pieceState, slug, todayISO, ymOf } from './shared';

/* Estratégia e cronograma, em sub-abas para ler uma coisa por vez:
 * visão geral (marca a marca), andamento (das próprias peças), datas comerciais (marcos),
 * guia das marcas e pendências. Os textos vêm de social_strategy_notes (planilha do plano). */

const BRANDS = ['Playmi', 'Tópi', 'Cardoso'] as const;
type Sub = 'geral' | 'andamento' | 'datas' | 'guia' | 'pendencias';

type Bucket = 'pub' | 'pronta' | 'aprov' | 'ajuste' | 'prod';
const BUCKETS: { k: Bucket; label: string }[] = [
  { k: 'pub', label: 'No ar ou agendada' }, { k: 'pronta', label: 'Pronta' },
  { k: 'aprov', label: 'Em aprovação' }, { k: 'ajuste', label: 'Com ajuste' }, { k: 'prod', label: 'Produção ou rascunho' },
];
function bucketOf(label: string): Bucket {
  if (label === 'Publicada' || label === 'Agendada') return 'pub';
  if (label === 'Pronta para agendar') return 'pronta';
  if (label.startsWith('Ajuste')) return 'ajuste';
  if (label.startsWith('Aguardando')) return 'aprov';
  return 'prod';
}
const empty = (): Record<Bucket, number> => ({ pub: 0, pronta: 0, aprov: 0, ajuste: 0, prod: 0 });
const area = (resp: string) => (resp.includes('+') ? 'mix' : /^Digital/i.test(resp) ? 'dig' : 'com');
const ST_LABEL = { pendente: 'Pendente', andamento: 'Em andamento', feito: 'Feito' } as const;
const NEXT = { pendente: 'andamento', andamento: 'feito', feito: 'pendente' } as const;

/* ---- leitura dos textos da estratégia ---- */
const brandOfItem = (item: string) => BRANDS.find((b) => item.endsWith(b)) ?? null;
const splitPilares = (v: string) => v.split(/\s*·\s*(?=\d\))/).map((s) => s.replace(/^\d\)\s*/, '').trim()).filter(Boolean);
function splitCadencia(v: string) {
  const out: Record<string, string[]> = {};
  let resto = v;
  for (const b of BRANDS) {
    const m = v.match(new RegExp(`${b}:\\s*([^.]*)\\.`));
    if (m) { out[b] = m[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean); resto = resto.replace(m[0], ''); }
  }
  return { porMarca: out, geral: resto.trim() };
}
function swatches(paleta: string) {
  return paleta.split('·').map((s) => s.trim()).map((s) => { const m = s.match(/#[0-9A-Fa-f]{6}/); return m ? { nome: s.replace(m[0], '').trim(), hex: m[0] } : null; })
    .filter(Boolean) as { nome: string; hex: string }[];
}

export default function StrategyView({ live, byTopic, topicById, deadlines, notes, canMark, isPriv, meId, onChanged, initialSub = 'geral' }: {
  live: SocialPlanItem[];
  byTopic: Map<string, SocialPlanItem[]>;
  topicById: Map<string, SocialTopic>;
  deadlines: SocialPlanDeadline[];
  notes: SocialStrategyNote[];
  canMark: boolean;
  isPriv: boolean;
  meId: string | null;
  onChanged: () => Promise<void> | void;
  initialSub?: Sub;
}) {
  const [sub, setSub] = useState<Sub>(initialSub);
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg((c) => (c === m ? '' : c)), 2600); };
  const pend = notes.filter((n) => n.section === 'pendencia').sort((a, b) => a.ord - b.ord);
  const abertas = pend.filter((n) => !n.done).length;
  const subs: [Sub, string][] = [['geral', 'Visão geral'], ['andamento', 'Andamento'], ['datas', 'Datas comerciais'], ['guia', 'Guia das marcas'], ['pendencias', 'Pendências']];

  return (
    <div className="coc-st">
      <div className="coc-st-tabs" role="tablist">
        {subs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={sub === k} onClick={() => setSub(k)}>
            {l}{k === 'pendencias' && abertas > 0 ? <span className="coc-st-cnt">{abertas}</span> : null}
          </button>
        ))}
      </div>
      {msg && <div className="sp-saved" style={{ marginBottom: 10 }}>{msg}</div>}
      {sub === 'geral' && <Geral notes={notes} />}
      {sub === 'andamento' && <Andamento live={live} byTopic={byTopic} topicById={topicById} />}
      {sub === 'datas' && <Datas deadlines={deadlines} canMark={canMark} isPriv={isPriv} meId={meId} onChanged={onChanged} flash={flash} />}
      {sub === 'guia' && <Guia notes={notes} />}
      {sub === 'pendencias' && <Pendencias pend={pend} canMark={canMark} meId={meId} onChanged={onChanged} flash={flash} />}
    </div>
  );
}

/* ================= Visão geral ================= */
function Geral({ notes }: { notes: SocialStrategyNote[] }) {
  const est = notes.filter((n) => n.section === 'estrategia').sort((a, b) => a.ord - b.ord);
  if (!est.length) return <Vazio texto="A estratégia do período ainda não foi carregada." />;
  const get = (item: string) => est.find((n) => n.item === item)?.value ?? '';
  const periodo = get('Período');
  const cad = splitCadencia(get('Cadência'));
  const usados = new Set(['Período', 'Cadência']);
  const regras = est.filter((n) => !usados.has(n.item) && !brandOfItem(n.item));
  return (
    <>
      {periodo && <p className="coc-st-periodo"><b>Período</b> {periodo}</p>}
      <div className="coc-st-brands">
        {BRANDS.map((b) => {
          const objetivo = est.find((n) => n.item === `Objetivo ${b}`)?.value;
          const pilares = splitPilares(est.find((n) => n.item === `Pilares ${b}`)?.value ?? '');
          return (
            <section key={b} className={`coc-st-brand b-${slug(b)}`}>
              <h3>{b}</h3>
              {objetivo && <p className="coc-st-obj">{objetivo}</p>}
              {pilares.length > 0 && (
                <>
                  <h4>Pilares</h4>
                  <ol className="coc-st-pilares">{pilares.map((p) => <li key={p}>{p}</li>)}</ol>
                </>
              )}
              {cad.porMarca[b]?.length ? (
                <>
                  <h4>Cadência</h4>
                  <div className="coc-st-chips">{cad.porMarca[b].map((c) => <span key={c}>{c}</span>)}</div>
                </>
              ) : null}
            </section>
          );
        })}
      </div>
      {cad.geral && <p className="coc-st-note">{cad.geral}</p>}
      {regras.length > 0 && (
        <>
          <h3 className="coc-st-h">Regras do período</h3>
          <div className="coc-st-rules">
            {regras.map((n) => <div key={n.ext_key} className="coc-st-rule"><b>{n.item}</b><p>{n.value}</p></div>)}
          </div>
        </>
      )}
    </>
  );
}

/* ================= Andamento ================= */
function Andamento({ live, byTopic, topicById }: { live: SocialPlanItem[]; byTopic: Map<string, SocialPlanItem[]>; topicById: Map<string, SocialTopic> }) {
  const [month, setMonth] = useState(() => ymOf(todayISO()));
  const [aberta, setAberta] = useState<string | null>(null);
  const dados = useMemo(() => {
    const porMarca = new Map<string, { n: Record<Bucket, number>; total: number; frentes: Map<string, { n: Record<Bucket, number>; total: number; first: string }> }>();
    live.filter((x) => x.pub_date.startsWith(month)).forEach((x) => {
      const sibs = x.topic_id ? byTopic.get(x.topic_id) ?? [] : [];
      const b = bucketOf(pieceState(x, sibs.find((s) => s.link_kind === 'matriz'), x.topic_id ? topicById.get(x.topic_id) : null, false).label);
      const m = porMarca.get(x.brand) ?? { n: empty(), total: 0, frentes: new Map() };
      m.n[b]++; m.total++;
      // tira o mês do nome da frente ("Outubro · Sem. 1 · …") porque o mês já está no topo
      const nome = (x.week_theme || 'Sem frente').replace(/^[A-Za-zçÇ]+\s·\s/, '');
      const f = m.frentes.get(nome) ?? { n: empty(), total: 0, first: x.pub_date };
      f.n[b]++; f.total++; if (x.pub_date < f.first) f.first = x.pub_date;
      m.frentes.set(nome, f);
      porMarca.set(x.brand, m);
    });
    return porMarca;
  }, [live, byTopic, topicById, month]);
  const Bar = ({ n, total }: { n: Record<Bucket, number>; total: number }) => (
    <div className="sp-bar">{BUCKETS.map((b) => n[b.k] ? <i key={b.k} className={`s-${b.k}`} style={{ width: `${(n[b.k] / total) * 100}%` }} title={`${b.label}: ${n[b.k]}`} /> : null)}</div>
  );
  return (
    <>
      <div className="coc-st-monthbar">
        <button className="sp-ebtn" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
        <b>{monthName(month)}</b>
        <button className="sp-ebtn" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>›</button>
      </div>
      <div className="coc-st-prog">
        {BRANDS.map((b) => {
          const d = dados.get(b);
          if (!d) return <section key={b} className="coc-st-pbrand"><h3><span className={`sp-dot b-${slug(b)}`} /> {b}</h3><p className="sp-calhint">Nenhuma peça neste mês.</p></section>;
          const prontas = d.n.pub + d.n.pronta;
          const frentes = [...d.frentes.entries()].sort((x, y) => x[1].first.localeCompare(y[1].first));
          const open = aberta === b;
          return (
            <section key={b} className="coc-st-pbrand">
              <h3><span className={`sp-dot b-${slug(b)}`} /> {b}</h3>
              <div className="coc-st-big"><b>{Math.round((prontas / d.total) * 100)}%</b><span>prontas ou no ar · {prontas} de {d.total} peças</span></div>
              <Bar n={d.n} total={d.total} />
              <div className="coc-st-mini">
                {d.n.aprov > 0 && <span>{d.n.aprov} em aprovação</span>}
                {d.n.ajuste > 0 && <span className="red">{d.n.ajuste} com ajuste</span>}
                {d.n.prod > 0 && <span>{d.n.prod} em produção</span>}
              </div>
              <button className="coc-fold sm" onClick={() => setAberta(open ? null : b)} aria-expanded={open}>
                <span>{frentes.length} frente{frentes.length === 1 ? '' : 's'} no mês</span><span>{open ? 'recolher' : 'ver frentes'}</span>
              </button>
              {open && (
                <ul className="coc-st-frentes">
                  {frentes.map(([nome, f]) => (
                    <li key={nome}>
                      <div><span>{nome}</span><small>{f.n.pub + f.n.pronta}/{f.total}</small></div>
                      <Bar n={f.n} total={f.total} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <div className="sp-legend" style={{ marginTop: 12 }}>{BUCKETS.map((b) => <span key={b.k}><i className={`sw s-${b.k}`} />{b.label}</span>)}</div>
    </>
  );
}

/* ================= Datas comerciais ================= */
function Datas({ deadlines, canMark, isPriv, meId, onChanged, flash }: {
  deadlines: SocialPlanDeadline[]; canMark: boolean; isPriv: boolean; meId: string | null;
  onChanged: () => Promise<void> | void; flash: (m: string) => void;
}) {
  const hoje = todayISO();
  const [verTudo, setVerTudo] = useState(false);
  const [novo, setNovo] = useState(false);
  const [nm, setNm] = useState({ marco: '', dm: '', limite: addDays(hoje, 30), acao: '', resp: 'Digital' });
  const comData = deadlines.filter((d) => d.limite);
  const grupos = [...new Set(comData.map((d) => d.marco))]
    .map((marco) => ({ marco, ms: comData.filter((d) => d.marco === marco).sort((a, b) => a.limite!.localeCompare(b.limite!)) }))
    .sort((a, b) => a.ms[0].limite!.localeCompare(b.ms[0].limite!));
  // campanha encerrada = todas as etapas antes de hoje e feitas
  const encerrada = (g: { ms: SocialPlanDeadline[] }) => g.ms.every((m) => m.limite! < hoje && m.status === 'feito');
  const visiveis = verTudo ? grupos : grupos.filter((g) => !encerrada(g));

  const mark = async (d: SocialPlanDeadline) => {
    if (!canMark) return;
    const next = NEXT[(d.status ?? 'pendente') as keyof typeof NEXT];
    const { error } = await supabase.from('social_plan_deadlines').update({ status: next, status_by: meId, status_at: new Date().toISOString() }).eq('id', d.id);
    if (error) flash(error.message); else await onChanged();
  };
  const addMarco = async () => {
    if (!nm.marco.trim() || !nm.acao.trim() || !nm.limite) { flash('Preencha a data comercial, a ação e o dia limite.'); return; }
    const ord = Math.max(0, ...deadlines.map((d) => d.ord)) + 1;
    const { error } = await supabase.from('social_plan_deadlines').insert({ marco: nm.marco.trim(), dm: nm.dm.trim(), limite: nm.limite, acao: nm.acao.trim(), resp: nm.resp.trim(), ord });
    if (error) flash(error.message); else { flash('Marco adicionado.'); setNm((x) => ({ ...x, acao: '', dm: '' })); setNovo(false); await onChanged(); }
  };

  // linha do tempo
  const startYm = ymOf(hoje);
  const lastYm = comData.length ? ymOf(comData.map((d) => d.limite!).sort().slice(-1)[0]) : startYm;
  const months: string[] = [];
  for (let y = startYm; y <= lastYm && months.length < 8; y = addMonths(y, 1)) months.push(y);
  const t0 = parseYmd(`${months[0]}-01`).getTime();
  const t1 = parseYmd(`${addMonths(months[months.length - 1], 1)}-01`).getTime();
  const pos = (iso: string) => Math.max(0, Math.min(100, ((parseYmd(iso).getTime() - t0) / (t1 - t0)) * 100));

  return (
    <>
      <div className="coc-st-toolbar">
        <span className="sp-calhint" style={{ margin: 0 }}>{canMark ? 'Clique no selo para mudar: pendente → em andamento → feito.' : 'O gerente ou a diretoria marcam o andamento.'}</span>
        <div className="coc-st-tools">
          <button className="sp-clear" onClick={() => setVerTudo((v) => !v)}>{verTudo ? 'Esconder encerradas' : 'Mostrar encerradas'}</button>
          {isPriv && <button className="sp-ebtn" onClick={() => setNovo((v) => !v)}>{novo ? 'Cancelar' : '+ Novo marco'}</button>}
        </div>
      </div>
      {novo && (
        <div className="sp-adder" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,.5fr) minmax(0,.8fr) minmax(0,2fr) minmax(0,1fr) auto', marginBottom: 14 }}>
          <label className="sp-erow"><span>Data comercial</span><input id="nm-marco" list="sp-marcos" value={nm.marco} onChange={(e) => setNm((x) => ({ ...x, marco: e.target.value }))} />
            <datalist id="sp-marcos">{grupos.map((g) => <option key={g.marco} value={g.marco} />)}</datalist></label>
          <label className="sp-erow"><span>D-</span><input id="nm-dm" placeholder="D-20" value={nm.dm} onChange={(e) => setNm((x) => ({ ...x, dm: e.target.value }))} /></label>
          <label className="sp-erow"><span>Dia limite</span><input id="nm-lim" type="date" value={nm.limite} onChange={(e) => setNm((x) => ({ ...x, limite: e.target.value }))} /></label>
          <label className="sp-erow"><span>Ação</span><input id="nm-acao" value={nm.acao} onChange={(e) => setNm((x) => ({ ...x, acao: e.target.value }))} /></label>
          <label className="sp-erow"><span>Área</span><input id="nm-resp" value={nm.resp} onChange={(e) => setNm((x) => ({ ...x, resp: e.target.value }))} /></label>
          <button className="sp-ebtn prim" onClick={addMarco}>Adicionar</button>
        </div>
      )}
      <div className="coc-st-camps">
        {visiveis.map((g) => {
          const feitos = g.ms.filter((m) => m.status === 'feito').length;
          const prox = g.ms.find((m) => m.status !== 'feito');
          const [nome, quando] = g.marco.includes('(') ? [g.marco.replace(/\s*\(.*\)\s*$/, ''), g.marco.match(/\(([^)]*)\)/)?.[1] ?? ''] : [g.marco, ''];
          return (
            <section key={g.marco} className="coc-st-camp">
              <header>
                <div><b>{nome}</b>{quando && <small>{quando}</small>}</div>
                <span className="coc-st-camp-n">{feitos}/{g.ms.length}</span>
              </header>
              <ol>
                {g.ms.map((m) => {
                  const st = (m.status ?? 'pendente') as keyof typeof ST_LABEL;
                  const atrasado = m.limite! < hoje && st !== 'feito';
                  return (
                    <li key={m.id} className={`${st} ${m === prox ? 'next' : ''}`}>
                      <span className="coc-st-when"><b>{brShort(m.limite!)}</b><small>{m.dm}</small></span>
                      <span className="coc-st-what">{m.acao}<small>{m.resp}</small></span>
                      <button type="button" className={`coc-st-badge ${st} ${atrasado ? 'late' : ''}`} disabled={!canMark} onClick={() => mark(m)}>
                        {atrasado && st === 'pendente' ? 'Atrasado' : ST_LABEL[st]}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
        {!visiveis.length && <Vazio texto="Nenhuma data comercial em aberto." />}
      </div>

      <section className="sp-box" style={{ marginTop: 14 }}>
        <h3>Linha do tempo <small>cada losango é uma etapa · a linha vermelha é hoje</small></h3>
        <div className="sp-gantt">
          <div className="sp-gtable" style={{ gridTemplateColumns: `220px repeat(${months.length}, minmax(0, 1fr))` }}>
            <div className="sp-gh">Data comercial</div>
            {months.map((m) => <div className="sp-gh" key={m}>{MES_ABREV[Number(m.slice(5)) - 1]}/{m.slice(2, 4)}</div>)}
            {visiveis.map((g) => {
              const a0 = g.ms[0].limite!, a1 = g.ms[g.ms.length - 1].limite!;
              return (
                <div key={g.marco} style={{ display: 'contents' }}>
                  <div className="sp-glabel">{g.marco.replace(/\s*\(.*\)\s*$/, '')}</div>
                  <div className="sp-gtrack" style={{ gridColumn: `2 / span ${months.length}` }}>
                    <span className="sp-gspan" style={{ left: `${pos(a0)}%`, width: `${Math.max(0, pos(a1) - pos(a0))}%` }} />
                    {g.ms.map((m) => <span key={m.id} className={`sp-gms ${m.status === 'feito' ? 'done' : area(m.resp)}`} style={{ left: `${pos(m.limite!)}%` }} title={`${brShort(m.limite!)} · ${m.acao}`} />)}
                    <span className="sp-gtoday" style={{ left: `${pos(hoje)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="sp-legend"><span><i className="sw g-dig" />Digital</span><span><i className="sw g-com" />Comercial</span><span><i className="sw g-mix" />Áreas juntas</span><span><i className="sw g-done" />Feito</span></div>
      </section>
    </>
  );
}

/* ================= Guia das marcas ================= */
function Guia({ notes }: { notes: SocialStrategyNote[] }) {
  const [b, setB] = useState<(typeof BRANDS)[number]>('Playmi');
  const guia = notes.filter((n) => n.section === 'guia' && n.brand === b).sort((x, y) => x.ord - y.ord);
  const formatos = notes.filter((n) => n.section === 'formato').sort((x, y) => x.ord - y.ord);
  if (!notes.some((n) => n.section === 'guia')) return <Vazio texto="O guia das marcas ainda não foi carregado." />;
  const val = (item: string) => guia.find((n) => n.item === item)?.value ?? '';
  const outros = guia.filter((n) => !['Tipografia', 'Paleta'].includes(n.item));
  return (
    <>
      <div className="sp-gates" role="tablist" style={{ marginBottom: 14 }}>
        {BRANDS.map((x) => <button key={x} role="tab" aria-selected={b === x} onClick={() => setB(x)}>{x}</button>)}
      </div>
      <div className="coc-st-guide">
        <section className={`coc-st-brand b-${slug(b)}`}>
          <h3>{b}</h3>
          <dl className="coc-st-dl">{outros.map((n) => <div key={n.ext_key}><dt>{n.item}</dt><dd>{n.value}</dd></div>)}</dl>
        </section>
        <aside className="coc-st-visual">
          {val('Paleta') && (
            <>
              <h4>Paleta</h4>
              <div className="coc-st-swatches">
                {swatches(val('Paleta')).map((s) => <div key={s.hex}><span style={{ background: s.hex }} /><b>{s.nome}</b><small>{s.hex.toUpperCase()}</small></div>)}
              </div>
              {/cores das linhas/i.test(val('Paleta')) && <p className="sp-calhint">Cores das linhas conforme o guia da marca.</p>}
            </>
          )}
          {val('Tipografia') && (
            <>
              <h4>Tipografia</h4>
              <div className="coc-st-type">{val('Tipografia').split('·').map((s) => <span key={s}>{s.trim()}</span>)}</div>
            </>
          )}
        </aside>
      </div>
      {formatos.length > 0 && (
        <section className="sp-box" style={{ marginTop: 14 }}>
          <h3>Formatos e medidas <small>valem para as três marcas</small></h3>
          <div className="coc-st-formats">
            {formatos.map((n) => <div key={n.ext_key}><b>{n.item}</b><span>{n.value}</span><small>{n.note}</small></div>)}
          </div>
        </section>
      )}
    </>
  );
}

/* ================= Pendências ================= */
function Pendencias({ pend, canMark, meId, onChanged, flash }: {
  pend: SocialStrategyNote[]; canMark: boolean; meId: string | null; onChanged: () => Promise<void> | void; flash: (m: string) => void;
}) {
  const toggle = async (n: SocialStrategyNote) => {
    const { error } = await supabase.from('social_strategy_notes').update({ done: !n.done, updated_by: meId, updated_at: new Date().toISOString() }).eq('ext_key', n.ext_key);
    if (error) flash(error.message); else await onChanged();
  };
  if (!pend.length) return <Vazio texto="Nenhuma pendência." />;
  const ordem = [...pend.filter((n) => !n.done), ...pend.filter((n) => n.done)];
  return (
    <section className="sp-box coc-st-pend">
      <h3>Pendências <small>{pend.filter((n) => !n.done).length} em aberto de {pend.length}</small></h3>
      {ordem.map((n) => {
        const [quem, ...resto] = n.value.split(':');
        const temQuem = resto.length > 0 && quem.length < 40;
        return (
          <label key={n.ext_key} className={`coc-pend ${n.done ? 'done' : ''}`}>
            <input type="checkbox" checked={n.done} disabled={!canMark} onChange={() => toggle(n)} />
            <span>{temQuem ? <><b>{quem}</b>{resto.join(':')}</> : n.value}</span>
          </label>
        );
      })}
      {!canMark && <p className="sp-calhint">O gerente ou a diretoria marcam o que foi resolvido.</p>}
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div className="sp-empty"><b>{texto}</b>Ela entra com a importação do plano.</div>;
}
