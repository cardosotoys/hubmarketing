import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/activityLog';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import ProductCombobox from '../components/ProductCombobox';
import type { Brand, Profile, Product } from '../types/database';

type Gate = 'conteudo' | 'arte' | 'mlabs';
type Stage = 'planejamento' | 'producao' | 'aprov_arte' | 'mlabs' | 'publicado' | 'acompanhamento' | 'aprov_conteudo' | 'lojistas';
const STAGES: { key: Stage; label: string; icon: string; gate?: Gate }[] = [
  { key: 'planejamento', label: 'Planejamento', icon: '📝', gate: 'conteudo' },
  { key: 'producao', label: 'Produção', icon: '🎬' },
  { key: 'mlabs', label: 'mLabs', icon: '📤', gate: 'mlabs' },
  { key: 'publicado', label: 'Publicado', icon: '✅' },
  { key: 'acompanhamento', label: 'Acompanhamento', icon: '🏬' },
];
const CHANNELS = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'LinkedIn', 'Kwai', 'Pinterest'];
const FORMATS = ['Feed', 'Story', 'Reels', 'Carrossel', 'Vídeo', 'Live', 'Pin'];
const nextStage = (s: Stage): Stage => STAGES[Math.min(STAGES.length - 1, STAGES.findIndex((x) => x.key === s) + 1)].key;
const prevWork = (gate: Gate): Stage => (gate === 'mlabs' ? 'producao' : 'planejamento');
const fmtDate = (s: string | null) => (s ? s.split('-').reverse().join('/') : '—');

type Content = { id: string; title: string; brand_id: string | null; channel: string; format: string; scheduled_date: string | null; copy: string; stage: Stage; mlabs_url: string; post_url: string; drive_url: string; created_by: string | null; position: number; tipo: string; pilar: string; campaign: string; block: string; product: string; objective: string; cta: string; media_use: string; line_axis: string; product_id: string | null };
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
type Media = { id: string; content_id: string; url: string; path: string; type: string; name: string };
type Approval = { id: string; content_id: string; gate: Gate; approver_id: string; decision: 'pendente' | 'aprovado' | 'alteracao'; note: string };
type Comment = { id: string; content_id: string; author_id: string; body: string; created_at: string };
const isImg = (u: string) => /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|$)/i.test(u);

