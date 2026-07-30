import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Avatar from './Avatar';
import { ROLE_LABELS } from '../types/database';
import { NAV_SECTIONS as SECTIONS, isNavItemVisible, type NavItem } from '../lib/navVisibility';

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, signOut } = useAuth();
  const role = profile?.role ?? 'equipe';
  const department = profile?.department ?? 'growth';
  const seesConfig = role === 'diretoria' || role === 'administrador';
  const hiddenModules = profile?.hidden_modules ?? [];
  const extraModules = profile?.extra_modules ?? [];
  const [openTasks, setOpenTasks] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1');
  const [flat, setFlat] = useState(() => localStorage.getItem('sidebar-flat') === '1');

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

  function isVisible(item: NavItem): boolean {
    return isNavItemVisible(item, { role, department, hiddenModules, extraModules });
  }

  useEffect(() => {
    async function loadOpenTasks() {
      const [{ data: terminalStages }, { data: allTasks }] = await Promise.all([
        supabase.from('stages').select('id').eq('is_final', true),
        supabase.from('tasks').select('stage_id'),
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
          <span className="ic">{item.icon}</span>
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
        <span className="ic">{item.icon}</span>
        <span className="nav-label-text">{item.label}</span>
        {item.to === '/demandas' && openTasks !== null && openTasks > 0 && <span className="badge">{openTasks}</span>}
      </NavLink>
    );
  }

  const visibleItems = SECTIONS.flatMap((s) => s.items).filter(isVisible);

  return (
    <div className={`sidebar${open ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-mark">C</div>
        <div>
          <div className="brand-name">Cardoso Hub</div>
          <div className="brand-sub mono">marketing · estrutura</div>
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

      {flat
        ? visibleItems.map(renderItem)
        : SECTIONS.map((section) => {
            const items = section.items.filter(isVisible);
            if (items.length === 0) return null;
            return (
              <div key={section.label}>
                <div className="nav-label">{section.label}</div>
                {items.map(renderItem)}
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
