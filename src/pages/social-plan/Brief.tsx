import { useState } from 'react';
import type { SocialStrategyNote } from '../../types/database';

/* Briefing de arte de cada assunto (social_topics.brief) e o guia da marca ao lado.
 * Os campos vêm da aba "Briefing de arte" da planilha do plano. */

export const BRIEF_GROUPS: { title: string; fields: [string, string][] }[] = [
  { title: 'A peça', fields: [['formato_medida', 'Formato e medida'], ['material_base', 'Material base (Drive)'], ['material_status', 'Situação do material'], ['texto_arte', 'Texto na arte'], ['derivadas', 'Artes derivadas a produzir']] },
  { title: 'Por que e para quem', fields: [['meta', 'O que queremos atingir'], ['medicao', 'Como saber se funcionou'], ['porque', 'Por que este post agora'], ['estrategia', 'Estratégia usada'], ['publico', 'Público']] },
  { title: 'Criação', fields: [['mensagem', 'Mensagem-chave'], ['gancho', 'Gancho (3 primeiros segundos / capa)'], ['estrutura', 'Estrutura (roteiro ou cards)'], ['direcao_visual', 'Direção visual'], ['obrigatorio_evitar', 'Obrigatório / evitar']] },
  { title: 'Prazos para a aprovação', fields: [['prazo_pauta', 'Pauta + legenda'], ['prazo_criativo', 'Criativo'], ['prazo_obs', 'Observação do prazo']] },
];
export const BRIEF_ETAPA1 = ['meta', 'porque', 'estrategia', 'publico', 'mensagem'];
export const BRIEF_ETAPA2 = ['formato_medida', 'texto_arte', 'gancho', 'estrutura', 'direcao_visual', 'obrigatorio_evitar', 'derivadas'];
const LABEL = Object.fromEntries(BRIEF_GROUPS.flatMap((g) => g.fields));

/** Texto com link do Drive clicável (o material base vem como "descrição · https://…"). */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return <>{parts.map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} className="sp-linkbtn" href={p} target="_blank" rel="noreferrer">abrir no Drive ↗</a> : <span key={i}>{p}</span>))}</>;
}

/** Leitura compacta de alguns campos (aprovação e painel da peça). */
export function BriefRead({ brief, keys, title = 'Briefing de arte' }: { brief?: Record<string, string>; keys?: string[]; title?: string }) {
  const ks = (keys ?? BRIEF_GROUPS.flatMap((g) => g.fields.map(([k]) => k))).filter((k) => brief?.[k]);
  if (!ks.length) return null;
  return (
    <div className="coc-brief-read">
      <h4 className="sp-sech" style={{ margin: '14px 0 6px' }}>{title}</h4>
      <dl className="sp-kv">
        {ks.map((k) => <div key={k} style={{ display: 'contents' }}><dt>{LABEL[k]}</dt><dd className="coc-pre"><Linkify text={brief![k]} /></dd></div>)}
      </dl>
    </div>
  );
}

/** Editor do briefing dentro do assunto. */
export function BriefEditor({ brief, onChange }: { brief: Record<string, string>; onChange: (b: Record<string, string>) => void }) {
  const [open, setOpen] = useState(true);
  const filled = Object.values(brief).filter(Boolean).length;
  return (
    <section className="coc-brief">
      <button type="button" className="coc-fold" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <b>Briefing de arte</b><span>{filled ? `${filled} campos preenchidos` : 'vazio'} · {open ? 'recolher' : 'abrir'}</span>
      </button>
      {open && BRIEF_GROUPS.map((g) => (
        <div key={g.title} className="coc-brief-group">
          <h5>{g.title}</h5>
          <div className="coc-brief-grid">
            {g.fields.map(([k, l]) => (
              <label key={k} className={`sp-erow ${['estrutura', 'direcao_visual', 'obrigatorio_evitar', 'derivadas', 'material_base'].includes(k) ? 'wide' : ''}`}>
                <span>{l}</span>
                <textarea id={`br-${k}`} rows={k === 'estrutura' ? 4 : 2} value={brief[k] ?? ''} onChange={(e) => onChange({ ...brief, [k]: e.target.value })} />
              </label>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Guia da marca (público, tom, tipografia, paleta, assinatura, regras) + formatos e medidas. */
export function BrandGuide({ brand, notes, defaultOpen = false }: { brand: string; notes: SocialStrategyNote[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const guia = notes.filter((n) => n.section === 'guia' && n.brand === brand).sort((a, b) => a.ord - b.ord);
  const formatos = notes.filter((n) => n.section === 'formato').sort((a, b) => a.ord - b.ord);
  if (!guia.length && !formatos.length) return null;
  return (
    <section className="coc-brief">
      <button type="button" className="coc-fold" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <b>Guia da marca {brand}</b><span>público, tom, tipografia, paleta e formatos · {open ? 'recolher' : 'abrir'}</span>
      </button>
      {open && (
        <>
          <dl className="sp-kv" style={{ marginTop: 8 }}>{guia.map((n) => <div key={n.ext_key} style={{ display: 'contents' }}><dt>{n.item}</dt><dd>{n.value}</dd></div>)}</dl>
          {formatos.length > 0 && (
            <table className="coc-ftable"><thead><tr><th>Formato</th><th>Medida</th><th>Observação</th></tr></thead>
              <tbody>{formatos.map((n) => <tr key={n.ext_key}><td>{n.item}</td><td>{n.value}</td><td>{n.note}</td></tr>)}</tbody></table>
          )}
        </>
      )}
    </section>
  );
}
