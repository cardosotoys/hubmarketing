import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useProductDevWorkspace } from '../../context/ProductDevWorkspaceContext';
import type { ActivityLogEntry } from '../../types/database';

export default function ProductDevHistorico() {
  const { item } = useProductDevWorkspace();
  const [entries, setEntries] = useState<(ActivityLogEntry & { actor: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('activity_log')
      .select('*, actor:profiles(name)')
      .eq('product_dev_item_id', item.id)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setEntries((data as (ActivityLogEntry & { actor: { name: string } | null })[]) ?? []);
        setLoading(false);
      });
  }, [item.id]);

  return (
    <div>
      <div className="section-head">
        <h2>Histórico</h2>
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : entries.length === 0 ? (
        <div className="locked-banner">
          <span className="ic">◷</span>Nenhuma atividade registrada ainda.
        </div>
      ) : (
        <div className="panel">
          {entries.map((e) => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>
                <strong>{e.actor?.name ?? '—'}</strong> {e.action_text}
                {e.detail ? <span style={{ color: 'var(--text-faint)' }}> · {e.detail}</span> : ''}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                {new Date(e.created_at).toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
