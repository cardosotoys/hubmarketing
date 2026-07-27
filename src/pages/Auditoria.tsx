import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ActivityLogEntry } from '../types/database';

type Row = ActivityLogEntry & { actor: { name: string } | null; project: { name: string } | null };

export default function Auditoria() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('activity_log')
      .select('*, actor:profiles(name), project:projects(name)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="page">
      <h1 className="page-title">Auditoria</h1>
      <div className="page-sub">Quem, quando e o que foi alterado — visível apenas para Diretoria.</div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : (
        <table className="simple">
          <thead>
            <tr>
              <th>Ação</th>
              <th>Usuário</th>
              <th>Projeto</th>
              <th>Quando</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.action_text}</td>
                <td>{r.actor?.name ?? 'Sistema'}</td>
                <td>{r.project?.name ?? '—'}</td>
                <td className="mono">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                <td>{r.detail || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--text-faint)' }}>
                  Nenhuma atividade registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
