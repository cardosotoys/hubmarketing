import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import { normalizeUrl } from '../../lib/url';
import { createPackagingProject } from '../../lib/packaging';
import Modal from '../../components/Modal';
import { useProductDevWorkspace } from '../../context/ProductDevWorkspaceContext';
import {
  PACKAGING_ART_STATUSES,
  PACKAGING_KINDS,
  PACKAGING_LABELING_STATUSES,
  PACKAGING_TEST_STATUSES,
  PACKAGING_TRACKS,
  PRIORITY_LABELS,
  type PackagingArtStatus,
  type PackagingKind,
  type PackagingLabelingStatus,
  type PackagingTestStatus,
  type PackagingTrack,
  type Project,
  type ProductDevPackaging,
  type ProjectStage,
  type Task,
} from '../../types/database';

const LABELING_COLOR: Record<PackagingLabelingStatus, string> = {
  pendente: 'var(--red)',
  em_producao: 'var(--yellow)',
  validada: 'var(--green)',
};

const ROTULAGEM_CHECKLIST = [
  'Selo de identificação da conformidade do INMETRO',
  'Faixa etária + advertências de segurança (ex.: peças pequenas)',
  'Fabricante/importador com CNPJ e endereço',
  'País de origem',
  'Código de barras (EAN) e identificação de lote',
];

