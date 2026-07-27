import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import { CAMPAIGN_PROGRESS_PHASES, CAMPAIGN_STATUSES, type CampaignObjective, type CampaignRisk, type CampaignTask } from '../../types/database';

const PHASE_ICON: Record<string, string> = {
  planejamento: '✎',
  producao: '⚙',
  aprovacao: '✓',
  execucao: '▶',
  finalizacao: '◆',
};

export default function CampaignRoadmap() {
  const { campaign } = useCampaignWorkspace();
  const [objectives, setObjectives] = useState<CampaignObjective[]>([]);
  const [risks, setRisks] = useState<CampaignRisk[]>([]);
  const [milestones, setMilestones] = useState<CampaignTask[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('campaign_objectives').select('*').eq('campaign_id', campaign.id).neq('status', 'concluido'),
      supabase.from('campaign_risks').select('*').eq('campaign_id', campaign.id).in('status', ['aberto', 'monitorando']),
      supabase
        .from('campaign_tasks')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('is_milestone', true)
        .not('due_date', 'is', null)
        .order('due_date'),
    ]).then(([objRes, riskRes, msRes]) => {
      setObjectives((objRes.data as CampaignObjective[]) ?? []);
      setRisks((riskRes.data as CampaignRisk[]) ?? []);
      setMilestones((msRes.data as CampaignTask[]) ?? []);
    });
  }, [campaign.id]);

  const currentIndex = CAMPAIGN_PROGRESS_PHASES.indexOf(campaign.status);
  const upcomingMilestones = milestones.filter((m) => new Date(m.due_date! + 'T00:00') >= new Date(new Date().toDateString()));

  return (
    <div>
      <div className="section-head">
        <h2>Roadmap</h2>
      </div>

      <div className="panel" style={{ display: 'flex', gap: 4 }}>
        {CAMPAIGN_PROGRESS_PHASES.map((phase, i) => {
          const label = CAMPAIGN_STATUSES.find((s) => s.key === phase)?.label ?? phase;
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
          return (
            <div
              key={phase}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '14px 6px',
                borderRadius: 8,
                background: state === 'current' ? 'var(--violet-dim)' : state === 'done' ? 'var(--surface-2)' : 'transparent',
                border: state === 'todo' ? '1px dashed var(--border)' : 'none',
              }}
            >
              <div style={{ fontSize: 18 }}>{PHASE_ICON[phase]}</div>
              <div style={{ fontSize: 11.5, marginTop: 4, color: state === 'current' ? 'var(--violet)' : state === 'done' ? 'var(--text)' : 'var(--text-faint)' }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {campaign.status === 'concluida' || campaign.status === 'cancelada' ? (
        <div className="banner soon">
          <span className="ic">◐</span>
          <span>Campanha {campaign.status === 'concluida' ? 'concluída' : 'cancelada'} — fora do ciclo de fases ativo.</span>
        </div>
      ) : (
        <div className="page-sub" style={{ marginTop: 12 }}>
          Fase atual: <b style={{ color: 'var(--text)' }}>{CAMPAIGN_STATUSES.find((s) => s.key === campaign.status)?.label}</b>. Mude a
          fase em <Link to="../configuracoes">Configurações</Link>.
        </div>
      )}

      <div className="grid3" style={{ marginTop: 12 }}>
        <div className="card">
          <h4>Objetivos em aberto</h4>
          {objectives.length === 0 ? (
            <p style={{ color: 'var(--text-faint)' }}>Nenhum objetivo pendente.</p>
          ) : (
            objectives.slice(0, 5).map((o) => <p key={o.id}>{o.description}</p>)
          )}
          <Link to="../objetivos" className="btn ghost sm" style={{ marginTop: 6 }}>
            Ver todos →
          </Link>
        </div>
        <div className="card">
          <h4>Riscos ativos</h4>
          {risks.length === 0 ? (
            <p style={{ color: 'var(--text-faint)' }}>Nenhum risco em aberto.</p>
          ) : (
            risks.slice(0, 5).map((r) => (
              <p key={r.id}>
                {r.description} <span style={{ color: 'var(--text-faint)' }}>({r.probability}/{r.impact})</span>
              </p>
            ))
          )}
          <Link to="../riscos" className="btn ghost sm" style={{ marginTop: 6 }}>
            Ver todos →
          </Link>
        </div>
        <div className="card">
          <h4>Próximos marcos</h4>
          {upcomingMilestones.length === 0 ? (
            <p style={{ color: 'var(--text-faint)' }}>Nenhum marco futuro definido.</p>
          ) : (
            upcomingMilestones.slice(0, 5).map((m) => (
              <p key={m.id}>
                {new Date(m.due_date! + 'T00:00').toLocaleDateString('pt-BR')} — {m.title}
              </p>
            ))
          )}
          <Link to="../cronograma" className="btn ghost sm" style={{ marginTop: 6 }}>
            Ver cronograma →
          </Link>
        </div>
      </div>
    </div>
  );
}
