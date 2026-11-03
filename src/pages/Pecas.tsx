import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFinalData } from './social-plan/useFinalData';
import type { FinalPiece } from './social-plan/FinalBoard';
import { DOW, addMonths, brShort, dowIndex, monthName, slug, todayISO, ymOf } from './social-plan/shared';

/* Peças aprovadas para baixar — pública (sem login), aberta por link com token (um para o Comercial, outro para o Marketing).
 * Lê a mesma final_view da Visão final e baixa cada arquivo pela função drive-baixar, que confere o token e se
 * o arquivo é mesmo arte de peça aprovada. Uma arte que vai para vários lugares (feed, Stories, Status) aparece uma vez só. */

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-baixar`;
const fileId = (url: string | null | undefined) =>
  url?.match(/\/d\/([\w-]{20,})/)?.[1] ?? url?.match(/[?&]id=([\w-]{20,})/)?.[1] ?? null;
const vertical = (p: FinalPiece) => /Stories|Reels|Shorts|Vídeo|TikTok|Status/.test(`${p.format} ${p.channel}`);
const stageLabel = (s: string) => (s === 'publicado' ? 'Publicada' : s === 'agendado' ? 'Agendada' : 'Aprovada');

type Peca = { key: string; first: FinalPiece; onde: string[]; files: string[]; pasta: string | null };

export default function Pecas() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const [month, setMonth] = useState(() => ymOf(todayISO()));
  const [marca, setMarca] = useState('Todas');
  const { data, state } = useFinalData(token, month);
  const link = (id: string, mini = false) => `${FN}?t=${encodeURIComponent(token)}&id=${id}${mini ? '&modo=miniatura' : ''}`;

  // junta os destinos que usam a mesma arte
  const pecas = useMemo(() => {
    const by = new Map<string, Peca>();
    (data?.pieces ?? []).forEach((p) => {
      if (!p.creative) return;
      const lam = (p.slides?.length ? p.slides : [p.creative]).map(fileId).filter((x): x is string => !!x);
      const key = lam.join('|') || p.creative;
      const onde = `${p.channel}${p.format ? ` · ${p.format}` : ''}${p.mirror_facebook ? ' + Facebook' : ''}`;
      const cur = by.get(key);
      if (cur) { if (!cur.onde.includes(onde)) cur.onde.push(onde); return; }
      by.set(key, { key, first: p, onde: [onde], files: lam, pasta: lam.length ? null : p.creative });
    });
    return [...by.values()];
  }, [data]);
  const marcas = ['Todas', ...new Set(pecas.map((x) => x.first.brand))];
  const vis = pecas.filter((x) => marca === 'Todas' || x.first.brand === marca);
  const dias = [...new Set(vis.map((x) => x.first.date))].sort();

  return (
    <div className="sp sp-public">
      <header className="sp-pub-head">
        <div className="sp-pub-logo">C</div>
        <div><small>Cardoso · Peças aprovadas</small><b>Para baixar{data?.label ? ` · ${data.label}` : ''}</b></div>
      </header>
      <main className="sp-main pc-main">
        {state === 'loading' && <p className="sp-calhint">Carregando…</p>}
        {state === 'invalid' && (
          <div className="sp-empty"><b>Este link não abre</b>Ele pode ter sido desativado. Peça um link novo ao Marketing.</div>
        )}
        {state === 'ok' && data && (
          <>
            <div className="pc-bar">
              <div className="sp-calnav">
                <button type="button" className="sp-ebtn" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
                <b className="sp-final-month">{monthName(month)}</b>
                <button type="button" className="sp-ebtn" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}>›</button>
              </div>
              {marcas.length > 2 && (
                <div className="sp-chips">
                  {marcas.map((m) => <button type="button" key={m} className="sp-chip" data-v={m} aria-pressed={marca === m} onClick={() => setMarca(m)}>{m}</button>)}
                </div>
              )}
            </div>
            {!dias.length && <div className="sp-empty"><b>Nada aprovado neste mês ainda</b>As peças aparecem aqui assim que passam pela aprovação.</div>}
            {dias.map((d) => (
              <section key={d} className="pc-day">
                <h3 className="pc-dayh">{DOW[dowIndex(d)]}<span>{brShort(d)}</span></h3>
                <div className="pc-grid">
                  {vis.filter((x) => x.first.date === d).map((x) => <Card key={x.key} x={x} link={link} />)}
                </div>
              </section>
            ))}
          </>
        )}
        <p className="sp-calhint" style={{ marginTop: 18 }}>Aqui aparece só o que já foi aprovado. Os arquivos vêm direto do Drive da Cardoso.</p>
      </main>
    </div>
  );
}

function Card({ x, link }: { x: Peca; link: (id: string, mini?: boolean) => string }) {
  const p = x.first;
  const [copiou, setCopiou] = useState(false);
  const [aberta, setAberta] = useState(false);
  const capa = x.files[0];
  const copiar = () => {
    if (!p.caption) return;
    navigator.clipboard?.writeText(p.caption).then(() => { setCopiou(true); setTimeout(() => setCopiou(false), 1800); });
  };
  // várias lâminas: um download por vez, com folga para o navegador não bloquear
  const baixarTodas = () => x.files.forEach((id, i) => setTimeout(() => {
    const a = document.createElement('a'); a.href = link(id); a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  }, i * 900));
  return (
    <article className={`pc-card b-${slug(p.brand)}`}>
      <div className={`pc-art ${vertical(p) ? 'v' : 'q'}`}>
        {capa && <img src={link(capa, true)} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
        <span className="pc-brand">{p.brand}</span>
        {x.files.length > 1 && <span className="pc-count">{x.files.length} {vertical(p) ? 'telas' : 'lâminas'}</span>}
      </div>
      <div className="pc-b">
        <b className="pc-t">{p.product || p.title}</b>
        <span className="pc-onde">{x.onde.join(' · ')}</span>
        <span className="pc-when">{p.time ? `${p.time} · ` : ''}{stageLabel(p.stage)}</span>
        <div className="pc-acts">
          {x.files.length === 1 && <a className="pc-btn" href={link(x.files[0])}>Baixar</a>}
          {x.files.length > 1 && <button type="button" className="pc-btn" onClick={baixarTodas}>Baixar as {x.files.length}</button>}
          {p.caption && <button type="button" className="pc-btn ghost" onClick={copiar}>{copiou ? 'Copiada ✓' : 'Copiar legenda'}</button>}
        </div>
        {x.files.length > 1 && (
          <div className="pc-lams">{x.files.map((id, i) => <a key={id} href={link(id)} title={`Baixar a lâmina ${i + 1}`}>{i + 1}</a>)}</div>
        )}
        {x.pasta && <span className="pc-note">A arte está numa pasta do Drive. Peça o arquivo ao Marketing.</span>}
        {p.caption && (
          <button type="button" className={`pc-cap ${aberta ? 'on' : ''}`} onClick={() => setAberta(!aberta)} aria-expanded={aberta}>
            {p.caption}
          </button>
        )}
      </div>
    </article>
  );
}
