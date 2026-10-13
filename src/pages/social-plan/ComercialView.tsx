import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { normalizeUrl } from '../../lib/url';
import { useThumbs } from '../../lib/thumbs';
import type { CommercialBanner, ContentMaterial, ContentTaskBoardRow, Profile, SocialPlanDeadline } from '../../types/database';
import { addDays, brShort, driveThumb, todayISO } from './shared';
import { KINDS, MST } from './MateriaisView';
import type { ProductLite } from './useCommercial';

/* Área comercial. Visão 1: minhas demandas (banners e materiais, do pedido à liberação).
 * Visão 2: o cenário final, só com o que está pronto, como o cliente vai ver. */

// cores dos selos, iguais ao desenho do Portal Cardoso (são conteúdo da arte, não tema da tela)
const SELOS: Record<CommercialBanner['seal'], { chipBg: string; chipFg: string; bg: string; fg: string; fg2: string; ctaBg: string; ctaFg: string }> = {
  'CAMPANHA': { chipBg: '#FDECEA', chipFg: '#C8231A', bg: '#F5EFE4', fg: '#2E2B2C', fg2: '#7A7476', ctaBg: '#EE3124', ctaFg: '#FFFFFF' },
  'LANÇAMENTO': { chipBg: '#FFFFFF', chipFg: '#C8231A', bg: '#EE3124', fg: '#FFFFFF', fg2: 'rgba(255,255,255,.88)', ctaBg: '#FFFFFF', ctaFg: '#C8231A' },
  'AVISO COMERCIAL': { chipBg: '#FFF6E8', chipFg: '#9A6B16', bg: '#E4EEF2', fg: '#2E2B2C', fg2: '#6A7A82', ctaBg: '#25507E', ctaFg: '#FFFFFF' },
  'CLUBE CARDOSO': { chipBg: '#FFFFFF', chipFg: '#5B4680', bg: '#EDE8F3', fg: '#2E2B2C', fg2: '#6E6480', ctaBg: '#5B4680', ctaFg: '#FFFFFF' },
};

