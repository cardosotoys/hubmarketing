import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useProductDevWorkspace } from '../../context/ProductDevWorkspaceContext';
import {
  CERTIFICATION_STATUSES,
  PRODUCT_DEV_PHASES,
  PRODUCT_DEV_TRACKS,
  type ActivityLogEntry,
  type ProductDevPackaging,
  type ProductDevRisk,
  type ProductDevTask,
} from '../../types/database';

function money(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProductDevResumo() {
  const { item, gates } = useProductDevWorkspace();
  const [tasks, setTasks] = useState<ProductDevTask[]>([]);
  const [packaging, setPackaging] = useState<ProductDevPackaging[]>([]);
  const [risks, setRisks] = useState<ProductDevRisk[]>([]);
  const [activity, setActivity] = useState<(ActivityLogEntry & { actor: { name: string } | null })[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('product_dev_tasks').select('*').eq('item_id', item.id),
      supabase.from('product_dev_packaging').select('*').eq('item_id', item.id),
      supabase.from('product_dev_risks').select('*').eq('item_id', item.id),
      supabase
        .from('activity_log')
        .select('*, actor:profiles(name)')
        .eq('product_dev_item_id', item.id)
        .order('created_at', { ascending: false })
        .limit(8),
    ]).then(([tRes, pRes, rRes, aRes]) => {
      setTasks((tRes.data as ProductDevTask[]) ?? []);
      setPackaging((pRes.data as ProductDevPackaging[]) ?? []);
      setRisks((rRes.data as ProductDevRisk[]) ?? []);
      setActivity((aRes.data as (ActivityLogEntry & { actor: { name: string } | null })[]) ?? []);
    });
  }, [item.id]);

  const gatesApproved = gates.filter((g) => g.decision === 'aprovado').length;
  const tasksDone = tasks.filter((t) => t.done).length;
  const tasksPercent = tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0;
  const openRisks = risks.filter((r) => r.status === 'aberto' || r.status === 'monitorando').length;
  const certLabel = CERTIFICATION_STATUSES.find((c) => c.key === item.certification_status)?.label ?? '';
  const labelingBlocked = packaging.some((p) => p.labeling_status !== 'validada');
  const phase = PRODUCT_DEV_PHASES.find((p) => p.n === item.current_phase);

  const marketingTasks = tasks.filter((t) => t.track === 'marketing');
  const marketingDone = marketingTasks.filter((t) => t.done).length;

  return (
    <div>
      <div className="section-head">
        <h2>Resumo</h2>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Fase atual</div>
          <div className="stat-num">{item.current_phase}/9</div>
          <div className="stat-trend">{phase?.name}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Portões aprovados</div>
          <div className="stat-num">{gatesApproved}/9</div>
          <div className="stat-trend">go registrados</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Atividades concluídas</div>
          <div className="stat-num">{tasksPercent}%</div>
          <div className="stat-trend">{tasksDone} de {tasks.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Riscos abertos</div>
          <div className="stat-num" style={{ color: openRisks > 0 ? 'var(--yellow)' : 'var(--text)' }}>
            {openRisks}
          </div>
          <div className="stat-trend">em acompanhamento</div>
        </div>
      </div>

      <div className="cols4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
        <div className="panel">
          <h4>⛔ Bloqueios para o lançamento</h4>
          <div className="field-row">
            <span className="k">Certificação INMETRO</span>
            <span style={{ color: item.certification_status === 'aprovado' ? 'var(--green)' : 'var(--red)' }}>
              {item.certification_status === 'aprovado' ? '✓ ' : '● '}
              {certLabel}
            </span>
          </div>
          <div className="field-row">
            <span className="k">Rotulagem da embalagem</span>
            <span style={{ color: packaging.length === 0 ? 'var(--text-faint)' : labelingBlocked ? 'var(--red)' : 'var(--green)' }}>
              {packaging.length === 0 ? 'sem embalagem cadastrada' : labelingBlocked ? '● pendente de validação' : '✓ validada'}
            </span>
          </div>
          {item.requires_anatel && (
            <div className="field-row">
              <span className="k">Homologação ANATEL</span>
              <span style={{ color: 'var(--yellow)' }}>necessária (rádio-frequência)</span>
            </div>
          )}
          <Link to="../certificacao" className="btn ghost sm" style={{ marginTop: 8 }}>
            Ver certificação →
          </Link>
        </div>

        <div className="panel">
          <h4>◆ Trilha de Marketing (paralela)</h4>
          <div className="field-row">
            <span className="k">Tarefas de GTM</span>
            <span>
              {marketingDone}/{marketingTasks.length} concluídas
            </span>
          </div>
          <div className="field-row">
            <span className="k">Meta de preço</span>
            <span>{money(item.target_price)}</span>
          </div>
          <div className="field-row">
            <span className="k">Meta de volume</span>
            <span>{item.target_volume ? item.target_volume.toLocaleString('pt-BR') + ' un.' : '—'}</span>
          </div>
          <Link to="../marketing" className="btn ghost sm" style={{ marginTop: 8 }}>
            Ver marketing →
          </Link>
        </div>

        <div className="panel">
          <h4>◫ Ficha do produto</h4>
          <div className="field-row">
            <span className="k">Faixa etária</span>
            <span>{item.age_range || '—'}</span>
          </div>
          <div className="field-row">
            <span className="k">Material</span>
            <span>{item.material || '—'}</span>
          </div>
          <div className="field-row">
            <span className="k">Investimento em molde</span>
            <span>{money(item.tooling_investment)}</span>
          </div>
          <div className="field-row">
            <span className="k">Licenciado</span>
            <span>{item.licensed ? 'Sim' : 'Não'}</span>
          </div>
          <Link to="../ficha" className="btn ghost sm" style={{ marginTop: 8 }}>
            Ver ficha →
          </Link>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h4>Atividade recente</h4>
        {activity.length === 0 ? (
          <div className="page-sub">Nenhuma atividade registrada ainda.</div>
        ) : (
          activity.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span>
                <strong>{a.actor?.name ?? '—'}</strong> {a.action_text}
                {a.detail ? ` · ${a.detail}` : ''}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                {new Date(a.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="page-sub" style={{ marginTop: 12 }}>
        Trilhas: {PRODUCT_DEV_TRACKS.map((t) => t.label).join(' · ')} rodam em paralelo desde a Fase 1.
      </div>
    </div>
  );
}
