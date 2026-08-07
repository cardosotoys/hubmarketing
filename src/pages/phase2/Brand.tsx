import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { normalizeUrl } from '../../lib/url';
import Modal from '../../components/Modal';
import type { BrandLicensee, BrandLicenseeFile, BrandAssetCategory } from '../../types/database';

export default function Brand() {
  return (
    <div className="page">
      <h1 className="page-title">Brand</h1>
      <div className="page-sub">
        Brandbooks oficiais e manuais de marca — referência de linguagem, tom de voz e identidade visual para
        qualquer pessoa nova no time.
      </div>

      <div className="section-head">
        <h2>Marcas Cardoso</h2>
      </div>
      <div className="grid3">
        <div className="card" style={{ borderTop: '3px solid var(--cardoso)' }}>
          <h4>Cardoso</h4>
          <p>Marca-mãe institucional. Logo, paleta vermelha e aplicações corporativas.</p>
          <span className="pill" style={{ marginTop: 8, display: 'inline-block' }}>
            Brandbook
          </span>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--playmi)' }}>
          <h4>Playmi</h4>
          <p>
            Submarca de valor agregado (classes B-C). Arquétipos Herói + Inocente, linhas Play&amp;Drive, Ride,
            Learn, Imagine, Collect e Molto.
          </p>
          <span className="pill" style={{ marginTop: 8, display: 'inline-block' }}>
            Brandbook · 2025
          </span>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--topi)' }}>
          <h4>Tópi</h4>
          <p>Submarca de preço acessível e giro (classes C-D). Arquétipos Inocente + Cara Comum, tom de voz leve e popular.</p>
          <span className="pill" style={{ marginTop: 8, display: 'inline-block' }}>
            Brandbook · 2025
          </span>
        </div>
      </div>

      <div className="section-head">
        <h2>Linhas Playmi</h2>
      </div>
      <div className="grid4">
        <div className="card">
          <h4>Play&amp;Drive</h4>
          <p>Liberdade sobre rodas.</p>
        </div>
        <div className="card">
          <h4>Play&amp;Ride</h4>
          <p>Primeiro veículo, equilíbrio.</p>
        </div>
        <div className="card">
          <h4>Play&amp;Learn</h4>
          <p>Primeiras descobertas sensoriais.</p>
        </div>
        <div className="card">
          <h4>Play&amp;Imagine</h4>
          <p>Faz de conta e histórias.</p>
        </div>
        <div className="card">
          <h4>Play&amp;Collect</h4>
          <p>Personagens licenciados.</p>
        </div>
        <div className="card">
          <h4>Play&amp;Molto</h4>
          <p>Parceria Moltó (Espanha).</p>
        </div>
      </div>

      <div className="section-head">
        <h2>Playmi — identidade de marca</h2>
        <span className="pill">Brand Guidelines · 2025</span>
      </div>
      <div className="info-grid">
        <div>
          <div className="panel">
            <h4>Sobre a marca</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              Playmi é a submarca de brinquedos da Cardoso de valor agregado, para as classes B-C. Arquitetura de
              marca: Cardoso é a marca-mãe institucional, e Playmi é a submarca voltada a um público que busca
              mais qualidade e diferenciação.
            </p>
          </div>
          <div className="panel">
            <h4>Arquétipos</h4>
            <div className="field-row">
              <span className="k">Posicionamento no mercado</span>
              <span style={{ textAlign: 'right' }}>Herói — liderança, ambição, inovação</span>
            </div>
            <div className="field-row">
              <span className="k">Com o consumidor</span>
              <span style={{ textAlign: 'right' }}>Inocente — acessível e confiável com pais e crianças</span>
            </div>
          </div>
          <div className="panel">
            <h4>Tom de voz</h4>
            <div className="field-row">
              <span className="k">Próxima e acessível</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>simples e acolhedora, nunca complexa ou distante</span>
            </div>
            <div className="field-row">
              <span className="k">Entusiástica e energética</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>animada e motivadora, nunca apática ou fria</span>
            </div>
            <div className="field-row">
              <span className="k">Confiável e inspiradora</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>segura e educadora, nunca genérica ou indiferente</span>
            </div>
            <div className="field-row">
              <span className="k">Respeitosa e inclusiva</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>acolhedora e familiar, nunca invasiva ou excludente</span>
            </div>
          </div>
          <div className="panel">
            <h4>Proposta de valor</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6, margin: '0 0 10px 0' }}>
              <b>Propósito:</b> despertar o potencial único de aprendizado de cada criança através do ato de
              brincar, criando descobertas significativas e memórias afetivas que durarão para sempre.
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: 0 }}>
              Valores: estímulo à imaginação · desenvolvimento da criança · segurança e confiabilidade · conexões
              genuínas.
            </p>
          </div>
          <div className="panel">
            <h4>Tagline &amp; manifesto</h4>
            <p style={{ fontFamily: 'Space Grotesk', fontSize: 15, margin: '0 0 10px 0' }}>“Brincar é crescer, juntos!”</p>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 10px 0' }}>
              Slogans: “O primeiro passo é brincar.” / “Descobrir, criar e crescer juntos.”
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6, fontStyle: 'italic' }}>
              "Acreditamos que o brincar é criar memórias, através da descoberta do 'eu' e da relação com o
              ambiente ao seu redor... Brincar faz parte de crescer. E estamos aqui para cada passo dessa
              jornada."
            </p>
          </div>
        </div>
        <div>
          <div className="panel">
            <h4>Tipografia</h4>
            <div className="field-row">
              <span className="k">Principal</span>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>Goldray</span>
            </div>
            <div className="field-row">
              <span className="k">Complementar</span>
              <span>Urbanist</span>
            </div>
            <div className="field-row">
              <span className="k">Destaque secundário</span>
              <span>Unspoken</span>
            </div>
          </div>
          <div className="panel">
            <h4>Cores da marca</h4>
            <div className="field-row">
              <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--playmi)', display: 'inline-block' }} />
                Azul Playmi
              </span>
              <span className="mono">#00B3C6</span>
            </div>
            <div className="field-row">
              <span className="k">Off Playmi</span>
              <span style={{ color: 'var(--text-faint)' }}>tom neutro complementar</span>
            </div>
          </div>
          <div className="panel">
            <h4>Cores por linha</h4>
            {[
              ['Play&Drive · Azul', '#2163C4'],
              ['Play&Imagine · Rosa', '#ED6199'],
              ['Play&Ride · Verde', '#70BD8F'],
              ['Play&Learn · Lilás', '#BF91D1'],
              ['Play&Collect · Laranja', '#E87821'],
            ].map(([name, hex]) => (
              <div className="field-row" key={hex}>
                <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: hex, display: 'inline-block' }} />
                  {name}
                </span>
                <span className="mono">{hex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section-head">
        <h2>Categorias Tópi</h2>
      </div>
      <div className="grid4">
        <div className="card">
          <h4>Ar Livre</h4>
          <p>Brincadeiras para gastar energia lá fora.</p>
        </div>
        <div className="card">
          <h4>Faz de Conta</h4>
          <p>Imaginação e histórias do dia a dia.</p>
        </div>
        <div className="card">
          <h4>Roda Livre</h4>
          <p>Veículos e brinquedos de rodas.</p>
        </div>
        <div className="card">
          <h4>Primeira Infância</h4>
          <p>Primeiras descobertas, a partir de 18 meses.</p>
        </div>
        <div className="card">
          <h4>Jogos</h4>
          <p>Diversão em grupo e raciocínio.</p>
        </div>
      </div>

      <div className="section-head">
        <h2>Tópi — identidade de marca</h2>
        <span className="pill">Brand Guidelines · 2025</span>
      </div>
      <div className="info-grid">
        <div>
          <div className="panel">
            <h4>Sobre a marca</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              Tópi é a submarca de brinquedos da Cardoso Ind. de preço acessível e giro rápido, para crianças a
              partir de 18 meses — brinquedos que estimulam coordenação motora, criatividade, raciocínio lógico e
              trabalho em equipe. Público: classes C e D.
            </p>
          </div>
          <div className="panel">
            <h4>Arquétipos</h4>
            <div className="field-row">
              <span className="k">Com o consumidor</span>
              <span>Inocente — simplicidade, otimismo, confiança</span>
            </div>
            <div className="field-row">
              <span className="k">No mercado</span>
              <span>Cara Comum — inclusiva, acessível, preço justo</span>
            </div>
          </div>
          <div className="panel">
            <h4>Tom de voz</h4>
            <div className="field-row">
              <span className="k">Próxima e verdadeira</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>sem formalismo, fala como quem está ao lado da família</span>
            </div>
            <div className="field-row">
              <span className="k">Otimista e alegre</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>entusiasmo contagiante, nunca monótona</span>
            </div>
            <div className="field-row">
              <span className="k">Confiável e segura</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>simples e transparente, nunca técnica demais</span>
            </div>
            <div className="field-row">
              <span className="k">Inclusiva e empática</span>
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>acessível a todas as famílias, nunca impositiva</span>
            </div>
          </div>
          <div className="panel">
            <h4>Tagline &amp; manifesto</h4>
            <p style={{ fontFamily: 'Space Grotesk', fontSize: 15, margin: '0 0 10px 0' }}>“Brincar é Tópi.”</p>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 10px 0' }}>
              Slogans: “Se divertir é Tópi.” / “Imaginar é Tópi!”
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6, fontStyle: 'italic' }}>
              "Porque Tópi é mais do que brinquedo. É um jeito de olhar para a infância com leveza, cor e
              imaginação... Porque quando a infância é livre, criativa e feliz — é Tópi demais!"
            </p>
          </div>
        </div>
        <div>
          <div className="panel">
            <h4>Tipografia</h4>
            <div className="field-row">
              <span className="k">Principal</span>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>Chill Kids</span>
            </div>
            <div className="field-row">
              <span className="k">Complementar</span>
              <span>Maven Pro</span>
            </div>
          </div>
          <div className="panel">
            <h4>Paleta de cores</h4>
            {[
              ['Laranja · Alegria', '#EA5C18'],
              ['Amarelo · Sol', '#F3D22A'],
              ['Azul · Céu', '#2EBADA'],
              ['Branco', '#FFFFFF'],
            ].map(([name, hex]) => (
              <div className="field-row" key={hex}>
                <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: hex,
                      border: hex === '#FFFFFF' ? '1px solid var(--border)' : 'none',
                      display: 'inline-block',
                    }}
                  />
                  {name}
                </span>
                <span className="mono">{hex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <LicenseesSection />
    </div>
  );
}

