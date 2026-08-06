import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Avatar from './Avatar';
import Icon from './Icon';
import { ROLE_LABELS } from '../types/database';
import { NAV_GROUPS, isNavItemVisible, type NavItem, type NavModule } from '../lib/navVisibility';

const COLLAPSED_MODULES_KEY = 'sidebar-collapsed-modules';

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const role = profile?.role ?? 'equipe';
  const department = profile?.department ?? 'growth';
  const seesConfig = role === 'diretoria' || role === 'administrador';
  const hiddenModules = profile?.hidden_modules ?? [];
  const extraModules = profile?.extra_modules ?? [];
  const [openTasks, setOpenTasks] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1');
  const [flat, setFlat] = useState(() => localStorage.getItem('sidebar-flat') === '1');
  // módulos recolhidos (por chave) — persistido; por padrão tudo aberto
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_MODULES_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  function toggleCollapsed() {
    setCollapsed((v) => {
      localStorage.setItem('sidebar-collapsed', v ? '0' : '1');
      return !v;
    });
  }

  function toggleFlat() {
    setFlat((v) => {
      localStorage.setItem('sidebar-flat', v ? '0' : '1');
      return !v;
    });
  }

  function toggleModule(key: string) {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(COLLAPSED_MODULES_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function isVisible(item: NavItem): boolean {
    return isNavItemVisible(item, { role, department, hiddenModules, extraModules });
  }

  useEffect(() => {
    async function loadOpenTasks() {
      const [{ data: terminalStages }, { data: allTasks }] = await Promise.all([
        supabase.from('stages').select('id').eq('is_final', true),
        supabase.from('tasks').select('stage_id').is('packaging_track', null),
      ]);
      const terminalIds = new Set((terminalStages ?? []).map((s) => s.id));
      setOpenTasks((allTasks ?? []).filter((t) => !terminalIds.has(t.stage_id)).length);
    }
    loadOpenTasks();
  }, []);

  function renderItem(item: NavItem) {
    if (item.requiresConfig && !seesConfig) {
      return (
        <div className="nav-locked" key={item.to} title={collapsed ? item.label : undefined}>
          <span className="ic">
            <Icon name={item.icon} />
          </span>
          <span className="nav-label-text">{item.label}</span>
          <span className="ic" style={{ marginLeft: 'auto' }}>
            🔒
          </span>
        </div>
      );
    }
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      >
        <span className="ic">
          <Icon name={item.icon} />
        </span>
        <span className="nav-label-text">{item.label}</span>
        {item.to === '/demandas' && openTasks !== null && openTasks > 0 && <span className="badge">{openTasks}</span>}
      </NavLink>
    );
  }

  // módulo aberto se não estiver recolhido OU se a rota ativa estiver dentro dele
  function isModuleOpen(m: NavModule, items: NavItem[]): boolean {
    if (!collapsedModules.has(m.key)) return true;
    return items.some((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)));
  }

  const allVisibleItems = NAV_GROUPS.flatMap((g) => g.modules).flatMap((m) => m.items).filter(isVisible);

  return (
    <div className={`sidebar${open ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-mark">C</div>
        <div>
          <div className="brand-name">Cardoso Hub</div>
          <div className="brand-sub mono">plataforma · estrutura</div>
        </div>
        <button className="hamburger-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
          ✕
        </button>
        <button
          className="collapse-btn"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          style={{ marginLeft: collapsed ? 0 : 'auto' }}
          onClick={toggleCollapsed}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {!collapsed && (
        <div className="sidebar-view-toggle filter-chip" onClick={toggleFlat}>
          {flat ? '☰ Ver agrupado' : '▤ Ver tudo numa lista'}
        </div>
      )}

      {collapsed || flat
        ? allVisibleItems.map(renderItem)
        : NAV_GROUPS.map((group) => {
            const modules = group.modules
              .map((m) => ({ mod: m, items: m.items.filter(isVisible) }))
              .filter((x) => x.items.length > 0);
            if (modules.length === 0) return null;
            return (
              <div key={group.title} className="nav-group">
                <div className="nav-group-title">{group.title}</div>
                {modules.map(({ mod, items }) => {
                  const openMod = isModuleOpen(mod, items);
                  return (
                    <div key={mod.key} className="nav-module">
                      <button type="button" className="nav-module-head" onClick={() => toggleModule(mod.key)}>
                        <span className="ic">
                          <Icon name={mod.icon} />
                        </span>
                        <span className="nav-label-text">{mod.label}</span>
                        <span className="nav-chevron">{openMod ? '▾' : '▸'}</span>
                      </button>
                      {openMod && <div className="nav-module-items">{items.map(renderItem)}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}

      <div className="sidebar-footer">
        <div className="user-footer">
          <Avatar profile={profile} />
          <div className="meta">
            <div className="name">{profile?.name ?? '…'}</div>
            <div className="role">
              {ROLE_LABELS[role]}
              {profile?.job_title ? ` · ${profile.job_title}` : ''}
            </div>
          </div>
          <button className="logout-btn" onClick={signOut}>
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
