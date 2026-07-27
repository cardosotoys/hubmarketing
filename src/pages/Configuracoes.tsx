import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { DEPARTMENTS, DEPARTMENT_LABELS, ROLE_LABELS, type Department, type Profile, type Role } from '../types/database';

const STABS = ['usuarios', 'perfis', 'categorias', 'tags', 'status', 'templates'] as const;
const STAB_LABELS: Record<(typeof STABS)[number], string> = {
  usuarios: 'Usuários',
  perfis: 'Perfis & Permissões',
  categorias: 'Categorias',
  tags: 'Tags',
  status: 'Status',
  templates: 'Templates',
};

export default function Configuracoes() {
  const { profile } = useAuth();
  const [stab, setStab] = useState<(typeof STABS)[number]>('usuarios');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const isDiretoria = profile?.role === 'diretoria';

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('name')
      .then(({ data }) => {
        setUsers((data as Profile[]) ?? []);
        setLoading(false);
      });
  }, []);

  async function changeRole(userId: string, role: Role) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (!error) setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
  }

  async function changeDepartment(userId: string, department: Department) {
    const { error } = await supabase.from('profiles').update({ department }).eq('id', userId);
    if (!error) setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, department } : u)));
  }

  return (
    <div className="page">
      <h1 className="page-title">Configurações</h1>
      <div className="page-sub">Usuários, perfis, categorias, tags, status, templates e permissões.</div>
      <div className="settings-wrap">
        <div className="settings-tabs">
          {STABS.map((s) => (
            <button key={s} className={`stab${stab === s ? ' active' : ''}`} onClick={() => setStab(s)}>
              {STAB_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="settings-body">
          {stab === 'usuarios' ? (
            loading ? (
              <div className="page-sub">Carregando…</div>
            ) : (
              <table className="simple">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Papel</th>
                    <th>Departamento</th>
                    <th>Cargo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const restricted = !isDiretoria && u.role === 'diretoria';
                    return (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>
                          <span className="pill">{ROLE_LABELS[u.role]}</span>
                        </td>
                        <td>
                          {restricted ? (
                            <span className="pill">{DEPARTMENT_LABELS[u.department]}</span>
                          ) : (
                            <select value={u.department} onChange={(e) => changeDepartment(u.id, e.target.value as Department)}>
                              {DEPARTMENTS.map((d) => (
                                <option key={d} value={d}>
                                  {DEPARTMENT_LABELS[d]}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>{u.job_title || '—'}</td>
                        <td>
                          {restricted ? (
                            <span style={{ color: 'var(--text-faint)' }}>🔒 restrito</span>
                          ) : (
                            <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value as Role)}>
                              <option value="equipe">Equipe</option>
                              <option value="administrador">Administrador</option>
                              <option value="diretoria">Diretoria</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            <div className="locked-banner">
              <span className="ic">◐</span>Estrutura reservada — detalha junto com o módulo correspondente (Fase 2).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