export default function SocialContent() {
  const { profile } = useAuth();
  const me = profile?.id ?? '';
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Content[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [brandFilter, setBrandFilter] = useState('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [view, setView] = useState<'kanban' | 'calendario' | 'lista'>('calendario');
  const [products, setProducts] = useState<Product[]>([]);
  const [calMonth, setCalMonth] = useState('2026-08');
  const [calDay, setCalDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, m, a, cm, b, p] = await Promise.all([
      supabase.from('social_content').select('*').order('scheduled_date', { nullsFirst: false }).order('created_at'),
      supabase.from('social_content_media').select('*').order('created_at'),
      supabase.from('social_content_approvals').select('*'),
      supabase.from('social_content_comments').select('*').order('created_at'),
      supabase.from('brands').select('*'),
      supabase.from('profiles').select('*').order('name'),
    ]);
    supabase.from('products').select('id, code, name').order('code').then(({ data }) => setProducts((data as Product[]) ?? []));
    setItems((c.data as Content[]) ?? []);
    setMedia((m.data as Media[]) ?? []);
    setApprovals((a.data as Approval[]) ?? []);
    setComments((cm.data as Comment[]) ?? []);
    setBrands((b.data as Brand[]) ?? []);
    setProfiles((p.data as Profile[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel('social-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_content' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_content_approvals' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const brandById = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const profById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const mediaOf = (id: string) => media.filter((m) => m.content_id === id);
  const apprOf = (id: string, gate: Gate) => approvals.filter((a) => a.content_id === id && a.gate === gate);
  const iAmPendingApprover = (id: string) => approvals.some((a) => a.content_id === id && a.approver_id === me && a.decision === 'pendente');

  const visible = items.filter((i) => (brandFilter === 'all' || i.brand_id === brandFilter) && (!onlyMine || iAmPendingApprover(i.id)));
  const myPending = items.filter((i) => iAmPendingApprover(i.id)).length;

  async function updateStage(id: string, stage: Stage) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, stage } : i)));
    await supabase.from('social_content').update({ stage, updated_at: new Date().toISOString() }).eq('id', id);
    if (profile) logActivity({ actorId: profile.id, actionText: 'Social: peça movida', detail: STAGES.find((s) => s.key === stage)?.label });
  }

  async function decide(ap: Approval, decision: 'aprovado' | 'alteracao', note: string) {
    await supabase.from('social_content_approvals').update({ decision, note, decided_at: new Date().toISOString() }).eq('id', ap.id);
    // auto-fluxo: todos aprovaram → avança; alguém pediu alteração → volta pra etapa de trabalho
    const rest = apprOf(ap.content_id, ap.gate).map((x) => (x.id === ap.id ? { ...x, decision } : x));
    const item = items.find((i) => i.id === ap.content_id);
    if (item) {
      if (decision === 'alteracao') await updateStage(item.id, prevWork(ap.gate));
      else if (rest.every((x) => x.decision === 'aprovado')) await updateStage(item.id, nextStage(item.stage));
    }
    if (profile) logActivity({ actorId: profile.id, actionText: decision === 'aprovado' ? 'Social: conteúdo aprovado' : 'Social: alteração solicitada' });
    load();
  }

  async function newPiece() {
    const { data } = await supabase.from('social_content').insert({ title: 'Nova peça', created_by: me, brand_id: brands[0]?.id ?? null }).select().single();
    if (data) { await load(); setOpenId((data as Content).id); }
  }

  if (loading) return <Loading />;
  const open = items.find((i) => i.id === openId) ?? null;

  return (
    <div className="page">
      <h1 className="page-title">Social Media — Conteúdo</h1>
      <div className="page-sub">Do planejamento à divulgação pros lojistas. Arraste a peça entre as etapas; aprovações acontecem nos gates 👁️ e 🖼️.</div>

      {/* abas por marca */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 12px' }}>
        <BrandTab active={brandFilter === 'all'} label="Todas" color="var(--text-dim)" count={items.length} onClick={() => setBrandFilter('all')} />
        {brands.map((b) => (
          <BrandTab key={b.id} active={brandFilter === b.id} label={b.label} color={b.color} count={items.filter((i) => i.brand_id === b.id).length} onClick={() => setBrandFilter(b.id)} />
        ))}
      </div>

      <div className="filters-row" style={{ alignItems: 'center' }}>
        <div className="group-toggle">
          {(['calendario', 'kanban', 'lista'] as const).map((v) => <div key={v} className={`filter-chip${view === v ? ' active' : ''}`} onClick={() => setView(v)}>{v === 'calendario' ? '📅 Calendário' : v === 'kanban' ? '🗂 Kanban' : '📋 Lista'}</div>)}
        </div>
        <div className={`filter-chip${onlyMine ? ' active' : ''}`} onClick={() => setOnlyMine((v) => !v)}>
          ⏳ Aguardando minha aprovação{myPending > 0 ? ` (${myPending})` : ''}
        </div>
        <ImportButton brands={brands} me={me} onDone={load} />
        <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={newPiece}>+ Nova peça</button>
      </div>

      {/* modo aprovação visual — quando filtra "aguardando minha aprovação" */}
      {onlyMine && (
        <div style={{ marginTop: 14 }}>
          {visible.length === 0 && <div className="panel"><p style={{ color: 'var(--text-faint)' }}>Nada aguardando sua aprovação 🎉</p></div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {visible.map((i) => {
              const myAppr = approvals.find((a) => a.content_id === i.id && a.approver_id === me && a.decision === 'pendente');
              if (!myAppr) return null;
              return <ApprovalCard key={i.id} item={i} appr={myAppr} brand={i.brand_id ? brandById.get(i.brand_id) ?? null : null} thumb={mediaOf(i.id).find((m) => isImg(m.url))?.url ?? null} onOpen={() => setOpenId(i.id)} onDecide={decide} />;
            })}
          </div>
        </div>
      )}

      {!onlyMine && view === 'calendario' && (
        <CalendarView month={calMonth} setMonth={setCalMonth} items={visible} brandById={brandById} calDay={calDay} setCalDay={setCalDay} onOpen={setOpenId} />
      )}

      {!onlyMine && view === 'kanban' && (
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, marginTop: 14 }}>
        {STAGES.map((st) => {
          const col = visible.filter((i) => i.stage === st.key);
          return (
            <div key={st.key} onDragOver={(e) => e.preventDefault()} onDrop={() => dragId && updateStage(dragId, st.key)}
              style={{ minWidth: 240, width: 240, flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 9 }}>
                <span>{st.icon} {st.label}</span><span style={{ color: 'var(--text-faint)' }}>{col.length}</span>
              </div>
              {col.map((i) => {
                const b = i.brand_id ? brandById.get(i.brand_id) : null;
                const thumb = mediaOf(i.id).find((m) => isImg(m.url));
                const gate = st.gate; const appr = gate ? apprOf(i.id, gate) : [];
                const dot = gate && appr.length ? (appr.some((a) => a.decision === 'alteracao') ? 'var(--red)' : appr.every((a) => a.decision === 'aprovado') ? 'var(--green)' : 'var(--yellow)') : null;
                return (
                  <div key={i.id} draggable onDragStart={() => setDragId(i.id)} onDragEnd={() => setDragId(null)} onClick={() => setOpenId(i.id)}
                    className="card" style={{ padding: 8, marginBottom: 8, cursor: 'pointer' }}>
                    {thumb ? <img src={thumb.url} alt="" style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 7, marginBottom: 6, display: 'block' }} />
                      : <div style={{ height: 40, borderRadius: 7, marginBottom: 6, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{st.icon}</div>}
                    <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.25 }}>{i.title || 'Sem título'}</div>
                    {(i.objective || i.pilar) && <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.objective ? `🎯 ${i.objective}` : i.pilar}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                      {b && <span className="pill" style={{ fontSize: 9.5, background: `${b.color}22`, color: b.color }}>{b.label}</span>}
                      <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{[i.channel, i.format].filter(Boolean).join(' · ')}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto' }}>{fmtDate(i.scheduled_date)}</span>
                      {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />}
                    </div>
                  </div>
                );
              })}
              {col.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', padding: '10px 0' }}>—</div>}
            </div>
          );
        })}
      </div>
      )}

      {!onlyMine && view === 'lista' && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12, marginTop: 14 }}>
          <table className="simple">
            <thead><tr><th>Data</th><th>Tema</th><th>Marca</th><th>Canal · Formato</th><th>Pilar</th><th>Etapa</th></tr></thead>
            <tbody>
              {[...visible].sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? '')).map((i) => {
                const b = i.brand_id ? brandById.get(i.brand_id) : null; const st = STAGES.find((s) => s.key === i.stage);
                return (
                  <tr key={i.id} onClick={() => setOpenId(i.id)} style={{ cursor: 'pointer' }}>
                    <td>{fmtDate(i.scheduled_date)}</td>
                    <td style={{ fontWeight: 600 }}>{i.title}{i.objective ? <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', fontWeight: 400 }}>🎯 {i.objective}</span> : null}</td>
                    <td>{b ? <span className="pill" style={{ background: `${b.color}22`, color: b.color }}>{b.label}</span> : '—'}</td>
                    <td>{[i.channel, i.format].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{i.pilar || '—'}</td>
                    <td><span className="pill">{st?.icon} {st?.label ?? i.stage}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Detail key={open.id} item={open} brands={brands} profiles={profiles} products={products} me={me} profById={profById}
          media={mediaOf(open.id)} approvals={approvals.filter((a) => a.content_id === open.id)} comments={comments.filter((c) => c.content_id === open.id)}
          onClose={() => setOpenId(null)} onChange={load} onDecide={decide} onStage={updateStage} />
      )}
    </div>
  );
}

// ---------------- Detalhe da peça ----------------
function Detail({ item, brands, profiles, products, me, profById, media, approvals, comments, onClose, onChange, onDecide, onStage }: {
  item: Content; brands: Brand[]; profiles: Profile[]; products: Product[]; me: string; profById: Map<string, Profile>;
  media: Media[]; approvals: Approval[]; comments: Comment[]; onClose: () => void; onChange: () => void;
  onDecide: (ap: Approval, d: 'aprovado' | 'alteracao', note: string) => void; onStage: (id: string, s: Stage) => void;
}) {
  const [f, setF] = useState({ title: item.title, brand_id: item.brand_id ?? '', channel: item.channel, format: item.format, scheduled_date: item.scheduled_date ?? '', copy: item.copy, mlabs_url: item.mlabs_url, post_url: item.post_url, drive_url: item.drive_url, tipo: item.tipo ?? '', pilar: item.pilar ?? '', campaign: item.campaign ?? '', product: item.product ?? '', objective: item.objective ?? '', cta: item.cta ?? '', media_use: item.media_use ?? '', line_axis: item.line_axis ?? '', product_id: item.product_id ?? '' });
  const brandLabel = brands.find((b) => b.id === f.brand_id)?.label ?? '';
  const showSku = brandLabel === 'Playmi' || brandLabel === 'Tópi';
  const [busy, setBusy] = useState(false);
  const [pickApprovers, setPickApprovers] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [cbody, setCbody] = useState('');
  const stageDef = STAGES.find((s) => s.key === item.stage)!;
  const activeProfiles = profiles.filter((p) => !p.disabled);

  async function save() {
    setBusy(true);
    await supabase.from('social_content').update({ ...f, brand_id: f.brand_id || null, product_id: f.product_id || null, scheduled_date: f.scheduled_date || null, updated_at: new Date().toISOString() }).eq('id', item.id);
    setBusy(false); onChange();
  }
  async function upload(file: File) {
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${item.id}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from('social-media').upload(path, file, { upsert: true });
    if (error) { alert(error.message); return; }
    const { data } = supabase.storage.from('social-media').getPublicUrl(path);
    await supabase.from('social_content_media').insert({ content_id: item.id, url: data.publicUrl, path, type: file.type.startsWith('video') ? 'video' : 'image', name: file.name, added_by: me });
    onChange();
  }
  async function delMedia(m: Media) { if (m.path) await supabase.storage.from('social-media').remove([m.path]); await supabase.from('social_content_media').delete().eq('id', m.id); onChange(); }
  async function requestApproval() {
    if (!stageDef.gate || !pickApprovers.length) return;
    await supabase.from('social_content_approvals').upsert(pickApprovers.map((id) => ({ content_id: item.id, gate: stageDef.gate, approver_id: id, decision: 'pendente', requested_by: me })), { onConflict: 'content_id,gate,approver_id' });
    setPickApprovers([]); onChange();
  }
  async function addComment() { if (!cbody.trim()) return; await supabase.from('social_content_comments').insert({ content_id: item.id, author_id: me, body: cbody.trim() }); setCbody(''); onChange(); }

  const gateAppr = stageDef.gate ? approvals.filter((a) => a.gate === stageDef.gate) : [];

  return (
    <Modal wide title={item.title || 'Peça de conteúdo'} onClose={onClose}>
      {/* etapas (mover) */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {STAGES.map((s) => (
          <span key={s.key} onClick={() => onStage(item.id, s.key)} className="pill" style={{ cursor: 'pointer', fontSize: 11, background: s.key === item.stage ? 'var(--accent)' : 'var(--surface-2)', color: s.key === item.stage ? '#fff' : 'var(--text-faint)' }}>{s.icon} {s.label}</span>
        ))}
      </div>

      <Section title="📝 Planejamento & briefing" open={item.stage === 'planejamento'}>
      <div className="responsive-row">
        <div className="form-field" style={{ flex: 2 }}><label>Tema / título</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="form-field" style={{ flex: 1 }}><label>Marca</label><select value={f.brand_id} onChange={(e) => setF({ ...f, brand_id: e.target.value })}><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></div>
      </div>
      <div className="responsive-row">
        <div className="form-field" style={{ flex: 1 }}><label>Canal</label><select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}><option value="">—</option>{CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="form-field" style={{ flex: 1 }}><label>Formato</label><select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}><option value="">—</option>{FORMATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="form-field" style={{ flex: 1 }}><label>Data de publicação</label><input type="date" value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></div>
      </div>
      {/* Briefing editorial — o "porquê" da peça, gostoso de ler */}
      <div className="panel" style={{ background: 'var(--surface-2)' }}>
        <h4>📋 Briefing</h4>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}><label>Pilar</label><input value={f.pilar} onChange={(e) => setF({ ...f, pilar: e.target.value })} placeholder="ex.: Prova e confiança" /></div>
          <div className="form-field" style={{ flex: 1 }}><label>Tipo</label><input value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} placeholder="ex.: Reels, Carrossel" /></div>
          <div className="form-field" style={{ flex: 1 }}><label>Campanha / Fase</label><input value={f.campaign} onChange={(e) => setF({ ...f, campaign: e.target.value })} /></div>
        </div>
        <div className="form-field"><label>Produto / SKU / Licenciado</label><input value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} /></div>
        {showSku && (
          <div className="form-field"><label>🔗 Vincular SKU do catálogo ({brandLabel})</label>
            <ProductCombobox products={products} value={f.product_id} onChange={(id) => setF({ ...f, product_id: id })} />
          </div>
        )}
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}><label>Objetivo</label><input value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} placeholder="o que essa peça precisa fazer" /></div>
          <div className="form-field" style={{ flex: 1 }}><label>CTA</label><input value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} placeholder="chamada para ação" /></div>
        </div>
        <div className="form-field"><label>Uso de mídia</label><input value={f.media_use} onChange={(e) => setF({ ...f, media_use: e.target.value })} placeholder="orgânico / mídia paga…" /></div>
      </div>
      <div className="form-field"><label>Copy / legenda</label><textarea rows={3} value={f.copy} onChange={(e) => setF({ ...f, copy: e.target.value })} /></div>
      </Section>

      <Section title="🔗 Links & publicação" open={['mlabs', 'publicado', 'acompanhamento'].includes(item.stage)}>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}><label>Link mLabs</label><input value={f.mlabs_url} onChange={(e) => setF({ ...f, mlabs_url: e.target.value })} placeholder="cole o link" /></div>
          <div className="form-field" style={{ flex: 1 }}><label>Link do post</label><input value={f.post_url} onChange={(e) => setF({ ...f, post_url: e.target.value })} /></div>
          <div className="form-field" style={{ flex: 1 }}><label>Link Drive (lojistas)</label><input value={f.drive_url} onChange={(e) => setF({ ...f, drive_url: e.target.value })} /></div>
        </div>
      </Section>
      <button className="btn sm" style={{ marginTop: 12 }} disabled={busy} onClick={save}>{busy ? 'Salvando…' : '💾 Salvar dados'}</button>

      {/* mídia */}
      <Section title="🎨 Arte / mídia" open={['producao', 'mlabs'].includes(item.stage)}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {media.map((m) => (
            <div key={m.id} style={{ position: 'relative' }}>
              {isImg(m.url) ? <a href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt={m.name} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} /></a>
                : <a href={m.url} target="_blank" rel="noreferrer" className="pill">🎬 {m.name}</a>}
              <button onClick={() => delMedia(m)} title="Remover" style={{ position: 'absolute', top: -7, right: -7, width: 19, height: 19, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--red)', cursor: 'pointer', fontSize: 11 }}>✕</button>
            </div>
          ))}
        </div>
        <label className="btn ghost sm" style={{ cursor: 'pointer' }}>⬆ Enviar arte<input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ''; }} /></label>
      </Section>

      {/* publicado → acompanhamento */}
      {item.stage === 'publicado' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <h4>Publicação</h4>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: '4px 0 10px' }}>Publicado no mLabs? Marque como realizado — a peça vai automaticamente para o Acompanhamento (Drive, lojistas…).</p>
          <button className="btn" onClick={() => onStage(item.id, 'acompanhamento')}>✅ Marcar como realizado → Acompanhamento</button>
        </div>
      )}

      {/* aprovação (só nos gates) */}
      {stageDef.gate && (
        <div className="panel" style={{ marginTop: 14, border: '1px solid var(--accent)' }}>
          <h4>{stageDef.gate === 'conteudo' ? '👁️ Aceite do planejado' : stageDef.gate === 'arte' ? '🖼️ Aprovação da arte' : '📤 Aprovação no mLabs'}</h4>
          {stageDef.gate === 'mlabs' && (
            <div style={{ marginBottom: 10 }}>
              {f.mlabs_url ? <a className="btn sm" href={f.mlabs_url} target="_blank" rel="noreferrer">📤 Abrir no mLabs →</a> : <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Cole o link do mLabs no campo acima para o aprovador acessar.</span>}
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>O aprovador faz os ajustes no mLabs e sinaliza aqui só se está <b>aprovado</b> ou <b>tem alteração</b>.</p>
            </div>
          )}
          {gateAppr.map((a) => {
            const canDecide = a.approver_id === me && a.decision === 'pendente';
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{profById.get(a.approver_id)?.name ?? '—'}</span>
                <span className="pill" style={{ background: a.decision === 'aprovado' ? 'var(--green-dim)' : a.decision === 'alteracao' ? 'var(--red-dim)' : 'var(--surface-2)', color: a.decision === 'aprovado' ? 'var(--green)' : a.decision === 'alteracao' ? 'var(--red)' : 'var(--text-faint)' }}>{a.decision === 'pendente' ? 'aguardando' : a.decision === 'aprovado' ? 'aprovado ✓' : 'pediu alteração'}</span>
                {a.note && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>“{a.note}”</span>}
                {canDecide && (
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button className="btn sm" style={{ background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => onDecide(a, 'aprovado', note)}>✅ Aprovar</button>
                    <button className="btn ghost sm" style={{ color: 'var(--warn, #f59e0b)' }} onClick={() => onDecide(a, 'alteracao', note || 'Ajustar')}>✏️ Pedir alteração</button>
                  </span>
                )}
              </div>
            );
          })}
          {gateAppr.some((a) => a.approver_id === me && a.decision === 'pendente') && (
            <input placeholder="Observação (opcional, vai junto da decisão)…" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginTop: 8 }} />
          )}
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text-faint)' }}>Pedir aprovação a:</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
              {activeProfiles.map((p) => {
                const on = pickApprovers.includes(p.id);
                return <span key={p.id} className="pill" onClick={() => setPickApprovers((prev) => on ? prev.filter((x) => x !== p.id) : [...prev, p.id])} style={{ cursor: 'pointer', background: on ? 'var(--accent-dim)' : 'var(--surface-2)', color: on ? 'var(--accent)' : 'var(--text-faint)', border: on ? '1px solid var(--accent)' : '1px solid var(--border)' }}>@{p.name}</span>;
              })}
            </div>
            <button className="btn sm" disabled={!pickApprovers.length} onClick={requestApproval}>Enviar para aprovação</button>
          </div>
        </div>
      )}

      {/* comentários / observações */}
      <div className="panel" style={{ marginTop: 14 }}>
        <h4>Observações</h4>
        {[...comments].reverse().map((c) => (
          <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{profById.get(c.author_id)?.name ?? 'Alguém'} · {new Date(c.created_at).toLocaleString('pt-BR')}</div>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{c.body}</div>
          </div>
        ))}
        {comments.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sem observações ainda.</p>}
        <div className="responsive-row" style={{ marginTop: 8 }}>
          <input placeholder="Escrever observação…" value={cbody} onChange={(e) => setCbody(e.target.value)} style={{ flex: 1 }} />
          <button className="btn sm" onClick={addComment}>Comentar</button>
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, open: defaultOpen, children }: { title: string; open: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <div onClick={() => setOpen((o) => !o)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h4 style={{ margin: 0 }}>{title}{!open ? <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-faint)', marginLeft: 8 }}>(registrado — clique para ver)</span> : null}</h4>
        <span style={{ color: 'var(--text-faint)' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

function BrandTab({ active, label, color, count, onClick }: { active: boolean; label: string; color: string; count: number; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', padding: '8px 15px', borderRadius: 10, fontWeight: 700, fontSize: 14, border: `2px solid ${active ? color : 'var(--border)'}`, background: active ? `${color}18` : 'var(--surface)', color: active ? color : 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />{label}<span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{count}</span>
    </div>
  );
}

function ApprovalCard({ item, appr, brand, thumb, onOpen, onDecide }: { item: Content; appr: Approval; brand: Brand | null; thumb: string | null; onOpen: () => void; onDecide: (ap: Approval, d: 'aprovado' | 'alteracao', note: string) => void }) {
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const gateLabel = appr.gate === 'conteudo' ? '👁️ Aceite do planejado' : '📤 Aprovação (mLabs)';
  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div onClick={onOpen} style={{ cursor: 'pointer', height: 180, background: thumb ? `center/cover no-repeat url(${thumb})` : 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>{!thumb && '🎨'}</div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
          {brand && <span className="pill" style={{ background: `${brand.color}22`, color: brand.color, fontSize: 10 }}>{brand.label}</span>}
          <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>{gateLabel}</span>
        </div>
        <div onClick={onOpen} style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{item.title}</div>
        {item.objective && <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4 }}>🎯 {item.objective}</div>}
        {item.copy && <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 6, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.copy}</div>}
        {appr.gate === 'mlabs' && item.mlabs_url && <a className="btn ghost sm" href={item.mlabs_url} target="_blank" rel="noreferrer" style={{ marginTop: 8, display: 'inline-block' }}>📤 Abrir no mLabs →</a>}
        {asking ? (
          <div style={{ marginTop: 10 }}>
            <input placeholder="O que ajustar?" value={note} onChange={(e) => setNote(e.target.value)} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="btn sm" onClick={() => onDecide(appr, 'alteracao', note || 'Ajustar')}>Enviar</button>
              <button className="btn ghost sm" onClick={() => setAsking(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" style={{ flex: 1, background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => onDecide(appr, 'aprovado', '')}>✅ Aprovar</button>
            <button className="btn ghost" onClick={() => (appr.gate === 'mlabs' ? onDecide(appr, 'alteracao', '') : setAsking(true))}>✏️ Alteração</button>
          </div>
        )}
      </div>
    </div>
  );
}

const MONTH_OPTS = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'];
function CalendarView({ month, setMonth, items, brandById, onOpen }: { month: string; setMonth: (m: string) => void; items: Content[]; brandById: Map<string, Brand>; calDay: string | null; setCalDay: (d: string | null) => void; onOpen: (id: string) => void }) {
  const [Y, M] = month.split('-').map(Number);
  const first = new Date(Y, M - 1, 1, 12); const last = new Date(Y, M, 0, 12);
  const start = new Date(first); start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const cells: string[] = [];
  for (let cur = new Date(start); cur <= last || cells.length % 7 !== 0; cur.setDate(cur.getDate() + 1)) cells.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
  const byDate = new Map<string, Content[]>();
  for (const i of items) if (i.scheduled_date) (byDate.get(i.scheduled_date) ?? byDate.set(i.scheduled_date, []).get(i.scheduled_date)!).push(i);
  const mi = MONTH_OPTS.indexOf(month);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button className="btn ghost sm" disabled={mi <= 0} onClick={() => setMonth(MONTH_OPTS[mi - 1])}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{MONTHS_PT[M - 1]} {Y}</span>
        <button className="btn ghost sm" disabled={mi >= MONTH_OPTS.length - 1} onClick={() => setMonth(MONTH_OPTS[mi + 1])}>›</button>
        <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 8 }}>{items.filter((i) => (i.scheduled_date ?? '').startsWith(month)).length} peças no mês</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <div key={d} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textAlign: 'center' }}>{d}</div>)}
        {cells.map((date) => {
          const inMonth = date.startsWith(month); const list = byDate.get(date) ?? [];
          return (
            <div key={date} style={{ minHeight: 96, borderRadius: 9, border: '1px solid var(--border)', padding: 5, opacity: inMonth ? 1 : 0.4, background: 'var(--surface)', overflow: 'hidden' }}>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, marginBottom: 3 }}>{date.slice(8)}</div>
              {list.slice(0, 4).map((i) => {
                const b = i.brand_id ? brandById.get(i.brand_id) : null; const col = b?.color ?? 'var(--text-dim)';
                return <div key={i.id} onClick={() => onOpen(i.id)} title={i.title} style={{ cursor: 'pointer', fontSize: 10.5, lineHeight: 1.25, padding: '2px 5px', marginBottom: 2, borderRadius: 5, background: `${col}18`, color: col, borderLeft: `2px solid ${col}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{i.title || '—'}</div>;
              })}
              {list.length > 4 && <div style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>+{list.length - 4}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Import CSV ----------------
function ImportButton({ brands, me, onDone }: { brands: Brand[]; me: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function handle(file: File) {
    setBusy(true);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const parseLine = (l: string) => { const out: string[] = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if ((ch === ',' || ch === ';') && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((s) => s.trim().replace(/^"|"$/g, '')); };
    const header = parseLine(lines[0]).map((h) => h.toLowerCase());
    const col = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
    const ci = { data: col(['data', 'quando']), tema: col(['tema', 'titulo', 'título', 'assunto', 'conteudo', 'conteúdo']), marca: col(['marca', 'brand']), canal: col(['canal', 'rede', 'plataforma']), formato: col(['formato', 'tipo']), copy: col(['copy', 'legenda', 'texto', 'descric']) };
    const toYmd = (s: string) => { const m = s.match(/(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?/); if (!m) return null; let [, d, mo, y] = m; y = y || '2026'; if (y.length === 2) y = '20' + y; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; };
    const brandMatch = (s: string) => brands.find((b) => b.label.toLowerCase() === (s || '').toLowerCase() || (s || '').toLowerCase().includes(b.label.toLowerCase()))?.id ?? null;
    const rows = lines.slice(1).map(parseLine).filter((r) => r.some((c) => c));
    const payload = rows.map((r, idx) => ({
      title: ci.tema >= 0 ? r[ci.tema] || `Peça ${idx + 1}` : `Peça ${idx + 1}`,
      brand_id: ci.marca >= 0 ? brandMatch(r[ci.marca]) : null,
      channel: ci.canal >= 0 ? r[ci.canal] || '' : '',
      format: ci.formato >= 0 ? r[ci.formato] || '' : '',
      scheduled_date: ci.data >= 0 ? toYmd(r[ci.data]) : null,
      copy: ci.copy >= 0 ? r[ci.copy] || '' : '',
      stage: 'planejamento', created_by: me,
    }));
    if (payload.length) await supabase.from('social_content').insert(payload);
    setBusy(false);
    alert(`${payload.length} peças importadas para Planejamento.`);
    onDone();
  }
  return (
    <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
      {busy ? 'Importando…' : '📄 Importar planilha (CSV)'}
      <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handle(file); e.target.value = ''; }} />
    </label>
  );
}
