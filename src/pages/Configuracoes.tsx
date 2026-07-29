import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  MODULE_KEYS,
  MODULE_LABELS,
  ROLE_LABELS,
  type Department,
  type ModuleKey,
  type Profile,
  type Role,
} from '../types/database';

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

  async function setModuleOverride(userId: string, moduleKey: ModuleKey, mode: 'padrao' | 'oculto' | 'liberado') {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const hidden_modules = user.hidden_modules.filter((m) => m !== moduleKey);
    const extra_modules = user.extra_modules.filter((m) => m !== moduleKey);
    if (mode === 'oculto') hidden_modules.push(moduleKey);
    if (mode === 'liberado') extra_modules.push(moduleKey);
    const { error } = await supabase.from('profiles').update({ hidden_modules, extra_modules }).eq('id', userId);
    if (!error) setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, hidden_modules, extra_modules } : u)));
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
          ) : stab === 'perfis' ? (
            loading ? (
              <div className="page-sub">Carregando…</div>
            ) : (
              <PermissoesView users={users} isDiretoria={isDiretoria} onSetOverride={setModuleOverride} />
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

function PermissoesView({
  users,
  isDiretoria,
  onSetOverride,
}: {
  users: Profile[];
  isDiretoria: boolean;
  onSetOverride: (userId: string, moduleKey: ModuleKey, mode: 'padrao' | 'oculto' | 'liberado') => void;
}) {
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? '');
  const selected = users.find((u) => u.id === selectedId);
  const restricted = selected ? !isDiretoria && selected.role === 'diretoria' : false;

  return (
    <div>
      <div className="page-sub" style={{ marginBottom: 14 }}>
        Cada papel (Diretoria/Equipe/Administrador) e departamento já libera um conjunto padrão de módulos. Aqui você
        pode moldar isso por pessoa: ocultar um módulo que o perfil dela normalmente veria, ou liberar um módulo extra
        (ex.: convidar alguém da Equipe pro módulo Redes Sociais como social media).
      </div>
      <div className="form-field" style={{ maxWidth: 360 }}>
        <label htmlFor="perm-user">Pessoa</label>
        <select id="perm-user" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {ROLE_LABELS[u.role]}
            </option>
          ))}
        </select>
      </div>

      {selected &&
        (restricted ? (
          <div className="locked-banner" style={{ marginTop: 14 }}>
            <span className="ic">🔒</span>Só Diretoria pode moldar o acesso de outra pessoa da Diretoria.
          </div>
        ) : (
          <table className="simple" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Módulo</th>
                <th>Padrão (papel/depto)</th>
                <th>Ocultar</th>
                <th>Liberar</th>
              </tr>
            </thead>
            <tbody>
              {MODULE_KEYS.map((key) => {
                const mode = selected.hidden_modules.includes(key) ? 'oculto' : selected.extra_modules.includes(key) ? 'liberado' : 'padrao';
                return (
                  <tr key={key}>
                    <td>{MODULE_LABELS[key]}</td>
                    <td>
                      <span
                        className={`filter-chip${mode === 'padrao' ? ' active' : ''}`}
                        onClick={() => onSetOverride(selected.id, key, 'padrao')}
                      >
                        Padrão
                      </span>
                    </td>
                    <td>
                      <span
                        className={`filter-chip${mode === 'oculto' ? ' active' : ''}`}
                        onClick={() => onSetOverride(selected.id, key, 'oculto')}
                      >
                        Ocultar
                      </span>
                    </td>
                    <td>
                      <span
                        className={`filter-chip${mode === 'liberado' ? ' active' : ''}`}
                        onClick={() => onSetOverride(selected.id, key, 'liberado')}
                      >
                        Liberar
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
    </div>
  );
}
