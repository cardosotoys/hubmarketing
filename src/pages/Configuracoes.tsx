import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activityLog';
import Avatar from '../components/Avatar';
import {
  CAMPAIGN_STATUSES,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  MODULE_KEYS,
  MODULE_LABELS,
  ROLE_LABELS,
  type AccessPreset,
  type Category,
  type CategoryScope,
  type Department,
  type ModuleKey,
  type Profile,
  type Role,
} from '../types/database';

const STABS = ['usuarios', 'perfis', 'presets', 'categorias', 'tags', 'status', 'templates'] as const;
const STAB_LABELS: Record<(typeof STABS)[number], string> = {
  usuarios: 'Usuários',
  perfis: 'Perfis & Permissões',
  presets: 'Presets de acesso',
  categorias: 'Categorias',
  tags: 'Tags',
  status: 'Status',
  templates: 'Templates',
};

// módulos essenciais que um preset nunca esconde (evita lockout ao aplicar)
const ALWAYS_ON_MODULES: ModuleKey[] = ['perfil', 'configuracoes'];

export default function Configuracoes() {
  const { profile } = useAuth();
  const [stab, setStab] = useState<(typeof STABS)[number]>('usuarios');
  const [users, setUsers] = useState<Profile[]>([]);
  const [presets, setPresets] = useState<AccessPreset[]>([]);
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
    supabase
      .from('access_presets')
      .select('*')
      .order('name')
      .then(({ data }) => setPresets((data as AccessPreset[]) ?? []));
  }, []);

  async function reloadPresets() {
    const { data } = await supabase.from('access_presets').select('*').order('name');
    setPresets((data as AccessPreset[]) ?? []);
  }

  // Aplica um preset numa pessoa: os módulos do preset ficam "liberados" e todos os demais
  // (fora os essenciais) ficam "ocultos" — o preset passa a definir exatamente o que ela vê.
  async function applyPreset(userId: string, presetId: string) {
    const user = users.find((u) => u.id === userId);
    const preset = presets.find((p) => p.id === presetId);
    if (!user || !preset) return;
    const mods = preset.modules as ModuleKey[];
    const extra_modules = mods.filter((m) => !ALWAYS_ON_MODULES.includes(m));
    const hidden_modules = (MODULE_KEYS as readonly ModuleKey[]).filter(
      (m) => !mods.includes(m) && !ALWAYS_ON_MODULES.includes(m),
    );
    const { error } = await supabase.from('profiles').update({ extra_modules, hidden_modules }).eq('id', userId);
    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, extra_modules, hidden_modules } : u)));
      if (profile) {
        await logActivity({ actorId: profile.id, actionText: 'Preset de acesso aplicado', detail: `${user.name} ← ${preset.name}` });
      }
    }
  }

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

  async function changeDisabled(userId: string, disabled: boolean) {
    const user = users.find((u) => u.id === userId);
    const { error } = await supabase.from('profiles').update({ disabled }).eq('id', userId);
    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, disabled } : u)));
      if (profile) {
        await logActivity({
          actorId: profile.id,
          actionText: disabled ? 'Acesso de usuário desativado' : 'Acesso de usuário reativado',
          detail: user?.name ?? userId,
        });
      }
    }
  }

  async function changeCanEditProducts(userId: string, can_edit_products: boolean) {
    const user = users.find((u) => u.id === userId);
    const { error } = await supabase.from('profiles').update({ can_edit_products }).eq('id', userId);
    if (!error) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, can_edit_products } : u)));
      if (profile) {
        await logActivity({
          actorId: profile.id,
          actionText: can_edit_products ? 'Liberado para editar produtos' : 'Removido acesso de editar produtos',
          detail: user?.name ?? userId,
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
              <div className="user-cards">
                {users.map((u) => {
                  const restricted = !isDiretoria && u.role === 'diretoria';
                  const isSelf = u.id === profile?.id;
                  return (
                    <div className={`user-card${u.disabled ? ' is-disabled' : ''}`} key={u.id}>
                      <div className="user-card-main">
                        <Avatar profile={u} />
                        <div className="user-card-id">
                          <div className="user-card-name">
                            {u.name}
                            {isSelf && <span className="utag utag-self">você</span>}
                            {u.disabled && <span className="utag utag-off">desativado</span>}
                          </div>
                          <div className="user-card-role">
                            <span className={`role-dot role-${u.role}`} />
                            {ROLE_LABELS[u.role]}
                            {u.job_title ? <span className="user-card-job"> · {u.job_title}</span> : null}
                          </div>
                        </div>
                        <div className="user-card-action">
                          {isSelf ? null : restricted ? (
                            <span className="umuted">🔒 restrito</span>
                          ) : u.disabled ? (
                            <button className="btn ghost sm" style={{ color: 'var(--green)' }} onClick={() => changeDisabled(u.id, false)}>
                              Reativar
                            </button>
                          ) : (
                            <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => changeDisabled(u.id, true)}>
                              Desativar
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="user-card-fields">
                        <label className="ucf">
                          <span className="ucf-label">Papel</span>
                          {restricted ? (
                            <span className="pill">{ROLE_LABELS[u.role]}</span>
                          ) : (
                            <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value as Role)}>
                              <option value="equipe">Equipe</option>
                              <option value="administrador">Administrador</option>
                              <option value="diretoria">Diretoria</option>
                            </select>
                          )}
                        </label>

                        <label className="ucf">
                          <span className="ucf-label">Departamento</span>
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
                        </label>

                        <div className="ucf">
                          <span className="ucf-label">Editar produtos</span>
                          {u.department === 'assistente' ? (
                            <button
                              type="button"
                              className={`toggle-pill${u.can_edit_products ? ' on' : ''}`}
                              disabled={restricted}
                              onClick={() => changeCanEditProducts(u.id, !u.can_edit_products)}
                            >
                              {u.can_edit_products ? '✓ Liberado' : 'Bloqueado'}
                            </button>
                          ) : (
                            <span className="umuted">Padrão · já edita</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : stab === 'perfis' ? (
            loading ? (
              <div className="page-sub">Carregando…</div>
            ) : (
              <PermissoesView
                users={users}
                presets={presets}
                isDiretoria={isDiretoria}
                onSetOverride={setModuleOverride}
                onApplyPreset={applyPreset}
              />
            )
          ) : stab === 'presets' ? (
            <PresetsView presets={presets} onChanged={reloadPresets} actorId={profile?.id ?? ''} />
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
  presets,
  isDiretoria,
  onSetOverride,
  onApplyPreset,
}: {
  users: Profile[];
  presets: AccessPreset[];
  isDiretoria: boolean;
  onSetOverride: (userId: string, moduleKey: ModuleKey, mode: 'padrao' | 'oculto' | 'liberado') => void;
  onApplyPreset: (userId: string, presetId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? '');
  const [presetId, setPresetId] = useState('');
  const selected = users.find((u) => u.id === selectedId);
  const restricted = selected ? !isDiretoria && selected.role === 'diretoria' : false;

  return (
    <div>
      <div className="page-sub" style={{ marginBottom: 14 }}>
        Cada papel (Diretoria/Equipe/Administrador) e departamento já libera um conjunto padrão de módulos. Aqui você
        pode moldar isso por pessoa: ocultar um módulo que o perfil dela normalmente veria, ou liberar um módulo extra
        (ex.: convidar alguém da Equipe pro módulo Redes Sociais como social media). Pra vários módulos de uma vez, use
        um <b>preset</b>.
      </div>
      <div className="responsive-row" style={{ maxWidth: 720 }}>
        <div className="form-field" style={{ flex: 1 }}>
          <label htmlFor="perm-user">Pessoa</label>
          <select id="perm-user" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {ROLE_LABELS[u.role]}
              </option>
            ))}
          </select>
        </div>
        {selected && !restricted && (
          <div className="form-field" style={{ flex: 1 }}>
            <label htmlFor="perm-preset">Aplicar preset de acesso</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select id="perm-preset" value={presetId} onChange={(e) => setPresetId(e.target.value)} style={{ flex: 1 }}>
                <option value="">— escolher preset —</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.modules.length})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn sm"
                disabled={!presetId}
                onClick={() => {
                  const p = presets.find((x) => x.id === presetId);
                  if (p && confirm(`Aplicar o preset "${p.name}" em ${selected.name}? Isso redefine os módulos visíveis dessa pessoa.`)) {
                    onApplyPreset(selected.id, presetId);
                  }
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        )}
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

function PresetsView({ presets, onChanged, actorId }: { presets: AccessPreset[]; onChanged: () => void; actorId: string }) {
  const [name, setName] = useState('');
  const [mods, setMods] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(k: string) {
    setMods((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Dê um nome ao preset.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('access_presets').insert({ name: name.trim(), modules: mods });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (actorId) await logActivity({ actorId, actionText: 'Preset de acesso criado', detail: name.trim() });
    setName('');
    setMods([]);
    onChanged();
  }

  async function remove(p: AccessPreset) {
    if (!confirm(`Excluir o preset "${p.name}"?`)) return;
    await supabase.from('access_presets').delete().eq('id', p.id);
    if (actorId) await logActivity({ actorId, actionText: 'Preset de acesso excluído', detail: p.name });
    onChanged();
  }

  return (
    <div>
      <div className="page-sub" style={{ marginBottom: 14 }}>
        Conjuntos de módulos por cargo/setor. Crie um preset e aplique-o nas pessoas em <b>Perfis &amp; Permissões</b> — evita
        ligar módulo por módulo quando um setor novo entra.
      </div>
      <form onSubmit={create} className="panel" style={{ marginBottom: 16 }}>
        <div className="form-field">
          <label htmlFor="preset-name">Nome do preset</label>
          <input id="preset-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Comercial — Equipe" />
        </div>
        <div className="form-field">
          <label>Módulos liberados</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MODULE_KEYS.map((k) => (
              <label key={k} className="filter-chip" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={mods.includes(k)} onChange={() => toggle(k)} style={{ width: 'auto', marginRight: 6 }} />
                {MODULE_LABELS[k]}
              </label>
            ))}
          </div>
        </div>
        {error && (
          <div className="banner error">
            <span className="ic">⚠</span>
            <span>{error}</span>
          </div>
        )}
        <button className="btn" disabled={busy}>
          {busy ? 'Salvando…' : 'Criar preset'}
        </button>
      </form>
      <table className="simple">
        <thead>
          <tr>
            <th>Preset</th>
            <th>Módulos</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {presets.map((p) => (
            <tr key={p.id}>
              <td data-label="Preset">{p.name}</td>
              <td data-label="Módulos" style={{ color: 'var(--text-faint)' }}>
                {p.modules.map((m) => MODULE_LABELS[m as ModuleKey] ?? m).join(', ') || '—'}
              </td>
              <td>
                <button className="btn ghost sm" style={{ color: 'var(--red)' }} onClick={() => remove(p)}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {presets.length === 0 && (
            <tr>
              <td colSpan={3} style={{ color: 'var(--text-faint)' }}>
                Nenhum preset ainda. Crie o primeiro acima.
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
