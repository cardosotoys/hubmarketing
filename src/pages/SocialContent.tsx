import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../lib/activityLog';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import type { Brand, Profile } from '../types/database';

type Stage = 'planejamento' | 'aprov_conteudo' | 'producao' | 'aprov_arte' | 'mlabs' | 'publicado' | 'lojistas';
const STAGES: { key: Stage; label: string; icon: string; gate?: 'conteudo' | 'arte' }[] = [
  { key: 'planejamento', label: 'Planejamento', icon: '📝' },
  { key: 'aprov_conteudo', label: 'Aprov. conteúdo', icon: '👁️', gate: 'conteudo' },
  { key: 'producao', label: 'Produção', icon: '🎬' },
  { key: 'aprov_arte', label: 'Aprov. arte', icon: '🖼️', gate: 'arte' },
  { key: 'mlabs', label: 'mLabs', icon: '📤' },
  { key: 'publicado', label: 'Publicado', icon: '✅' },
  { key: 'lojistas', label: 'Lojistas', icon: '🏬' },
];
const CHANNELS = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'LinkedIn', 'Kwai'];
const FORMATS = ['Feed', 'Story', 'Reels', 'Carrossel', 'Vídeo', 'Live'];
const nextStage = (s: Stage): Stage => STAGES[Math.min(STAGES.length - 1, STAGES.findIndex((x) => x.key === s) + 1)].key;
const prevWork = (gate: 'conteudo' | 'arte'): Stage => (gate === 'conteudo' ? 'planejamento' : 'producao');
const fmtDate = (s: string | null) => (s ? s.split('-').reverse().join('/') : '—');

type Content = { id: string; title: string; brand_id: string | null; channel: string; format: string; scheduled_date: string | null; copy: string; stage: Stage; mlabs_url: string; post_url: string; drive_url: string; created_by: string | null; position: number };
type Media = { id: string; content_id: string; url: string; path: string; type: string; name: string };
type Approval = { id: string; content_id: string; gate: 'conteudo' | 'arte'; approver_id: string; decision: 'pendente' | 'aprovado' | 'alteracao'; note: string };
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

  const load = useCallback(async () => {
    const [c, m, a, cm, b, p] = await Promise.all([
      supabase.from('social_content').select('*').order('scheduled_date', { nullsFirst: false }).order('created_at'),
      supabase.from('social_content_media').select('*').order('created_at'),
      supabase.from('social_content_approvals').select('*'),
      supabase.from('social_content_comments').select('*').order('created_at'),
      supabase.from('brands').select('*'),
      supabase.from('profiles').select('*').order('name'),
    ]);
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
  const apprOf = (id: string, gate: 'conteudo' | 'arte') => approvals.filter((a) => a.content_id === id && a.gate === gate);
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

      <div className="filters-row" style={{ alignItems: 'center' }}>
        <select className="chip-select" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
          <option value="all">Todas as marcas</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <div className={`filter-chip${onlyMine ? ' active' : ''}`} onClick={() => setOnlyMine((v) => !v)}>
          ⏳ Aguardando minha aprovação{myPending > 0 ? ` (${myPending})` : ''}
        </div>
        <ImportButton brands={brands} me={me} onDone={load} />
        <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={newPiece}>+ Nova peça</button>
      </div>

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

      {open && (
        <Detail key={open.id} item={open} brands={brands} profiles={profiles} me={me} profById={profById}
          media={mediaOf(open.id)} approvals={approvals.filter((a) => a.content_id === open.id)} comments={comments.filter((c) => c.content_id === open.id)}
          onClose={() => setOpenId(null)} onChange={load} onDecide={decide} onStage={updateStage} />
      )}
    </div>
  );
}

// ---------------- Detalhe da peça ----------------
function Detail({ item, brands, profiles, me, profById, media, approvals, comments, onClose, onChange, onDecide, onStage }: {
  item: Content; brands: Brand[]; profiles: Profile[]; me: string; profById: Map<string, Profile>;
  media: Media[]; approvals: Approval[]; comments: Comment[]; onClose: () => void; onChange: () => void;
  onDecide: (ap: Approval, d: 'aprovado' | 'alteracao', note: string) => void; onStage: (id: string, s: Stage) => void;
}) {
  const [f, setF] = useState({ title: item.title, brand_id: item.brand_id ?? '', channel: item.channel, format: item.format, scheduled_date: item.scheduled_date ?? '', copy: item.copy, mlabs_url: item.mlabs_url, post_url: item.post_url, drive_url: item.drive_url });
  const [busy, setBusy] = useState(false);
  const [pickApprovers, setPickApprovers] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [cbody, setCbody] = useState('');
  const stageDef = STAGES.find((s) => s.key === item.stage)!;
  const activeProfiles = profiles.filter((p) => !p.disabled);

  async function save() {
    setBusy(true);
    await supabase.from('social_content').update({ ...f, brand_id: f.brand_id || null, scheduled_date: f.scheduled_date || null, updated_at: new Date().toISOString() }).eq('id', item.id);
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

      <div className="responsive-row">
        <div className="form-field" style={{ flex: 2 }}><label>Tema / título</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="form-field" style={{ flex: 1 }}><label>Marca</label><select value={f.brand_id} onChange={(e) => setF({ ...f, brand_id: e.target.value })}><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></div>
      </div>
      <div className="responsive-row">
        <div className="form-field" style={{ flex: 1 }}><label>Canal</label><select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}><option value="">—</option>{CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="form-field" style={{ flex: 1 }}><label>Formato</label><select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}><option value="">—</option>{FORMATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="form-field" style={{ flex: 1 }}><label>Data de publicação</label><input type="date" value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></div>
      </div>
      <div className="form-field"><label>Copy / legenda</label><textarea rows={3} value={f.copy} onChange={(e) => setF({ ...f, copy: e.target.value })} /></div>
      <div className="responsive-row">
        <div className="form-field" style={{ flex: 1 }}><label>Link mLabs</label><input value={f.mlabs_url} onChange={(e) => setF({ ...f, mlabs_url: e.target.value })} placeholder="cole o link" /></div>
        <div className="form-field" style={{ flex: 1 }}><label>Link do post</label><input value={f.post_url} onChange={(e) => setF({ ...f, post_url: e.target.value })} /></div>
        <div className="form-field" style={{ flex: 1 }}><label>Link Drive (lojistas)</label><input value={f.drive_url} onChange={(e) => setF({ ...f, drive_url: e.target.value })} /></div>
      </div>
      <button className="btn sm" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar dados'}</button>

      {/* mídia */}
      <div className="panel" style={{ marginTop: 14 }}>
        <h4>Arte / mídia</h4>
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
      </div>

      {/* aprovação (só nos gates) */}
      {stageDef.gate && (
        <div className="panel" style={{ marginTop: 14, border: '1px solid var(--accent)' }}>
          <h4>Aprovação — {stageDef.gate === 'conteudo' ? 'conteúdo' : 'arte'}</h4>
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