export function BannerArt({ b, big }: { b: Pick<CommercialBanner, 'seal' | 'title' | 'subtitle' | 'cta' | 'art_url'>; big?: boolean }) {
  const s = SELOS[b.seal];
  const img = driveThumb(b.art_url);
  return (
    <div className={`sp-bn ${big ? 'big' : ''}`} style={{ background: s.bg, color: s.fg }}>
      {img && <img className="sp-bn-img" src={img} alt="" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
      <span className="sp-bn-chip" style={{ background: s.chipBg, color: s.chipFg }}>{b.seal}</span>
      <span className="sp-bn-t">{b.title || 'Título do banner'}</span>
      {b.subtitle && <span className="sp-bn-s" style={{ color: s.fg2 }}>{b.subtitle}</span>}
      <span className="sp-bn-cta" style={{ background: s.ctaBg, color: s.ctaFg }}>{b.cta || 'Botão'}</span>
    </div>
  );
}

type Col = 'afazer' | 'producao' | 'aguardando' | 'pronto';
const COLS: [Col, string][] = [['afazer', 'A fazer'], ['producao', 'Em produção'], ['aguardando', 'Aguardando liberação'], ['pronto', 'Pronto']];

export default function ComercialView({ materials, banners, board, products, profiles, deadlines, canRelease, error, onChanged }: {
  materials: ContentMaterial[];
  banners: CommercialBanner[];
  board: Map<string, ContentTaskBoardRow>;
  products: ProductLite[];
  profiles: Profile[];
  deadlines: SocialPlanDeadline[];
  canRelease: boolean;
  error: string;
  onChanged: () => Promise<void> | void;
}) {
  const [vis, setVis] = useState<1 | 2>(1);
  return (
    <div className="sp-com">
      {error && <div className="sp-err">{error}</div>}
      <div className="sp-gates" role="tablist">
        <button role="tab" aria-selected={vis === 1} onClick={() => setVis(1)}>Visão 1 · Minhas demandas</button>
        <button role="tab" aria-selected={vis === 2} onClick={() => setVis(2)}>Visão 2 · Cenário final</button>
      </div>
      {vis === 1
        ? <Demandas materials={materials} banners={banners} board={board} products={products} profiles={profiles} deadlines={deadlines} canRelease={canRelease} onChanged={onChanged} />
        : <CenarioFinal materials={materials} banners={banners} products={products} deadlines={deadlines} />}
    </div>
  );
}

function bannerCol(b: CommercialBanner, board: Map<string, ContentTaskBoardRow>): Col {
  if (b.released) return 'pronto';
  const t = b.task_id ? board.get(b.task_id) : null;
  if (b.art_url || t?.is_final) return 'aguardando';
  if (t && (t.stage_position ?? 0) > 1) return 'producao';
  return 'afazer';
}
const matCol: Record<ContentMaterial['status'], Col> = { pedido: 'afazer', producao: 'producao', aguardando: 'aguardando', liberado: 'pronto' };

function Demandas({ materials, banners, board, products, profiles, deadlines, canRelease, onChanged }: {
  materials: ContentMaterial[]; banners: CommercialBanner[]; board: Map<string, ContentTaskBoardRow>; products: ProductLite[];
  profiles: Profile[]; deadlines: SocialPlanDeadline[]; canRelease: boolean; onChanged: () => Promise<void> | void;
}) {
  const hoje = todayISO();
  const [f, setF] = useState({ seal: 'CAMPANHA' as CommercialBanner['seal'], title: '', subtitle: '', cta: '', cta_link: '', starts: addDays(hoje, 21), ends: addDays(hoje, 42), marco: '', owner: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [art, setArt] = useState<{ id: string; url: string } | null>(null);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg((c) => (c === m ? '' : c)), 3500); };
  const marcos = [...new Set(deadlines.map((d) => d.marco))];
  const active = profiles.filter((p) => !p.disabled);
  const prodById = new Map(products.map((p) => [p.id, p]));

  const reserve = async () => {
    if (!f.title.trim()) { flash('Escreva o título do banner.'); return; }
    if (f.starts < addDays(hoje, 10)) { flash('A entrada no ar precisa estar a pelo menos 10 dias de hoje, para caber as aprovações.'); return; }
    if (!f.owner) { flash('Escolha quem faz a arte.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('reserve_commercial_banner', {
      p_seal: f.seal, p_title: f.title.trim(), p_subtitle: f.subtitle.trim(), p_cta: f.cta.trim(), p_cta_link: f.cta_link.trim(),
      p_starts: f.starts, p_ends: f.ends, p_marco: f.marco, p_owner: f.owner,
    });
    setBusy(false);
    if (error) { flash(error.message); return; }
    const quem = active.find((p) => p.id === f.owner)?.name ?? 'o responsável';
    flash(`Banner reservado. Demanda criada para ${quem}, entrega até ${brShort(addDays(f.starts, -10))}.`);
    setF((x) => ({ ...x, title: '', subtitle: '', cta: '', cta_link: '' }));
    await onChanged();
  };
  const update = async (id: string, patch: Partial<CommercialBanner>, ok: string) => {
    setBusy(true);
    const { error } = await supabase.from('commercial_banners').update(patch).eq('id', id);
    setBusy(false);
    if (error) { flash(error.message); return false; }
    flash(ok); await onChanged(); return true;
  };
  const releaseMat = async (m: ContentMaterial) => {
    const { error } = await supabase.from('content_materials').update({ status: 'liberado' }).eq('id', m.id);
    if (error) flash(error.message); else { flash('Material liberado.'); await onChanged(); }
  };

  const cards: Record<Col, React.ReactNode[]> = { afazer: [], producao: [], aguardando: [], pronto: [] };
  banners.forEach((b) => {
    const t = b.task_id ? board.get(b.task_id) : null;
    const late = !b.released && !b.art_url && t?.due_date && t.due_date < hoje;
    cards[bannerCol(b, board)].push(
      <div className="sp-kc" key={b.id}>
        <span className="sp-state t-sky">Banner</span>
        <b>{b.title}</b>
        <span>No ar de {brShort(b.starts_on)} a {brShort(b.ends_on)}{b.marco ? ` · ${b.marco}` : ''}</span>
        <span className={late ? 'late' : ''}>Demanda de arte{t ? ` · ${t.stage_name ?? '—'}` : ''}{t?.assignee_name ? ` · ${t.assignee_name}` : ''}{t?.due_date ? ` · entrega até ${brShort(t.due_date)}` : ''}</span>
        <div className="sp-kc-mini"><BannerArt b={b} /></div>
        {art?.id === b.id ? (
          <div className="sp-linkfor">
            <input id={`art-${b.id}`} autoFocus placeholder="Link da arte final no Drive" value={art.url} onChange={(e) => setArt({ id: b.id, url: e.target.value })} />
            <button className="sp-ebtn prim" disabled={busy || !art.url.trim()} onClick={async () => { if (await update(b.id, { art_url: normalizeUrl(art.url.trim()) }, 'Arte anexada. Esperando liberação.')) setArt(null); }}>Salvar</button>
            <button className="sp-ebtn" onClick={() => setArt(null)}>Cancelar</button>
          </div>
        ) : (
          <div className="sp-cacts">
            {b.task_id && <a className="sp-ebtn" href={`/demandas?task=${b.task_id}`}>Demanda</a>}
            {!b.released && <button className="sp-ebtn" onClick={() => setArt({ id: b.id, url: b.art_url })}>{b.art_url ? 'Trocar arte' : 'Colar arte do Drive'}</button>}
            {!b.released && b.art_url && canRelease && <button className="sp-ebtn prim" disabled={busy} onClick={() => update(b.id, { released: true }, 'Banner liberado. Entra no ar na data marcada.')}>Liberar banner</button>}
            {b.released && canRelease && <button className="sp-ebtn" disabled={busy} onClick={() => update(b.id, { released: false }, 'Liberação desfeita.')}>Desfazer liberação</button>}
          </div>
        )}
      </div>,
    );
  });
  materials.forEach((m) => {
    const p = m.product_id ? prodById.get(m.product_id) : null;
    cards[matCol[m.status]].push(
      <div className="sp-kc" key={m.id}>
        <span className="sp-state">{KINDS.find((k) => k.k === m.kind)?.label}</span>
        <b>{p ? `${p.code} · ${p.name}` : m.subject}</b>
        <span>{m.name}</span>
        <div className="sp-cacts">
          {m.drive_url && <a className="sp-ebtn" href={m.drive_url} target="_blank" rel="noreferrer">Drive</a>}
          {m.status === 'aguardando' && canRelease && <button className="sp-ebtn prim" onClick={() => releaseMat(m)}>Liberar</button>}
          {m.status !== 'aguardando' && m.status !== 'liberado' && <span className="sp-state">{MST[m.status].label}</span>}
        </div>
      </div>,
    );
  });

  return (
    <>
      <section className="sp-box">
        <h3>Reservar banner <small>reservar já cria a demanda de arte nas Demandas, com entrega 10 dias antes de entrar no ar</small></h3>
        <div className="sp-bnform">
          <label className="sp-erow"><span>Selo</span>
            <select id="bn-seal" value={f.seal} onChange={(e) => setF((x) => ({ ...x, seal: e.target.value as CommercialBanner['seal'] }))}>
              {(Object.keys(SELOS) as CommercialBanner['seal'][]).map((s) => <option key={s}>{s}</option>)}
            </select></label>
          <label className="sp-erow"><span>Entra no ar</span><input id="bn-de" type="date" min={addDays(hoje, 10)} value={f.starts} onChange={(e) => setF((x) => ({ ...x, starts: e.target.value }))} /></label>
          <label className="sp-erow"><span>Sai do ar</span><input id="bn-ate" type="date" min={f.starts} value={f.ends} onChange={(e) => setF((x) => ({ ...x, ends: e.target.value }))} /></label>
          <label className="sp-erow full"><span>Título</span><input id="bn-tit" placeholder="Ex.: Kit de Black Friday no portal" value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} /></label>
          <label className="sp-erow full"><span>Subtítulo</span><input id="bn-sub" placeholder="Uma frase sobre o que o lojista encontra" value={f.subtitle} onChange={(e) => setF((x) => ({ ...x, subtitle: e.target.value }))} /></label>
          <label className="sp-erow"><span>Botão</span><input id="bn-cta" placeholder="Baixar o kit" value={f.cta} onChange={(e) => setF((x) => ({ ...x, cta: e.target.value }))} /></label>
          <label className="sp-erow"><span>Responsável pela arte</span>
            <select id="bn-owner" value={f.owner} onChange={(e) => setF((x) => ({ ...x, owner: e.target.value }))}>
              <option value="">Escolha</option>{active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          <label className="sp-erow"><span>Marco comercial</span>
            <select id="bn-marco" value={f.marco} onChange={(e) => setF((x) => ({ ...x, marco: e.target.value }))}>
              <option value="">Nenhum</option>{marcos.map((m) => <option key={m}>{m}</option>)}
            </select></label>
        </div>
        <div className="sp-bnprev"><BannerArt b={{ seal: f.seal, title: f.title, subtitle: f.subtitle, cta: f.cta, art_url: '' }} /></div>
        <p className="sp-inherit">Entrega da arte até <b>{brShort(addDays(f.starts, -10))}</b>. A data de entrada no ar não pode ficar a menos de 10 dias de hoje.</p>
        <button className="sp-ebtn prim" disabled={busy} onClick={reserve}>Reservar e criar demanda</button>
        {msg && <div className="sp-saved">{msg}</div>}
      </section>
      <div className="sp-kb">
        {COLS.map(([k, l]) => (
          <div className="sp-kcol" key={k}>
            <h4>{l}<b>{cards[k].length}</b></h4>
            {cards[k].length ? cards[k] : <span className="sp-wempty">Nada aqui</span>}
          </div>
        ))}
      </div>
    </>
  );
}

function CenarioFinal({ materials, banners, products, deadlines }: {
  materials: ContentMaterial[]; banners: CommercialBanner[]; products: ProductLite[]; deadlines: SocialPlanDeadline[];
}) {
  const hoje = todayISO();
  const thumb = useThumbs();
  const [quando, setQuando] = useState(hoje);
  const [bi, setBi] = useState(0);
  const proxMarcos = deadlines.filter((d) => d.limite && d.limite > hoje && d.dm === 'D0').slice(0, 3);
  const bs = banners.filter((b) => b.released && b.starts_on <= quando && b.ends_on >= quando);
  const cur = bs[Math.min(bi, Math.max(0, bs.length - 1))];
  const lib = materials.filter((m) => m.status === 'liberado');
  const byProd = new Map<string, ContentMaterial[]>();
  lib.forEach((m) => { const k = m.product_id ?? `s:${m.subject}`; (byProd.get(k) ?? byProd.set(k, []).get(k)!).push(m); });
  const prodById = new Map(products.map((p) => [p.id, p]));
  return (
    <>
      <div className="sp-frow" style={{ marginBottom: 12, alignItems: 'center' }}>
        <span className="sp-flabel">Ver como estará em</span>
        <div className="sp-chips">
          <button className="sp-chip" aria-pressed={quando === hoje} onClick={() => { setQuando(hoje); setBi(0); }}>Hoje</button>
          {proxMarcos.map((m) => <button key={m.id} className="sp-chip" aria-pressed={quando === m.limite} onClick={() => { setQuando(m.limite!); setBi(0); }}>{m.marco} · {brShort(m.limite!)}</button>)}
        </div>
        <input type="date" id="cf-date" value={quando} onChange={(e) => { setQuando(e.target.value || hoje); setBi(0); }} />
      </div>
      <div className="sp-portal">
        <div className="sp-pt-top"><b>Cardoso</b><span>Início · Área comercial · Conteúdos</span></div>
        {cur ? (
          <div className="sp-pt-hero">
            <BannerArt b={cur} big />
            {bs.length > 1 && <div className="sp-pt-dots">{bs.map((b, i) => <button key={b.id} aria-label={`Banner ${i + 1}`} aria-pressed={b.id === cur.id} onClick={() => setBi(i)} />)}</div>}
          </div>
        ) : <div className="sp-pt-empty">Nenhum banner liberado no ar em {brShort(quando)}.</div>}
        <h4 className="sp-sech" style={{ margin: '4px 0 0' }}>Conteúdos</h4>
        {byProd.size ? (
          <div className="sp-pt-grid">
            {[...byProd.entries()].map(([k, ms]) => {
              const p = k.startsWith('s:') ? null : prodById.get(k);
              const img = p?.image_url ? thumb(p.image_url) : '';
              return (
                <div className="sp-pt-card" key={k}>
                  <div className="sp-pt-img">{img ? <img loading="lazy" decoding="async" src={img} alt="" /> : <span>{p?.brand ?? ms[0].brand}</span>}</div>
                  <div className="sp-pt-b">
                    <span className="sp-pt-ref">{p ? `REF ${p.code}` : 'Campanha'}</span>
                    <b>{p ? p.name : k.slice(2)}</b>
                    <span className="sp-pt-f">{[...new Set(ms.map((m) => KINDS.find((x) => x.k === m.kind)?.label))].join(' · ')}</span>
                    <span className="sp-pt-btn">Baixar tudo</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="sp-pt-empty">Nenhum material liberado ainda.</div>}
      </div>
      <p className="sp-inherit" style={{ marginTop: 10 }}>O cenário final esconde o que está pedido, em produção ou esperando liberação. Banner só aparece no período em que está no ar; material, depois de liberado. O link sem login para quem está fora do Hub vem na próxima fase.</p>
    </>
  );
}
