import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';

interface ActivityRow {
  id: string;
  action_text: string;
  detail: string;
  created_at: string;
  actor: { name: string } | null;
  campaign_task: { title: string } | null;
}

export default function CampaignHistorico() {
  const { campaign } = useCampaignWorkspace();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('activity_log')
      .select('*, actor:profiles(name), campaign_task:campaign_tasks(title)')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRows((data as ActivityRow[]) ?? []);
        setLoading(false);
      });
  }, [campaign.id]);

  if (loading) return <div className="page-sub">Carregando histórico…</div>;

  return (
    <div>
      <div className="section-head">
        <h2>Histórico</h2>
      </div>
      {rows.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhuma atividade registrada ainda nesta campanha.
        </div>
      ) : (
        <table className="simple">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label="Ação">
                  {r.action_text}
                  {r.detail && <span style={{ color: 'var(--text-faint)' }}> — {r.detail}</span>}
                  {r.campaign_task && <span className="pill" style={{ marginLeft: 6 }}>{r.campaign_task.title}</span>}
                </td>
                <td data-label="Quem" style={{ color: 'var(--text-faint)' }}>
                  {r.actor?.name ?? '—'}
                </td>
                <td data-label="Quando" style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                  {new Date(r.created_at).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
