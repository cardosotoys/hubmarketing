import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import {
  CAMPAIGN_STATUSES,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  MODULE_KEYS,
  MODULE_LABELS,
  ROLE_LABELS,
  type Category,
  type CategoryScope,
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
    const user = users.find((u) => u.id === userId);
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      if (profile) {
        await logActivity({ actorId: profile.id, actionText: 'Papel de usuário alterado', detail: `${user?.name ?? userId} → ${ROLE_LABELS[role]}` });
      }
    }
  }

  async function changeDepartment(userId: string, department: Department) {
    const user = users.find((u) => u.id === userId);
    const { error } = await supabase.from('profiles').update({ department }).eq('id', userId);
    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, department } : u)));
      if (profile) {
        await logActivity({
          actorId: profile.id,
          actionText: 'Departamento de usuário alterado',
          detail: `${user?.name ?? userId} → ${DEPARTMENT_LABELS[department]}`,
        });
      }
    }
  }

  async function setModuleOverride(userId: string, moduleKey: ModuleKey, mode: 'padrao' | 'oculto' | 'liberado') {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const hidden_modules = user.hidden_modules.filter((m) => m !== moduleKey);
    const extra_modules = user.extra_modules.filter((m) => m !== moduleKey);
    if (mode === 'oculto') hidden_modules.push(moduleKey);
    if (mode === 'liberado') extra_modules.push(moduleKey);
    const { error } = await supabase.from('profiles').update({ hidden_modules, extra_modules }).eq('id', userId);
    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, hidden_modules, extra_modules } : u)));
      if (profile) {
        await logActivity({
          actorId: profile.id,
          actionText: 'Permissão de módulo alterada',
          detail: `${user.name} — ${MODULE_LABELS[moduleKey]}: ${mode}`,
        });
      }
    }
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
          ) : stab === 'categorias' ? (
            <CategoriasView />
          ) : stab === 'status' ? (
            <StatusView />
          ) : stab === 'templates' ? (
            <TemplatesView />
          ) : (
            <div className="locked-banner">
              <span className="ic">◐</span>Estrutura reservada — sem uso concreto identificado ainda (avise se
              precisar de algo aqui).
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

function CategoriasView() {
  const { profile } = useAuth();
  const [scope, setScope] = useState<CategoryScope>('projeto');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*').order('label');
    setCategories((data as Category[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = categories.filter((c) => c.scope === scope);

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const { error: err } = await supabase.from('categories').insert({ scope, label: newLabel.trim() });
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Categoria criada', detail: `${scope}: ${newLabel.trim()}` });
    setNewLabel('');
    load();
  }

  async function renameCategory(id: string, label: string) {
    if (!label.trim()) return;
    await supabase.from('categories').update({ label: label.trim() }).eq('id', id);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Categoria renomeada', detail: label.trim() });
    load();
  }

  async function deleteCategory(id: string) {
    const label = categories.find((c) => c.id === id)?.label;
    await supabase.from('categories').delete().eq('id', id);
    if (profile) await logActivity({ actorId: profile.id, actionText: 'Categoria excluída', detail: label });
    load();
  }

  return (
    <div>
      <div className="page-sub" style={{ marginBottom: 14 }}>
        Lista gerenciável usada nos seletores de categoria de Projetos e Campanhas — evita duplicata tipo
        "Embalagens" vs "embalagem" digitadas cada vez de um jeito.
      </div>
      <div className="brand-tabs">
        <div className={`brand-tab${scope === 'projeto' ? ' active' : ''}`} onClick={() => setScope('projeto')}>
          Projetos
        </div>
        <div className={`brand-tab${scope === 'campanha' ? ' active' : ''}`} onClick={() => setScope('campanha')}>
          Campanhas
        </div>
      </div>

      {loading ? (
        <div className="page-sub">Carregando…</div>
      ) : (
        <div className="panel" style={{ maxWidth: 420 }}>
          {filtered.map((c) => (
            <div className="field-row" key={c.id}>
              <input
                defaultValue={c.label}
                onBlur={(e) => e.target.value !== c.label && renameCategory(c.id, e.target.value)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => deleteCategory(c.id)}>
                ✕
              </button>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Nenhuma categoria ainda.</div>}
          <form onSubmit={addCategory} className="responsive-row" style={{ marginTop: 10 }}>
            <input placeholder="+ nova categoria…" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} style={{ flex: 1 }} />
            <button className="btn sm" type="submit">
              Adicionar
            </button>
          </form>
          {error && (
            <div className="banner error" style={{ marginTop: 8 }}>
              <span className="ic">✕</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusView() {
  return (
    <div>
      <div className="page-sub" style={{ marginBottom: 14 }}>
        Os status de Projetos e Campanhas são estados fixos (têm regra de negócio amarrada — ex.: etapa final
        exige responsável) e não são editáveis por aqui. Isso aqui é só a referência de quais existem hoje.
        Se precisar de status configuráveis de verdade, é uma mudança de estrutura maior — avise que a gente
        avalia, igual foi feito com as etapas de projeto.
      </div>
      <div className="panel">
        <h4>Projetos</h4>
        <div className="field-row">
          <span className="k">Planejamento</span>
          <span>Padrão ao criar</span>
        </div>
        <div className="field-row">
          <span className="k">Ativo</span>
          <span>Em execução</span>
        </div>
        <div className="field-row">
          <span className="k">Atenção</span>
          <span>Pausado / precisa de atenção</span>
        </div>
        <div className="field-row">
          <span className="k">Concluído</span>
          <span>Finalizado</span>
        </div>
      </div>
      <div className="panel">
        <h4>Campanhas</h4>
        {CAMPAIGN_STATUSES.map((s) => (
          <div className="field-row" key={s.key}>
            <span className="k">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplatesView() {
  return (
    <div>
      <div className="page-sub" style={{ marginBottom: 14 }}>
        Modelos de projeto já têm CRUD completo dentro do próprio módulo Projetos — criar, editar etapas e
        demandas padrão, excluir — pra não duplicar em dois lugares.
      </div>
      <Link className="btn" to="/projetos">
        Ir pra Projetos → Modelos
      </Link>
      <div className="page-sub" style={{ marginTop: 14 }}>
        Campanhas ainda não têm um sistema de modelo equivalente — se fizer sentido criar um (pra não montar o
        briefing/objetivos/riscos do zero toda vez), me avise que eu desenho separado.
      </div>
    </div>
  );
}
