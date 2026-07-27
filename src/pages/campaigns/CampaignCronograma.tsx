import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import CampaignTaskDrawer from '../../components/CampaignTaskDrawer';
import { useCampaignWorkspace } from '../../context/CampaignWorkspaceContext';
import { CAMPAIGN_TASK_STAGES, type CampaignTask, type Product, type Profile } from '../../types/database';

const STAGE_COLOR: Record<string, string> = {
  backlog: 'var(--text-faint)',
  planejada: 'var(--violet)',
  producao: 'var(--blue)',
  revisao: 'var(--yellow)',
  aguardando_aprovacao: 'var(--yellow)',
  aprovada: 'var(--green)',
  publicada: 'var(--green)',
  concluida: 'var(--text-faint)',
  cancelada: 'var(--red)',
};

function toDate(s: string) {
  return new Date(s + 'T00:00');
}
function dayDiff(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function CampaignCronograma() {
  const { campaign } = useCampaignWorkspace();
  const [tasks, setTasks] = useState<CampaignTask[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dependencies, setDependencies] = useState<{ task_id: string; depends_on_id: string }[]>([]);
  const [zoom, setZoom] = useState<'semanal' | 'mensal'>('semanal');
  const [drawerTask, setDrawerTask] = useState<CampaignTask | null | 'new'>(null);
  const [dragState, setDragState] = useState<{ id: string; startX: number; origStart: Date; origDue: Date } | null>(null);

  async function load() {
    const [tasksRes, profilesRes, productsRes, depsRes] = await Promise.all([
      supabase.from('campaign_tasks').select('*').eq('campaign_id', campaign.id).order('start_date'),
      supabase.from('profiles').select('*'),
      supabase.from('products').select('*').order('name'),
      supabase.from('campaign_task_dependencies').select('*'),
    ]);
    setTasks((tasksRes.data as CampaignTask[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setProducts((productsRes.data as Product[]) ?? []);
    setDependencies((depsRes.data as { task_id: string; depends_on_id: string }[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  const scheduled = tasks.filter((t) => t.start_date && t.due_date);
  const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));

  const dayWidth = zoom === 'semanal' ? 34 : 11;

  const { rangeStart, totalDays } = useMemo(() => {
    if (scheduled.length === 0) {
      const today = new Date(new Date().toDateString());
      return { rangeStart: today, totalDays: 30 };
    }
    const starts = scheduled.map((t) => toDate(t.start_date!));
    const dues = scheduled.map((t) => toDate(t.due_date!));
    const min = new Date(Math.min(...starts.map((d) => d.getTime()), new Date().getTime()));
    const max = new Date(Math.max(...dues.map((d) => d.getTime())));
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 4);
    return { rangeStart: min, totalDays: Math.max(14, dayDiff(min, max)) };
  }, [scheduled]);

  const todayOffset = dayDiff(rangeStart, new Date(new Date().toDateString()));

  function depNamesFor(taskId: string) {
    return dependencies
      .filter((d) => d.task_id === taskId)
      .map((d) => tasksById[d.depends_on_id]?.title)
      .filter(Boolean);
  }

  async function commitMove(taskId: string, newStart: Date, newDue: Date) {
    await supabase.from('campaign_tasks').update({ start_date: fmtDate(newStart), due_date: fmtDate(newDue) }).eq('id', taskId);
    load();
  }

  function onBarMouseDown(t: CampaignTask, e: ReactMouseEvent) {
    e.stopPropagation();
    setDragState({ id: t.id, startX: e.clientX, origStart: toDate(t.start_date!), origDue: toDate(t.due_date!) });
  }

  useEffect(() => {
    if (!dragState) return;
    function onMove(e: MouseEvent) {
      // visual feedback handled via re-render using deltaDays computed on mouseup for simplicity
      e.preventDefault();
    }
    function onUp(e: MouseEvent) {
      if (!dragState) return;
      const deltaDays = Math.round((e.clientX - dragState.startX) / dayWidth);
      if (deltaDays !== 0) {
        const newStart = new Date(dragState.origStart);
        newStart.setDate(newStart.getDate() + deltaDays);
        const newDue = new Date(dragState.origDue);
        newDue.setDate(newDue.getDate() + deltaDays);
        const dependents = dependencies.filter((d) => d.depends_on_id === dragState.id);
        commitMove(dragState.id, newStart, newDue).then(() => {
          if (dependents.length > 0) {
            // eslint-disable-next-line no-alert
            console.info(`${dependents.length} demanda(s) dependente(s) podem precisar de ajuste de data.`);
          }
        });
      }
      setDragState(null);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, dayWidth]);

  const dependentsWarning = (taskId: string) => dependencies.some((d) => d.depends_on_id === taskId);

  return (
    <div>
      <div className="section-head">
        <h2>Cronograma</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="filters-row" style={{ margin: 0 }}>
            <div className={`filter-chip${zoom === 'semanal' ? ' active' : ''}`} onClick={() => setZoom('semanal')}>
              Semanal
            </div>
            <div className={`filter-chip${zoom === 'mensal' ? ' active' : ''}`} onClick={() => setZoom('mensal')}>
              Mensal
            </div>
          </div>
          <button className="btn" onClick={() => setDrawerTask('new')}>
            + Nova demanda
          </button>
        </div>
      </div>

      {scheduled.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◐</span>Nenhuma demanda com início/prazo definidos ainda — abra uma demanda e preencha as
          datas para ela aparecer aqui.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', minWidth: totalDays * dayWidth + 200 }}>
            <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
              <div style={{ height: 28, borderBottom: '1px solid var(--border)' }} />
              {scheduled.map((t) => (
                <div
                  key={t.id}
                  style={{ height: 34, padding: '6px 8px', fontSize: 11.5, borderBottom: '1px solid var(--border)', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                  onClick={() => setDrawerTask(t)}
                  title={depNamesFor(t.id).length > 0 ? `Depende de: ${depNamesFor(t.id).join(', ')}` : undefined}
                >
                  {t.is_milestone ? '◆ ' : ''}
                  {t.title}
                  {depNamesFor(t.id).length > 0 && <span style={{ color: 'var(--text-faint)' }}> · depende de {depNamesFor(t.id).length}</span>}
                </div>
              ))}
            </div>
            <div style={{ position: 'relative', width: totalDays * dayWidth }}>
              <div style={{ height: 28, borderBottom: '1px solid var(--border)', position: 'relative', fontSize: 10, color: 'var(--text-faint)' }}>
                {Array.from({ length: Math.ceil(totalDays / (zoom === 'semanal' ? 7 : 30)) }, (_, i) => {
                  const d = new Date(rangeStart);
                  d.setDate(d.getDate() + i * (zoom === 'semanal' ? 7 : 30));
                  return (
                    <div key={i} style={{ position: 'absolute', left: i * (zoom === 'semanal' ? 7 : 30) * dayWidth, top: 6 }}>
                      {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </div>
                  );
                })}
              </div>
              <div style={{ position: 'absolute', top: 28, bottom: 0, left: todayOffset * dayWidth, width: 1, background: 'var(--accent)', zIndex: 1 }} />
              {scheduled.map((t) => {
                const start = toDate(t.start_date!);
                const due = toDate(t.due_date!);
                const left = dayDiff(rangeStart, start) * dayWidth;
                const width = Math.max(dayWidth, (dayDiff(start, due) + 1) * dayWidth);
                return (
                  <div
                    key={t.id}
                    style={{ position: 'relative', height: 34, borderBottom: '1px solid var(--border)' }}
                  >
                    <div
                      onMouseDown={(e) => onBarMouseDown(t, e)}
                      onClick={() => setDrawerTask(t)}
                      style={{
                        position: 'absolute',
                        left,
                        width,
                        top: 7,
                        height: 20,
                        borderRadius: t.is_milestone ? '50%' : 5,
                        background: STAGE_COLOR[t.stage] ?? 'var(--violet)',
                        opacity: dragState?.id === t.id ? 0.5 : 0.85,
                        cursor: 'grab',
                        fontSize: 9.5,
                        color: '#0a0a0a',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 6px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                      }}
                      title={`${t.title} (${CAMPAIGN_TASK_STAGES.find((s) => s.key === t.stage)?.label})${dependentsWarning(t.id) ? ' — outras demandas dependem desta' : ''}`}
                    >
                      {zoom === 'semanal' && t.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {drawerTask && (
        <CampaignTaskDrawer
          task={drawerTask === 'new' ? null : drawerTask}
          campaignId={campaign.id}
          profiles={profiles}
          products={products}
          allTasks={tasks}
          onClose={() => setDrawerTask(null)}
          onSaved={() => {
            setDrawerTask(null);
            load();
          }}
        />
      )}
    </div>
  );
}
