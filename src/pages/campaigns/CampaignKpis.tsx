import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import Modal from '../../components/Modal';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import type { CampaignKpi, CampaignKpiHistory, Profile } from '../../types/database';

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <div style={{ height: 30, color: 'var(--text-faint)', fontSize: 10 }}>Sem histórico suficiente</div>;
  }
  const w = 140;
  const h = 30;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const path = points.map((p, i) => `${i * step},${h - ((p - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={path} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
    </svg>
  );
}

export default function CampaignKpis() {
  const { profile } = useAuth();
  const { campaign } = useCampaignWorkspace();
  const [kpis, setKpis] = useState<CampaignKpi[]>([]);
  const [history, setHistory] = useState<Record<string, CampaignKpiHistory[]>>({});
  const [showNew, setShowNew] = useState(false);
  const [updatingKpi, setUpdatingKpi] = useState<CampaignKpi | null>(null);
  const [editingKpi, setEditingKpi] = useState<CampaignKpi | null>(null);

  async function load() {
    const kpisRes = await supabase.from('campaign_kpis').select('*').eq('campaign_id', campaign.id).order('created_at');
    const rows = (kpisRes.data as CampaignKpi[]) ?? [];
    setKpis(rows);
    if (rows.length > 0) {
      const historyRes = await supabase
        .from('campaign_kpi_history')
        .select('*')
        .in('kpi_id', rows.map((k) => k.id))
        .order('recorded_at');
      const grouped: Record<string, CampaignKpiHistory[]> = {};
      ((historyRes.data as CampaignKpiHistory[]) ?? []).forEach((h) => {
        (grouped[h.kpi_id] ??= []).push(h);
      });
      setHistory(grouped);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  return (
    <div>
      <div className="section-head">
        <h2>KPIs</h2>
        <button className="btn" onClick={() => setShowNew(true)}>
          + Novo KPI
        </button>
      </div>

      {kpis.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhum KPI cadastrado ainda — crie o primeiro (ex: ROAS, CTR, Leads…).
        </div>
      ) : (
        <div className="grid3">
          {kpis.map((k) => {
            const pct = k.target_value ? Math.round((k.current_value / k.target_value) * 100) : null;
            return (
              <div className="card" key={k.id}>
                <h4>{k.name}</h4>
                <p style={{ fontSize: 20, fontFamily: 'Space Grotesk', margin: '4px 0' }}>
                  {k.current_value}
                  {k.unit} {k.target_value != null && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>/ {k.target_value}{k.unit}</span>}
                </p>
                {pct !== null && <p style={{ color: pct >= 100 ? 'var(--green)' : 'var(--text-faint)' }}>{pct}% da meta</p>}
                <Sparkline points={(history[k.id] ?? []).map((h) => h.value)} />
                <p style={{ color: 'var(--text-faint)', fontSize: 11 }}>Fonte: {k.source || 'manual'}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="btn ghost sm" onClick={() => setUpdatingKpi(k)}>
                    Atualizar valor
                  </button>
                  <button className="btn ghost sm" onClick={() => setEditingKpi(k)}>
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <KpiFormModal campaignId={campaign.id} actorId={profile?.id ?? ''} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />
      )}
      {editingKpi && (
        <KpiFormModal
          kpi={editingKpi}
          campaignId={campaign.id}
          actorId={profile?.id ?? ''}
          onClose={() => setEditingKpi(null)}
          onSaved={() => {
            setEditingKpi(null);
            load();
          }}
        />
      )}
      {updatingKpi && (
        <UpdateValueModal
          kpi={updatingKpi}
          actorId={profile?.id ?? ''}
          campaignId={campaign.id}
          onClose={() => setUpdatingKpi(null)}
          onSaved={() => {
            setUpdatingKpi(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function UpdateValueModal({
  kpi,
  actorId,
  campaignId,
  onClose,
  onSaved,
}: {
  kpi: CampaignKpi;
  actorId: string;
  campaignId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(kpi.current_value.toString());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const num = Number(value);
    await supabase.from('campaign_kpis').update({ current_value: num, updated_at: new Date().toISOString() }).eq('id', kpi.id);
    await supabase.from('campaign_kpi_history').insert({ kpi_id: kpi.id, value: num });
    await logActivity({ actorId, actionText: 'KPI atualizado', detail: `${kpi.name}: ${num}${kpi.unit}`, campaignId });
    onSaved();
  }

  return (
    <Modal title={`Atualizar ${kpi.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="kpi-value">Novo valor</label>
          <input id="kpi-value" type="number" required autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function KpiFormModal({
  kpi,
  campaignId,
  actorId,
  onClose,
  onSaved,
}: {
  kpi?: CampaignKpi;
  campaignId: string;
  actorId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(kpi);
  const [name, setName] = useState(kpi?.name ?? '');
  const [unit, setUnit] = useState(kpi?.unit ?? '');
  const [targetValue, setTargetValue] = useState(kpi?.target_value?.toString() ?? '');
  const [currentValue, setCurrentValue] = useState(kpi?.current_value?.toString() ?? '0');
  const [source, setSource] = useState(kpi?.source ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [responsibleId, setResponsibleId] = useState(kpi?.responsible_id ?? '');

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .then(({ data }) => setProfiles((data as Profile[]) ?? []));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fields = {
      campaign_id: campaignId,
      name: name.trim(),
      unit: unit.trim(),
      target_value: targetValue ? Number(targetValue) : null,
      current_value: Number(currentValue) || 0,
      source: source.trim(),
      responsible_id: responsibleId || null,
    };
    if (isEdit && kpi) {
      await supabase.from('campaign_kpis').update(fields).eq('id', kpi.id);
    } else {
      const { data } = await supabase.from('campaign_kpis').insert(fields).select().single();
      if (data) await supabase.from('campaign_kpi_history').insert({ kpi_id: data.id, value: fields.current_value });
    }
    await logActivity({ actorId, actionText: isEdit ? 'KPI editado' : 'KPI criado', detail: name, campaignId });
    onSaved();
  }

  async function handleDelete() {
    if (!kpi) return;
    await supabase.from('campaign_kpis').delete().eq('id', kpi.id);
    await logActivity({ actorId, actionText: 'KPI removido', detail: kpi.name, campaignId });
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Editar KPI' : 'Novo KPI'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="kpi-name">Nome</label>
          <input id="kpi-name" required placeholder="Ex: ROAS, CTR, Leads…" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="kpi-target">Meta</label>
            <input id="kpi-target" type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="kpi-current">Valor atual</label>
            <input id="kpi-current" type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="kpi-unit">Unidade</label>
            <input id="kpi-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, R$, x" />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="kpi-source">Origem</label>
          <input id="kpi-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Manual, Meta Ads, Google Analytics…" />
        </div>
        <div className="form-field">
          <label htmlFor="kpi-responsible">Responsável</label>
          <select id="kpi-responsible" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
            <option value="">Sem responsável</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {confirmingDelete ? (
          <div className="banner error">
            <span>Excluir este KPI?</span>
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
