import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import { CAMPAIGN_STATUSES, type CampaignStatus, type Profile } from '../../types/database';

export default function CampaignConfiguracoes() {
  const { profile } = useAuth();
  const { campaign, reload } = useCampaignWorkspace();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ownerId, setOwnerId] = useState(campaign.owner_id ?? '');
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isPrivileged = profile?.role === 'diretoria' || profile?.role === 'administrador';

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .then(({ data }) => setProfiles((data as Profile[]) ?? []));
  }, []);

  async function save() {
    if (!profile) return;
    await supabase.from('campaigns').update({ owner_id: ownerId || null, status }).eq('id', campaign.id);
    await logActivity({ actorId: profile.id, actionText: 'Configurações da campanha atualizadas', campaignId: campaign.id });
    reload();
  }

  async function archive() {
    if (!profile) return;
    await supabase.from('campaigns').update({ status: 'cancelada' }).eq('id', campaign.id);
    await logActivity({ actorId: profile.id, actionText: 'Campanha arquivada/cancelada', campaignId: campaign.id });
    setStatus('cancelada');
    reload();
  }

  async function handleDelete() {
    await supabase.from('campaigns').delete().eq('id', campaign.id);
    navigate('/campanhas');
  }

  return (
    <div>
      <div className="section-head">
        <h2>Configurações</h2>
      </div>

      <div className="panel">
        <h4>Responsável e status</h4>
        <div className="form-field">
          <label htmlFor="cfg-owner">Responsável pela campanha</label>
          <select id="cfg-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">Sem responsável</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="cfg-status">Status</label>
          <select id="cfg-status" value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus)}>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn sm" onClick={save}>
          Salvar
        </button>
      </div>

      <div className="panel">
        <h4>Arquivar campanha</h4>
        <p style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>
          Marca a campanha como cancelada — ela some da barra de progresso ativa mas continua acessível e no histórico.
        </p>
        <button className="btn ghost sm" onClick={archive} disabled={status === 'cancelada'}>
          Arquivar
        </button>
      </div>

      {isPrivileged && (
        <div className="panel">
          <h4>Excluir campanha</h4>
          <p style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>
            Apaga a campanha e tudo o que está ligado a ela (demandas, objetivos, KPIs, verba, riscos, decisões…). Não
            pode ser desfeito.
          </p>
          {confirmingDelete ? (
            <div className="banner error">
              <span>Tem certeza? Isso é permanente.</span>
              <button className="btn ghost sm" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </button>
              <button className="btn sm" onClick={handleDelete}>
                Excluir campanha
              </button>
            </div>
          ) : (
            <button className="btn ghost sm" onClick={() => setConfirmingDelete(true)}>
              Excluir campanha
            </button>
          )}
        </div>
      )}
    </div>
  );
}