export default function ProductDevEmbalagem() {
  const { profile } = useAuth();
  const { item } = useProductDevWorkspace();
  const [rows, setRows] = useState<ProductDevPackaging[]>([]);
  const [editing, setEditing] = useState<ProductDevPackaging | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const { data } = await supabase.from('product_dev_packaging').select('*').eq('item_id', item.id).order('kind');
    setRows((data as ProductDevPackaging[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  async function remove(id: string) {
    await supabase.from('product_dev_packaging').delete().eq('id', id);
    load();
  }

  const labelingBlocked = rows.some((r) => r.labeling_status !== 'validada');

  return (
    <div>
      <MirrorSection />

      <div className="section-head">
        <h2>Especificação de embalagem</h2>
        <button className="btn" onClick={() => setShowNew(true)}>
          + Embalagem
        </button>
      </div>

      <div className="page-sub" style={{ marginTop: -6 }}>
        Sub-módulo acoplado — roda em paralelo às fases (conecta-se às Fases 2, 3, 5 e 6). A <strong>rotulagem</strong> é
        bloqueante: o produto não vai para a Fase 8 (lançamento) sem a arte validada na certificação.
      </div>

      {rows.length > 0 && (
        <div className="banner" style={{ background: labelingBlocked ? 'var(--surface-2)' : 'transparent', borderColor: labelingBlocked ? 'var(--red)' : 'var(--green)', marginTop: 10 }}>
          <span className="ic">{labelingBlocked ? '⛔' : '✓'}</span>
          <span>
            {labelingBlocked
              ? 'Rotulagem pendente em ao menos uma embalagem — lançamento bloqueado.'
              : 'Rotulagem validada em todas as embalagens.'}
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">▤</span>Nenhuma embalagem cadastrada — comece pela primária (blister/caixa/saco).
        </div>
      ) : (
        rows.map((r) => (
          <div className="panel" key={r.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0 }}>
                  {PACKAGING_KINDS.find((k) => k.key === r.kind)?.label ?? r.kind}
                  {r.pack_type ? ` · ${r.pack_type}` : ''}
                </h4>
                <span className="tag" style={{ background: 'var(--surface-2)', color: LABELING_COLOR[r.labeling_status] }}>
                  Rotulagem: {PACKAGING_LABELING_STATUSES.find((s) => s.key === r.labeling_status)?.label}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn ghost sm" onClick={() => setEditing(r)}>
                  ✎ Editar
                </button>
                <button className="btn ghost sm" onClick={() => remove(r.id)}>
                  ✕
                </button>
              </div>
            </div>
            <div className="field-row">
              <span className="k">Dimensões</span>
              <span>{r.dimensions || '— (travar após a peça real, Fase 5)'}</span>
            </div>
            <div className="field-row">
              <span className="k">Material</span>
              <span>{r.material || '—'}</span>
            </div>
            <div className="field-row">
              <span className="k">Arte</span>
              <span>{PACKAGING_ART_STATUSES.find((s) => s.key === r.art_status)?.label}</span>
            </div>
            <div className="field-row">
              <span className="k">Teste de proteção</span>
              <span>{PACKAGING_TEST_STATUSES.find((s) => s.key === r.protection_test_status)?.label}</span>
            </div>
            <div className="field-row">
              <span className="k">Fornecedor</span>
              <span>{r.supplier || '—'}</span>
            </div>
            <div className="field-row">
              <span className="k">Custo unitário</span>
              <span>{r.unit_cost != null ? r.unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</span>
            </div>
            {r.guide_url && (
              <div className="field-row">
                <span className="k">Guia anexo</span>
                <a href={r.guide_url} target="_blank" rel="noreferrer">
                  abrir guia de embalagem →
                </a>
              </div>
            )}
            {r.notes && (
              <div className="field-row">
                <span className="k">Notas</span>
                <span>{r.notes}</span>
              </div>
            )}
          </div>
        ))
      )}

      <div className="panel" style={{ marginTop: 12 }}>
        <h4>Checklist mínimo de rotulagem obrigatória</h4>
        <div className="page-sub" style={{ marginBottom: 6 }}>
          O guia de embalagem anexado é a fonte de verdade para o detalhamento. Mínimo legal:
        </div>
        {ROTULAGEM_CHECKLIST.map((c) => (
          <div key={c} className="field-row">
            <span style={{ color: 'var(--text-faint)' }}>▢</span>
            <span>{c}</span>
          </div>
        ))}
      </div>

      {(showNew || editing) && (
        <PackagingModal
          itemId={item.id}
          actorId={profile?.id ?? ''}
          existing={editing}
          onClose={() => {
            setShowNew(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowNew(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// Espelho: projetos de embalagem (kind='embalagem') vinculados a este produto de desenvolvimento.
// Mesma fonte de dado da área Embalagens — atualizar lá reflete aqui e vice-versa.
function MirrorSection() {
  const { profile } = useAuth();
  const { item } = useProductDevWorkspace();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Pick<Task, 'id' | 'project_id' | 'stage_id'>[]>([]);
  const [stages, setStages] = useState<Pick<ProjectStage, 'id' | 'project_id' | 'is_final'>[]>([]);
  const [creating, setCreating] = useState(false);
  const [track, setTrack] = useState<PackagingTrack>('criacao');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: projs } = await supabase
      .from('projects')
      .select('*')
      .eq('kind', 'embalagem')
      .eq('product_dev_item_id', item.id)
      .order('created_at', { ascending: false });
    const list = (projs as Project[]) ?? [];
    setProjects(list);
    const ids = list.map((p) => p.id);
    if (ids.length > 0) {
      const [{ data: t }, { data: s }] = await Promise.all([
        supabase.from('tasks').select('id, project_id, stage_id').in('project_id', ids),
        supabase.from('stages').select('id, project_id, is_final').in('project_id', ids),
      ]);
      setTasks((t as Pick<Task, 'id' | 'project_id' | 'stage_id'>[]) ?? []);
      setStages((s as Pick<ProjectStage, 'id' | 'project_id' | 'is_final'>[]) ?? []);
    } else {
      setTasks([]);
      setStages([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const finalStageIds = new Set(stages.filter((s) => s.is_final).map((s) => s.id));

  function progressFor(projectId: string) {
    const ts = tasks.filter((t) => t.project_id === projectId);
    const done = ts.filter((t) => finalStageIds.has(t.stage_id)).length;
    return { total: ts.length, done, percent: ts.length > 0 ? Math.round((done / ts.length) * 100) : 0 };
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const newId = await createPackagingProject({
      name,
      brandId: item.brand_id,
      track,
      priority: 'medium',
      actorId: profile?.id ?? '',
      productDevItemId: item.id,
    });
    setBusy(false);
    if (newId) navigate(`/projetos/${newId}`);
  }

  return (
    <div className="panel" style={{ marginBottom: 14, borderLeft: '3px solid var(--violet)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h4 style={{ margin: 0 }}>Projetos de embalagem vinculados (espelho)</h4>
        <button className="btn sm" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Cancelar' : '+ Projeto de embalagem'}
        </button>
      </div>
      <div className="page-sub" style={{ margin: '4px 0 8px' }}>
        Mesma fonte de dado da área <Link to="/design-produto/embalagens">Embalagens</Link> — o que mudar lá reflete
        aqui.
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="responsive-row" style={{ alignItems: 'flex-end', marginBottom: 10 }}>
          <div className="form-field" style={{ flex: 2 }}>
            <label htmlFor="mir-name">Nome do projeto</label>
            <input id="mir-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`Embalagem ${item.name}`} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="mir-track">Trilha</label>
            <select id="mir-track" value={track} onChange={(e) => setTrack(e.target.value as PackagingTrack)}>
              {PACKAGING_TRACKS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Criando…' : 'Criar e abrir'}
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="page-sub">Nenhum projeto de embalagem vinculado a este produto ainda.</div>
      ) : (
        projects.map((p) => {
          const prog = progressFor(p.id);
          return (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div>
                <Link to={`/projetos/${p.id}`} style={{ fontWeight: 600 }}>
                  {p.name}
                </Link>
                <span className="tag" style={{ background: 'var(--surface-2)', marginLeft: 8, color: p.packaging_track === 'criacao' ? 'var(--violet)' : 'var(--blue)' }}>
                  {PACKAGING_TRACKS.find((t) => t.key === p.packaging_track)?.label ?? '—'}
                </span>
                <span className={`prio ${p.priority}`} style={{ marginLeft: 6 }}>
                  {PRIORITY_LABELS[p.priority]}
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                {prog.total > 0 ? `${prog.done}/${prog.total} demandas · ${prog.percent}%` : 'sem demandas'}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

function PackagingModal({
  itemId,
  actorId,
  existing,
  onClose,
  onSaved,
}: {
  itemId: string;
  actorId: string;
  existing: ProductDevPackaging | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<PackagingKind>(existing?.kind ?? 'primaria');
  const [packType, setPackType] = useState(existing?.pack_type ?? '');
  const [dimensions, setDimensions] = useState(existing?.dimensions ?? '');
  const [material, setMaterial] = useState(existing?.material ?? '');
  const [artStatus, setArtStatus] = useState<PackagingArtStatus>(existing?.art_status ?? 'nao_iniciada');
  const [labelingStatus, setLabelingStatus] = useState<PackagingLabelingStatus>(existing?.labeling_status ?? 'pendente');
  const [testStatus, setTestStatus] = useState<PackagingTestStatus>(existing?.protection_test_status ?? 'nao_testado');
  const [supplier, setSupplier] = useState(existing?.supplier ?? '');
  const [unitCost, setUnitCost] = useState(existing?.unit_cost?.toString() ?? '');
  const [guideUrl, setGuideUrl] = useState(existing?.guide_url ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      item_id: itemId,
      kind,
      pack_type: packType,
      dimensions,
      material,
      art_status: artStatus,
      labeling_status: labelingStatus,
      protection_test_status: testStatus,
      supplier,
      unit_cost: unitCost ? Number(unitCost) : null,
      guide_url: guideUrl ? normalizeUrl(guideUrl) : '',
      notes,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await supabase.from('product_dev_packaging').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('product_dev_packaging').insert(payload);
    }
    await logActivity({
      actorId,
      actionText: existing ? 'Embalagem atualizada' : 'Embalagem cadastrada',
      detail: PACKAGING_KINDS.find((k) => k.key === kind)?.label ?? '',
      productDevItemId: itemId,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <Modal title={existing ? 'Editar embalagem' : 'Nova embalagem'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pk-kind">Tipo</label>
            <select id="pk-kind" value={kind} onChange={(e) => setKind(e.target.value as PackagingKind)}>
              {PACKAGING_KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label} — {k.hint}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pk-type">Formato</label>
            <input id="pk-type" placeholder="blister, caixa, display…" value={packType} onChange={(e) => setPackType(e.target.value)} />
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pk-dim">Dimensões finais</label>
            <input id="pk-dim" placeholder="L × A × P (após a peça real)" value={dimensions} onChange={(e) => setDimensions(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pk-mat">Material</label>
            <input id="pk-mat" placeholder="papelão, PET, PVC…" value={material} onChange={(e) => setMaterial(e.target.value)} />
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pk-art">Status da arte</label>
            <select id="pk-art" value={artStatus} onChange={(e) => setArtStatus(e.target.value as PackagingArtStatus)}>
              {PACKAGING_ART_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pk-label">Rotulagem (bloqueante)</label>
            <select id="pk-label" value={labelingStatus} onChange={(e) => setLabelingStatus(e.target.value as PackagingLabelingStatus)}>
              {PACKAGING_LABELING_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="responsive-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pk-test">Teste de proteção</label>
            <select id="pk-test" value={testStatus} onChange={(e) => setTestStatus(e.target.value as PackagingTestStatus)}>
              {PACKAGING_TEST_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="pk-cost">Custo unitário (R$)</label>
            <input id="pk-cost" type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="pk-supplier">Fornecedor</label>
          <input id="pk-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="pk-guide">Link do guia de embalagem (anexo)</label>
          <input id="pk-guide" placeholder="https://…" value={guideUrl} onChange={(e) => setGuideUrl(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="pk-notes">Notas</label>
          <textarea id="pk-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
