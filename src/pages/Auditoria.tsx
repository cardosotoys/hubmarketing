import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { ActivityLogEntry } from '../types/database';

type Row = ActivityLogEntry & {
  actor: { name: string } | null;
  project: { name: string } | null;
  campaign: { name: string } | null;
};

export default function Auditoria() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const isPrivileged = profile?.role === 'diretoria' || profile?.role === 'administrador';
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('all');
  const [contextFilter, setContextFilter] = useState('all');
  const [periodDays, setPeriodDays] = useState('all');

  useEffect(() => {
    if (!profile) return;
    const userId = profile.id;
    setLoading(true);

    async function load() {
      // Sem embeds de projects/campaigns aqui de propósito: a FK activity_log→campaigns não existe
      // em produção e o embed fazia a query inteira falhar (0 resultados). Nomes são resolvidos
      // no cliente logo abaixo. O embed de actor (profiles) é válido e continua.
      let q = supabase
        .from('activity_log')
        .select('*, actor:profiles(name)')
        .order('created_at', { ascending: false })
        .limit(isPrivileged ? 2000 : 300);

      if (!isPrivileged) {
        // Escopo pessoal: tudo que a pessoa fez, mais tudo em projetos/campanhas onde ela participa.
        const [memberProjectsRes, myTasksRes, myCampaignTasksRes, ownedCampaignsRes] = await Promise.all([
          supabase.from('project_members').select('project_id').eq('user_id', userId),
          supabase.from('tasks').select('project_id').eq('assignee_id', userId),
          supabase
            .from('campaign_tasks')
            .select('campaign_id')
            .or(`assignee_id.eq.${userId},reviewer_id.eq.${userId},approver_id.eq.${userId},requester_id.eq.${userId}`),
          supabase.from('campaigns').select('id').eq('owner_id', userId),
        ]);

        const projectIds = new Set<string>();
        (memberProjectsRes.data as { project_id: string }[] | null)?.forEach((r) => projectIds.add(r.project_id));
        (myTasksRes.data as { project_id: string | null }[] | null)?.forEach((r) => r.project_id && projectIds.add(r.project_id));

        const campaignIds = new Set<string>();
        (myCampaignTasksRes.data as { campaign_id: string }[] | null)?.forEach((r) => campaignIds.add(r.campaign_id));
        (ownedCampaignsRes.data as { id: string }[] | null)?.forEach((r) => campaignIds.add(r.id));

        const orParts = [`actor_id.eq.${userId}`];
        if (projectIds.size > 0) orParts.push(`project_id.in.(${[...projectIds].join(',')})`);
        if (campaignIds.size > 0) orParts.push(`campaign_id.in.(${[...campaignIds].join(',')})`);
        q = q.or(orParts.join(','));
      }

      const { data, error } = await q;
      if (error) console.error('Auditoria — falha ao carregar activity_log:', error.message);
      const logs = (data as (ActivityLogEntry & { actor: { name: string } | null })[] | null) ?? [];

      // Resolve nomes de projeto/campanha no cliente (sem depender de FK/embed)
      const pIds = [...new Set(logs.map((l) => l.project_id).filter((x): x is string => !!x))];
      const cIds = [...new Set(logs.map((l) => l.campaign_id).filter((x): x is string => !!x))];
      const [projRes, campRes] = await Promise.all([
        pIds.length ? supabase.from('projects').select('id, name').in('id', pIds) : Promise.resolve({ data: [] }),
        cIds.length ? supabase.from('campaigns').select('id, name').in('id', cIds) : Promise.resolve({ data: [] }),
      ]);
      const pMap = new Map(((projRes.data as { id: string; name: string }[] | null) ?? []).map((p) => [p.id, p.name]));
      const cMap = new Map(((campRes.data as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));

      setRows(
        logs.map((l) => ({
          ...l,
          project: l.project_id ? { name: pMap.get(l.project_id) ?? null } : null,
          campaign: l.campaign_id ? { name: cMap.get(l.campaign_id) ?? null } : null,
        })) as Row[],
      );
      setLoading(false);
    }

    load();
  }, [profile, isPrivileged]);

  const actors = Array.from(new Set(rows.map((r) => r.actor?.name).filter((n): n is string => Boolean(n)))).sort();
  const contexts = Array.from(
    new Set(rows.map((r) => r.project?.name ?? r.campaign?.name).filter((n): n is string => Boolean(n)))
  ).sort();

  const filteredRows = rows.filter((r) => {
    if (actorFilter !== 'all' && r.actor?.name !== actorFilter) return false;
    const context = r.project?.name ?? r.campaign?.name;
    if (contextFilter !== 'all' && context !== contextFilter) return false;
    if (periodDays !== 'all') {
      const days = Number(periodDays);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(r.created_at) < cutoff) return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!r.action_text.toLowerCase().includes(q) && !r.detail.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="page">
      <h1 className="page-title">Auditoria</h1>
      <div className="page-sub">
        {isPrivileged
          ? 'Quem, quando e o que foi alterado — visão completa de todo o time.'
          : 'Tudo o que você fez, e tudo o que aconteceu em projetos e campanhas nos quais você participa.'}
      </div>

      {!loading && (
        <div className="filters-row">
          <input className="chip-input" placeholder="⌕ Pesquisar ação ou detalhe…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="chip-select" value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}>
            <option value="all">Pessoa: todas</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select className="chip-select" value={contextFilter} onChange={(e) => setContextFilter(e.target.value)}>
            <option value="all">Projeto/Campanha: todos</option>
            {contexts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className="chip-select" value={periodDays} onChange={(e) => setPeriodDays(e.target.value)}>
            <option value="all">Período: tudo</option>
            <option value="1">Último dia</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : (
        <>
        <div className="section-head">
          <h2>{filteredRows.length} atividades</h2>
        </div>
        <table className="simple">
          <thead>
            <tr>
              <th>Ação</th>
              <th>Usuário</th>
              <th>Projeto/Campanha</th>
              <th>Quando</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id}>
                <td data-label="Ação">{r.action_text}</td>
                <td data-label="Usuário">{r.actor?.name ?? 'Sistema'}</td>
                <td data-label="Projeto/Campanha">{r.project?.name ?? r.campaign?.name ?? '—'}</td>
                <td className="mono" data-label="Quando">
                  {new Date(r.created_at).toLocaleString('pt-BR')}
                </td>
                <td data-label="Detalhe">{r.detail || '—'}</td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-faint)' }}>
                  Nenhuma atividade encontrada pra esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </>
      )}
    </div>
  );
}
