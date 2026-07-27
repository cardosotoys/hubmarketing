import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import Modal from '../components/Modal';
import { CAMPAIGN_STATUSES, type Brand, type Campaign, type CampaignStatus, type Priority } from '../types/database';

type CampaignWithRelations = Campaign & { brand: Brand };

const STATUS_COLOR: Record<CampaignStatus, string> = {
  planejamento: 'var(--violet)',
  producao: 'var(--blue)',
  aprovacao: 'var(--yellow)',
  execucao: 'var(--green)',
  finalizacao: 'var(--yellow)',
  concluida: 'var(--text-faint)',
  cancelada: 'var(--red)',
};

export default function Campaigns() {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignWithRelations[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CampaignStatus>('all');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [campaignsRes, brandsRes] = await Promise.all([
      supabase.from('campaigns').select('*, brand:brands(*)').order('start_date', { ascending: true }),
      supabase.from('brands').select('*'),
    ]);
    setCampaigns((campaignsRes.data as CampaignWithRelations[]) ?? []);
    setBrands((brandsRes.data as Brand[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = campaigns.filter((c) => {
    if (brandFilter !== 'all' && c.brand?.key !== brandFilter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="page">
      <h1 className="page-title">Campanhas</h1>
      <div className="page-sub">
        Cada campanha é um workspace completo: planejamento, objetivos, KPIs, cronograma, demandas, aprovações,
        riscos, decisões e verba num só lugar.
      </div>

      <div className="brand-tabs">
        <div className={`brand-tab${brandFilter === 'all' ? ' active' : ''}`} onClick={() => setBrandFilter('all')}>
          Todas as marcas
        </div>
        {brands.map((b) => (
          <div key={b.id} className={`brand-tab${brandFilter === b.key ? ' active' : ''}`} onClick={() => setBrandFilter(b.key)}>
            <span className="sw" style={{ background: b.color }} />
            {b.label}
          </div>
        ))}
      </div>

      <div className="filters-row">
        <div className={`filter-chip${statusFilter === 'all' ? ' active' : ''}`} onClick={() => setStatusFilter('all')}>
          Todos os status
        </div>
        {CAMPAIGN_STATUSES.map((s) => (
          <div
            key={s.key}
            className={`filter-chip${statusFilter === s.key ? ' active' : ''}`}
            onClick={() => setStatusFilter(s.key)}
          >
            {s.label}
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>{filtered.length} campanhas</h2>
        <button className="btn" onClick={() => setShowNew(true)}>
          + Nova campanha
        </button>
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhuma campanha ainda — crie a primeira.
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map((c) => (
            <Link key={c.id} to={`/campanhas/${c.id}/resumo`} className="project-card">
              <div className="brand-strip" style={{ background: c.brand?.color }} />
              <span className="pill" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-faint)' }}>
                {c.brand?.label}
              </span>
              <h3>{c.name}</h3>
              <p>{c.category || 'Sem categoria'}</p>
              <div className="project-meta">
                <span className="tag" style={{ background: 'var(--surface-2)', color: STATUS_COLOR[c.status] }}>
                  {CAMPAIGN_STATUSES.find((s) => s.key === c.status)?.label ?? c.status}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {c.start_date ? new Date(c.start_date + 'T00:00').toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNew && profile && (
        <NewCampaignModal
          brands={brands}
          actorId={profile.id}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
const PRIORITY_LABELS: Record<Priority, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };

function NewCampaignModal({
  brands,
  actorId,
  onClose,
  onCreated,
}: {
  brands: Brand[];
  actorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!brandId) {
      setError('Escolha uma marca.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        name,
        brand_id: brandId,
        category,
        priority,
        status: 'planejamento',
        start_date: startDate || null,
        end_date: endDate || null,
        owner_id: actorId,
        created_by: actorId,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await logActivity({ actorId, actionText: 'Campanha criada', detail: name, campaignId: data.id });
    onCreated();
  }

  return (
    <Modal title="Nova campanha" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="nc-name">Nome</label>
          <input id="nc-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="nc-brand">Marca</label>
          <select id="nc-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="nc-category">Categoria</label>
          <input
            id="nc-category"
            placeholder="Ex: Dia das Crianças, Black Friday, Licenciamento…"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="nc-priority">Prioridade</label>
          <select id="nc-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="nc-start">Início</label>
          <input id="nc-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="form-field">
          <label htmlFor="nc-end">Fim</label>
          <input id="nc-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        {error && (
          <div className="banner error">
            <span className="ic">✕</span>
            <span>{error}</span>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Criando…' : 'Criar campanha'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