type UrlKey = 'logos_url' | 'colors_url' | 'typography_url' | 'icons_url' | 'pattern_url';
const CATEGORIES: { key: UrlKey; cat: BrandAssetCategory; label: string; icon: string }[] = [
  { key: 'logos_url', cat: 'logos', label: 'Logotipos', icon: '🅰' },
  { key: 'colors_url', cat: 'colors', label: 'Paleta de cores', icon: '🎨' },
  { key: 'typography_url', cat: 'typography', label: 'Tipografia', icon: '🔤' },
  { key: 'icons_url', cat: 'icons', label: 'Ícones', icon: '✦' },
  { key: 'pattern_url', cat: 'pattern', label: 'Pattern', icon: '▦' },
];

const BLANK: Omit<BrandLicensee, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  licensor: '',
  color: 'var(--accent)',
  source_type: 'site',
  guide_url: '',
  access_info: '',
  logos_url: '',
  colors_url: '',
  typography_url: '',
  icons_url: '',
  pattern_url: '',
  position: 99,
};

function LicenseesSection() {
  const { profile } = useAuth();
  const canManage = profile?.role === 'diretoria' || profile?.role === 'administrador';
  const [rows, setRows] = useState<BrandLicensee[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null); // guia aberto
  const [editingId, setEditingId] = useState<string | 'new' | null>(null); // form aberto
  const [draft, setDraft] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<BrandLicenseeFile[]>([]);
  const [uploadingCat, setUploadingCat] = useState<string | null>(null);
  const actorId = profile?.id ?? '';

  async function load() {
    setLoading(true);
    const [licRes, filesRes] = await Promise.all([
      supabase.from('brand_licensees').select('*').order('position').order('name'),
      supabase.from('brand_licensee_files').select('*').order('created_at'),
    ]);
    setRows((licRes.data as BrandLicensee[]) ?? []);
    setFiles((filesRes.data as BrandLicenseeFile[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filesFor = (licenseeId: string, cat: BrandAssetCategory) =>
    files.filter((f) => f.licensee_id === licenseeId && f.category === cat);

  async function uploadAsset(licenseeId: string, cat: BrandAssetCategory, file: File) {
    setUploadingCat(`${licenseeId}:${cat}`);
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${licenseeId}/${cat}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true });
    if (upErr) {
      alert(upErr.message);
      setUploadingCat(null);
      return;
    }
    const { data } = supabase.storage.from('brand-assets').getPublicUrl(path);
    await supabase.from('brand_licensee_files').insert({ licensee_id: licenseeId, category: cat, name: file.name, url: data.publicUrl, path, added_by: actorId || null });
    const { data: rowsF } = await supabase.from('brand_licensee_files').select('*').order('created_at');
    setFiles((rowsF as BrandLicenseeFile[]) ?? []);
    setUploadingCat(null);
  }

  async function removeAsset(f: BrandLicenseeFile) {
    if (f.path) await supabase.storage.from('brand-assets').remove([f.path]);
    await supabase.from('brand_licensee_files').delete().eq('id', f.id);
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
  }

  const open = useMemo(() => rows.find((r) => r.id === openId) ?? null, [rows, openId]);

  function startAdd() {
    setDraft({ ...BLANK, position: rows.length + 1 });
    setEditingId('new');
  }
  function startEdit(l: BrandLicensee) {
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = l;
    void _id;
    void _c;
    void _u;
    setDraft(rest);
    setOpenId(null);
    setEditingId(l.id);
  }

  async function save() {
    if (!draft.name.trim()) return;
    setBusy(true);
    const payload = {
      ...draft,
      name: draft.name.trim(),
      licensor: draft.licensor.trim(),
      guide_url: draft.guide_url.trim() ? normalizeUrl(draft.guide_url) : '',
      logos_url: draft.logos_url.trim() ? normalizeUrl(draft.logos_url) : '',
      colors_url: draft.colors_url.trim() ? normalizeUrl(draft.colors_url) : '',
      typography_url: draft.typography_url.trim() ? normalizeUrl(draft.typography_url) : '',
      icons_url: draft.icons_url.trim() ? normalizeUrl(draft.icons_url) : '',
      pattern_url: draft.pattern_url.trim() ? normalizeUrl(draft.pattern_url) : '',
      updated_at: new Date().toISOString(),
    };
    if (editingId === 'new') {
      await supabase.from('brand_licensees').insert(payload);
    } else if (editingId) {
      await supabase.from('brand_licensees').update(payload).eq('id', editingId);
    }
    setBusy(false);
    setEditingId(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Excluir este licenciado?')) return;
    await supabase.from('brand_licensees').delete().eq('id', id);
    setOpenId(null);
    setEditingId(null);
    await load();
  }

  return (
    <>
      <div className="section-head">
        <h2>Personagens licenciados</h2>
        {canManage && (
          <button className="btn ghost" onClick={startAdd}>
            + Adicionar licenciado
          </button>
        )}
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : (
        <div className="grid4">
          {rows.map((l) => {
            const filled = CATEGORIES.filter((c) => (l[c.key] as string)?.trim() || filesFor(l.id, c.cat).length > 0).length;
            return (
              <div className="card" key={l.id} style={{ borderTop: `3px solid ${l.color}` }}>
                <h4>{l.name}</h4>
                <p>Licenciante: {l.licensor || '—'}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn sm" onClick={() => setOpenId(l.id)}>
                    Guia de uso da marca
                  </button>
                  <span className="pill" title={l.source_type === 'drive' ? 'Guia no Google Drive' : 'Guia em site próprio'}>
                    {l.source_type === 'drive' ? '🗂 Drive' : '🌐 Site'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{filled}/5 assets</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <Modal title={open.name} onClose={() => setOpenId(null)}>
          <p className="page-sub" style={{ marginTop: -4 }}>
            Licenciante: {open.licensor || '—'} · Guia em {open.source_type === 'drive' ? 'Google Drive' : 'site próprio'}
          </p>

          {(open.guide_url || open.access_info) && (
            <div
              style={{
                marginBottom: 14,
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--surface-2)',
              }}
            >
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', fontWeight: 600, marginBottom: 6 }}>
                Acesso ao guia real
              </div>
              {open.guide_url && (
                <a className="btn sm" href={open.guide_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: open.access_info ? 8 : 0 }}>
                  {open.source_type === 'drive' ? '🗂 Abrir no Drive →' : '🌐 Abrir o site →'}
                </a>
              )}
              {open.access_info && (
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{open.access_info}</div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CATEGORIES.map((c) => {
              const url = (open[c.key] as string)?.trim();
              const catFiles = filesFor(open.id, c.cat);
              return (
                <div
                  key={c.key}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    background: 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{c.icon}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{c.label}</span>
                    {url ? (
                      <a className="btn ghost sm" href={url} target="_blank" rel="noreferrer">
                        Link →
                      </a>
                    ) : catFiles.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>vazio</span>
                    ) : null}
                  </div>
                  {catFiles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 32 }}>
                      {catFiles.map((f) => (
                        <a
                          key={f.id}
                          className="pill"
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          title={f.name}
                          style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          ⬇ {f.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {canManage && (
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn sm" onClick={() => startEdit(open)}>
                Editar & anexar arquivos
              </button>
              <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => remove(open.id)}>
                Excluir
              </button>
            </div>
          )}
        </Modal>
      )}

      {editingId && (
        <Modal title={editingId === 'new' ? 'Novo licenciado' : `Editar — ${draft.name}`} onClose={() => setEditingId(null)}>
          <div className="form-field">
            <label>Nome</label>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ex.: Bluey" />
          </div>
          <div className="responsive-row">
            <div className="form-field" style={{ flex: 2 }}>
              <label>Licenciante</label>
              <input value={draft.licensor} onChange={(e) => setDraft({ ...draft, licensor: e.target.value })} placeholder="ex.: BBC Studios" />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label>Origem do guia</label>
              <select value={draft.source_type} onChange={(e) => setDraft({ ...draft, source_type: e.target.value as 'site' | 'drive' })}>
                <option value="site">Site próprio</option>
                <option value="drive">Google Drive</option>
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label>Cor</label>
              <input value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} placeholder="var(--accent) ou #RRGGBB" />
            </div>
          </div>
          <div className="form-field">
            <label>Acesso ao guia real — site/Drive</label>
            <input value={draft.guide_url} onChange={(e) => setDraft({ ...draft, guide_url: e.target.value })} placeholder="cole o link do site ou da pasta do Drive" />
          </div>
          <div className="form-field">
            <label>Como acessar (login / observações)</label>
            <textarea
              value={draft.access_info}
              onChange={(e) => setDraft({ ...draft, access_info: e.target.value })}
              placeholder="ex.: acessar em brand.marca.com · usuário: cardoso · senha no gerenciador da equipe"
              rows={2}
            />
          </div>

          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-faint)', fontWeight: 600, margin: '10px 0 2px' }}>
            Assets — envie arquivos ou cole um link
          </div>
          {editingId === 'new' && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 0 }}>Salve primeiro para poder anexar arquivos.</p>
          )}
          {CATEGORIES.map((c) => {
            const lid = editingId && editingId !== 'new' ? editingId : null;
            const catFiles = lid ? filesFor(lid, c.cat) : [];
            const uploadKey = `${editingId}:${c.cat}`;
            return (
              <div className="form-field" key={c.key}>
                <label>
                  {c.icon} {c.label}
                </label>
                <input
                  value={draft[c.key] as string}
                  onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })}
                  placeholder="link do asset (opcional)"
                />
                {lid && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 6 }}>
                    {catFiles.map((f) => (
                      <span key={f.id} className="pill" title={f.name} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        📎 {f.name}
                        <button type="button" onClick={() => removeAsset(f)} title="Remover" style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', padding: 0, fontSize: 13 }}>
                          ✕
                        </button>
                      </span>
                    ))}
                    <label className="btn ghost sm" style={{ cursor: 'pointer', margin: 0 }}>
                      {uploadingCat === uploadKey ? 'Enviando…' : '⬆ Enviar arquivo'}
                      <input
                        type="file"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadAsset(lid, c.cat, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn" disabled={busy || !draft.name.trim()} onClick={save}>
              {busy ? 'Salvando…' : 'Salvar'}
            </button>
            <button className="btn ghost" onClick={() => setEditingId(null)}>
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
