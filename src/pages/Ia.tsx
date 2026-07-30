import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import Modal from '../components/Modal';
import type { Brand, IaBrandVoice, IaPersona, IaPrompt, IaSkill, IaTemplate } from '../types/database';

type Tab = 'prompts' | 'skills' | 'templates' | 'personas' | 'voz';

function TextBlockViewModal({
  title,
  meta,
  body,
  onEdit,
  onClose,
}: {
  title: string;
  meta?: string;
  body: string;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal title={title} onClose={onClose}>
      {meta && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>{meta}</div>}
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 14,
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--text)',
          fontFamily: 'inherit',
          maxHeight: '50vh',
          overflowY: 'auto',
          margin: 0,
        }}
      >
        {body}
      </pre>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Fechar
        </button>
        <button type="button" className="btn ghost" onClick={copy}>
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
        <button type="button" className="btn" onClick={onEdit}>
          Editar
        </button>
      </div>
    </Modal>
  );
}

export default function Ia() {
  const [tab, setTab] = useState<Tab>('prompts');
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    supabase
      .from('brands')
      .select('*')
      .then(({ data }) => setBrands((data as Brand[]) ?? []));
  }, []);

  return (
    <div className="page">
      <h1 className="page-title">IA</h1>
      <div className="page-sub">
        Prompts prontos, skills, templates, personas e brand voice das 3 marcas — acervo real do time, sem
        resposta automática ainda (isso depende de conectar uma API de IA de verdade mais pra frente).
      </div>

      <div className="detail-tabs">
        {(
          [
            ['prompts', 'Prompts'],
            ['skills', 'Skills'],
            ['templates', 'Templates'],
            ['personas', 'Personas'],
            ['voz', 'Brand Voice'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <div key={key} className={`dtab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </div>
        ))}
      </div>

      {tab === 'prompts' && <PromptsTab brands={brands} />}
      {tab === 'skills' && <SkillsTab brands={brands} />}
      {tab === 'templates' && <TemplatesTab brands={brands} />}
      {tab === 'personas' && <PersonasTab brands={brands} />}
      {tab === 'voz' && <BrandVoiceTab brands={brands} />}
    </div>
  );
}

function brandLabel(brands: Brand[], brandId: string | null) {
  if (!brandId) return 'Geral';
  return brands.find((b) => b.id === brandId)?.label ?? 'Geral';
}

// ============================================================
// Prompts
// ============================================================

function PromptsTab({ brands }: { brands: Brand[] }) {
  const { profile } = useAuth();
  const [prompts, setPrompts] = useState<IaPrompt[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewing, setViewing] = useState<IaPrompt | null>(null);
  const [editing, setEditing] = useState<IaPrompt | 'new' | null>(null);

  async function load() {
    const { data } = await supabase.from('ia_prompts').select('*').order('category').order('title');
    setPrompts((data as IaPrompt[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const categories = Array.from(new Set(prompts.map((p) => p.category))).sort();
  const filtered = prompts.filter((p) => categoryFilter === 'all' || p.category === categoryFilter);

  return (
    <div>
      <div className="filters-row">
        <div className={`filter-chip${categoryFilter === 'all' ? ' active' : ''}`} onClick={() => setCategoryFilter('all')}>
          Todas as categorias
        </div>
        {categories.map((c) => (
          <div key={c} className={`filter-chip${categoryFilter === c ? ' active' : ''}`} onClick={() => setCategoryFilter(c)}>
            {c}
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>{filtered.length} prompts</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Novo prompt
        </button>
      </div>

      <div className="grid3">
        {filtered.map((p) => (
          <div className="card" key={p.id} style={{ cursor: 'pointer' }} onClick={() => setViewing(p)}>
            <h4>{p.title}</h4>
            <p style={{ color: 'var(--text-faint)', fontSize: 11 }}>
              {p.category} · {brandLabel(brands, p.brand_id)}
            </p>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-dim)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                whiteSpace: 'pre-wrap',
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {p.body}
            </p>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="locked-banner">
            <span className="ic">◐</span>Nenhum prompt nessa categoria ainda.
          </div>
        )}
      </div>

      {viewing && (
        <TextBlockViewModal
          title={viewing.title}
          meta={`${viewing.category} · ${brandLabel(brands, viewing.brand_id)}`}
          body={viewing.body}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      )}

      {editing && (
        <PromptFormModal
          prompt={editing === 'new' ? null : editing}
          brands={brands}
          actorId={profile?.id ?? ''}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PromptFormModal({
  prompt,
  brands,
  actorId,
  onClose,
  onSaved,
}: {
  prompt: IaPrompt | null;
  brands: Brand[];
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(prompt);
  const [title, setTitle] = useState(prompt?.title ?? '');
  const [category, setCategory] = useState(prompt?.category ?? '');
  const [brandId, setBrandId] = useState(prompt?.brand_id ?? '');
  const [body, setBody] = useState(prompt?.body ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = { title: title.trim(), category: category.trim(), brand_id: brandId || null, body };
    if (isEdit && prompt) {
      await supabase.from('ia_prompts').update(fields).eq('id', prompt.id);
    } else {
      await supabase.from('ia_prompts').insert({ ...fields, created_by: actorId });
    }
    await logActivity({ actorId, actionText: isEdit ? 'Prompt de IA editado' : 'Prompt de IA criado', detail: title.trim() });
    onSaved();
  }

  async function handleDelete() {
    if (!prompt) return;
    await supabase.from('ia_prompts').delete().eq('id', prompt.id);
    await logActivity({ actorId, actionText: 'Prompt de IA excluído', detail: prompt.title });
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar prompt' : 'Novo prompt'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="pr-title">Título</label>
          <input id="pr-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pr-category">Categoria</label>
            <input id="pr-category" required value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Copywriting, Social Media…" />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pr-brand">Marca</label>
            <select id="pr-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">Geral (todas as marcas)</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="pr-body">Prompt</label>
          <textarea id="pr-body" required rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        {confirmingDelete ? (
          <div className="banner error">
            <span>Excluir este prompt?</span>
            <button type="button" className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn sm" onClick={handleDelete}>
              Excluir
            </button>
          </div>
        ) : (
          <div className="modal-actions">
            {isEdit && (
              <button type="button" className="btn ghost" onClick={() => setConfirmingDelete(true)}>
                Excluir
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn">
              {isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ============================================================
// Skills
// ============================================================

function SkillsTab({ brands }: { brands: Brand[] }) {
  const { profile } = useAuth();
  const [skills, setSkills] = useState<IaSkill[]>([]);
  const [viewing, setViewing] = useState<IaSkill | null>(null);
  const [editing, setEditing] = useState<IaSkill | 'new' | null>(null);

  async function load() {
    const { data } = await supabase.from('ia_skills').select('*').order('category').order('name');
    setSkills((data as IaSkill[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="page-sub" style={{ marginBottom: 14 }}>
        Instruções reutilizáveis pra tarefas específicas — mais focadas que um prompt solto (ex.: "revisar
        copy pro tom de voz Tópi", "gerar pauta de calendário editorial"). Acesse quando precisar em vez de
        reescrever do zero.
      </div>
      <div className="section-head">
        <h2>{skills.length} skills</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Nova skill
        </button>
      </div>

      <div className="grid3">
        {skills.map((s) => (
          <div className="card" key={s.id} style={{ cursor: 'pointer' }} onClick={() => setViewing(s)}>
            <h4>{s.name}</h4>
            <p style={{ color: 'var(--text-faint)', fontSize: 11 }}>
              {s.category} · {brandLabel(brands, s.brand_id)}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{s.description}</p>
          </div>
        ))}
        {skills.length === 0 && (
          <div className="locked-banner">
            <span className="ic">◐</span>Nenhuma skill cadastrada ainda.
          </div>
        )}
      </div>

      {viewing && (
        <TextBlockViewModal
          title={viewing.name}
          meta={`${viewing.category} · ${brandLabel(brands, viewing.brand_id)}`}
          body={viewing.body}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      )}

      {editing && (
        <SkillFormModal
          skill={editing === 'new' ? null : editing}
          brands={brands}
          actorId={profile?.id ?? ''}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function SkillFormModal({
  skill,
  brands,
  actorId,
  onClose,
  onSaved,
}: {
  skill: IaSkill | null;
  brands: Brand[];
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(skill);
  const [name, setName] = useState(skill?.name ?? '');
  const [category, setCategory] = useState(skill?.category ?? '');
  const [brandId, setBrandId] = useState(skill?.brand_id ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [body, setBody] = useState(skill?.body ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = { name: name.trim(), category: category.trim(), brand_id: brandId || null, description, body };
    if (isEdit && skill) {
      await supabase.from('ia_skills').update(fields).eq('id', skill.id);
    } else {
      await supabase.from('ia_skills').insert({ ...fields, created_by: actorId });
    }
    await logActivity({ actorId, actionText: isEdit ? 'Skill de IA editada' : 'Skill de IA criada', detail: name.trim() });
    onSaved();
  }

  async function handleDelete() {
    if (!skill) return;
    await supabase.from('ia_skills').delete().eq('id', skill.id);
    await logActivity({ actorId, actionText: 'Skill de IA excluída', detail: skill.name });
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar skill' : 'Nova skill'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="sk-name">Nome</label>
          <input id="sk-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="sk-category">Categoria</label>
            <input id="sk-category" required value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Revisão, Planejamento…" />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="sk-brand">Marca</label>
            <select id="sk-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">Geral (todas as marcas)</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="sk-desc">Descrição curta</label>
          <input id="sk-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="sk-body">Instruções da skill</label>
          <textarea id="sk-body" required rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        {confirmingDelete ? (
          <div className="banner error">
            <span>Excluir esta skill?</span>
            <button type="button" className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn sm" onClick={handleDelete}>
              Excluir
            </button>
          </div>
        ) : (
          <div className="modal-actions">
            {isEdit && (
              <button type="button" className="btn ghost" onClick={() => setConfirmingDelete(true)}>
                Excluir
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn">
              {isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ============================================================
// Templates
// ============================================================

function TemplatesTab({ brands }: { brands: Brand[] }) {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<IaTemplate[]>([]);
  const [editing, setEditing] = useState<IaTemplate | 'new' | null>(null);

  async function load() {
    const { data } = await supabase.from('ia_templates').select('*').order('category').order('name');
    setTemplates((data as IaTemplate[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="section-head">
        <h2>{templates.length} templates</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Novo template
        </button>
      </div>

      <div className="grid3">
        {templates.map((t) => (
          <div className="card" key={t.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(t)}>
            <h4>{t.name}</h4>
            <p style={{ color: 'var(--text-faint)', fontSize: 11 }}>
              {t.category} · {brandLabel(brands, t.brand_id)}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t.description}</p>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="locked-banner">
            <span className="ic">◐</span>Nenhum template cadastrado ainda.
          </div>
        )}
      </div>

      {editing && (
        <TemplateFormModal
          template={editing === 'new' ? null : editing}
          brands={brands}
          actorId={profile?.id ?? ''}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function TemplateFormModal({
  template,
  brands,
  actorId,
  onClose,
  onSaved,
}: {
  template: IaTemplate | null;
  brands: Brand[];
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(template);
  const [name, setName] = useState(template?.name ?? '');
  const [category, setCategory] = useState(template?.category ?? '');
  const [brandId, setBrandId] = useState(template?.brand_id ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = { name: name.trim(), category: category.trim(), brand_id: brandId || null, description, body };
    if (isEdit && template) {
      await supabase.from('ia_templates').update(fields).eq('id', template.id);
    } else {
      await supabase.from('ia_templates').insert({ ...fields, created_by: actorId });
    }
    await logActivity({ actorId, actionText: isEdit ? 'Template de IA editado' : 'Template de IA criado', detail: name.trim() });
    onSaved();
  }

  async function handleDelete() {
    if (!template) return;
    await supabase.from('ia_templates').delete().eq('id', template.id);
    await logActivity({ actorId, actionText: 'Template de IA excluído', detail: template.name });
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar template' : 'Novo template'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="tp-name">Nome</label>
          <input id="tp-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="tp-category">Categoria</label>
            <input id="tp-category" required value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="tp-brand">Marca</label>
            <select id="tp-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">Geral (todas as marcas)</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="tp-desc">Descrição curta</label>
          <input id="tp-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="tp-body">Conteúdo do template</label>
          <textarea id="tp-body" required rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        {confirmingDelete ? (
          <div className="banner error">
            <span>Excluir este template?</span>
            <button type="button" className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn sm" onClick={handleDelete}>
              Excluir
            </button>
          </div>
        ) : (
          <div className="modal-actions">
            {isEdit && (
              <button type="button" className="btn ghost" onClick={() => setConfirmingDelete(true)}>
                Excluir
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn">
              {isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ============================================================
// Personas
// ============================================================

function PersonasTab({ brands }: { brands: Brand[] }) {
  const { profile } = useAuth();
  const [personas, setPersonas] = useState<IaPersona[]>([]);
  const [editing, setEditing] = useState<IaPersona | 'new' | null>(null);

  async function load() {
    const { data } = await supabase.from('ia_personas').select('*').order('name');
    setPersonas((data as IaPersona[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="section-head">
        <h2>{personas.length} personas</h2>
        <button className="btn" onClick={() => setEditing('new')}>
          + Nova persona
        </button>
      </div>

      <div className="grid3">
        {personas.map((p) => (
          <div className="card" key={p.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(p)}>
            <h4>{p.name}</h4>
            <p style={{ color: 'var(--text-faint)', fontSize: 11 }}>{brandLabel(brands, p.brand_id)}</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{p.description}</p>
          </div>
        ))}
        {personas.length === 0 && (
          <div className="locked-banner">
            <span className="ic">◐</span>Nenhuma persona cadastrada ainda.
          </div>
        )}
      </div>

      {editing && (
        <PersonaFormModal
          persona={editing === 'new' ? null : editing}
          brands={brands}
          actorId={profile?.id ?? ''}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PersonaFormModal({
  persona,
  brands,
  actorId,
  onClose,
  onSaved,
}: {
  persona: IaPersona | null;
  brands: Brand[];
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(persona);
  const [name, setName] = useState(persona?.name ?? '');
  const [brandId, setBrandId] = useState(persona?.brand_id ?? '');
  const [description, setDescription] = useState(persona?.description ?? '');
  const [pains, setPains] = useState(persona?.pains ?? '');
  const [goals, setGoals] = useState(persona?.goals ?? '');
  const [toneNotes, setToneNotes] = useState(persona?.tone_notes ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = { name: name.trim(), brand_id: brandId || null, description, pains, goals, tone_notes: toneNotes };
    if (isEdit && persona) {
      await supabase.from('ia_personas').update(fields).eq('id', persona.id);
    } else {
      await supabase.from('ia_personas').insert({ ...fields, created_by: actorId });
    }
    await logActivity({ actorId, actionText: isEdit ? 'Persona de IA editada' : 'Persona de IA criada', detail: name.trim() });
    onSaved();
  }

  async function handleDelete() {
    if (!persona) return;
    await supabase.from('ia_personas').delete().eq('id', persona.id);
    await logActivity({ actorId, actionText: 'Persona de IA excluída', detail: persona.name });
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar persona' : 'Nova persona'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="ps-name">Nome</label>
          <input id="ps-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="ps-brand">Marca</label>
          <select id="ps-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Geral (todas as marcas)</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ps-desc">Descrição</label>
          <textarea id="ps-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="ps-pains">Dores</label>
          <textarea id="ps-pains" rows={2} value={pains} onChange={(e) => setPains(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="ps-goals">Objetivos</label>
          <textarea id="ps-goals" rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="ps-tone">Como devemos falar com ela</label>
          <textarea id="ps-tone" rows={2} value={toneNotes} onChange={(e) => setToneNotes(e.target.value)} />
        </div>

        {confirmingDelete ? (
          <div className="banner error">
            <span>Excluir esta persona?</span>
            <button type="button" className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn sm" onClick={handleDelete}>
              Excluir
            </button>
          </div>
        ) : (
          <div className="modal-actions">
            {isEdit && (
              <button type="button" className="btn ghost" onClick={() => setConfirmingDelete(true)}>
                Excluir
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn">
              {isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ============================================================
// Brand Voice
// ============================================================

function BrandVoiceTab({ brands }: { brands: Brand[] }) {
  const { profile } = useAuth();
  const [brandKey, setBrandKey] = useState('');
  const [voices, setVoices] = useState<IaBrandVoice[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<IaBrandVoice>>({});

  async function load() {
    const { data } = await supabase.from('ia_brand_voice').select('*');
    setVoices((data as IaBrandVoice[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!brandKey && brands.length > 0) setBrandKey(brands[0].id);
  }, [brands, brandKey]);

  const voice = voices.find((v) => v.brand_id === brandKey) ?? null;

  function startEdit() {
    setDraft(
      voice ?? { archetype: '', tone_of_voice: '', dos: '', donts: '', sample_phrases: '' }
    );
    setEditing(true);
  }

  async function save() {
    if (!profile || !brandKey) return;
    const fields = { ...draft, brand_id: brandKey, updated_by: profile.id, updated_at: new Date().toISOString() };
    if (voice) {
      await supabase.from('ia_brand_voice').update(fields).eq('id', voice.id);
    } else {
      await supabase.from('ia_brand_voice').insert(fields);
    }
    await logActivity({
      actorId: profile.id,
      actionText: 'Brand voice de IA atualizado',
      detail: brands.find((b) => b.id === brandKey)?.label,
    });
    setEditing(false);
    load();
  }

  return (
    <div>
      <div className="brand-tabs">
        {brands.map((b) => (
          <div key={b.id} className={`brand-tab${brandKey === b.id ? ' active' : ''}`} onClick={() => { setBrandKey(b.id); setEditing(false); }}>
            <span className="sw" style={{ background: b.color }} />
            {b.label}
          </div>
        ))}
      </div>

      {editing ? (
        <div className="panel">
          <h4>Editar brand voice</h4>
          <div className="form-field">
            <label htmlFor="bv-archetype">Arquétipo</label>
            <input id="bv-archetype" value={draft.archetype ?? ''} onChange={(e) => setDraft((d) => ({ ...d, archetype: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="bv-tone">Tom de voz</label>
            <textarea id="bv-tone" rows={3} value={draft.tone_of_voice ?? ''} onChange={(e) => setDraft((d) => ({ ...d, tone_of_voice: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="bv-dos">Fazer</label>
            <textarea id="bv-dos" rows={2} value={draft.dos ?? ''} onChange={(e) => setDraft((d) => ({ ...d, dos: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="bv-donts">Evitar</label>
            <textarea id="bv-donts" rows={2} value={draft.donts ?? ''} onChange={(e) => setDraft((d) => ({ ...d, donts: e.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="bv-phrases">Frases de referência</label>
            <textarea id="bv-phrases" rows={2} value={draft.sample_phrases ?? ''} onChange={(e) => setDraft((d) => ({ ...d, sample_phrases: e.target.value }))} />
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setEditing(false)}>
              Cancelar
            </button>
            <button className="btn" onClick={save}>
              Salvar
            </button>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h4>Brand voice</h4>
            <button className="btn ghost sm" onClick={startEdit}>
              Editar
            </button>
          </div>
          {voice ? (
            <>
              <div className="field-row">
                <span className="k">Arquétipo</span>
                <span style={{ textAlign: 'right' }}>{voice.archetype || '—'}</span>
              </div>
              <div className="field-row">
                <span className="k">Tom de voz</span>
                <span style={{ textAlign: 'right' }}>{voice.tone_of_voice || '—'}</span>
              </div>
              <div className="field-row">
                <span className="k">Fazer</span>
                <span style={{ textAlign: 'right' }}>{voice.dos || '—'}</span>
              </div>
              <div className="field-row">
                <span className="k">Evitar</span>
                <span style={{ textAlign: 'right' }}>{voice.donts || '—'}</span>
              </div>
              <div className="field-row">
                <span className="k">Frases de referência</span>
                <span style={{ textAlign: 'right' }}>{voice.sample_phrases || '—'}</span>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>Nenhum brand voice cadastrado ainda pra essa marca.</p>
          )}
        </div>
      )}
    </div>
  );
}
