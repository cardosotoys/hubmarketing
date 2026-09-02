import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Avatar from './Avatar';
import Icon from './Icon';
import { ROLE_LABELS } from '../types/database';
import { NAV_GROUPS, isNavItemVisible, type NavItem } from '../lib/navVisibility';

// Menu flutuante em dois pedaços: rail escuro (um ícone por MÓDULO) + painel claro com os
// itens do módulo ativo. Só apresentação — a lógica de visibilidade/rotas continua igual.
export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const role = profile?.role ?? 'equipe';
  const department = profile?.department ?? 'growth';
  const seesConfig = role === 'diretoria' || role === 'administrador';
  const hiddenModules = profile?.hidden_modules ?? [];
  const extraModules = profile?.extra_modules ?? [];
  const [openTasks, setOpenTasks] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const isVisible = (item: NavItem) => isNavItemVisible(item, { role, department, hiddenModules, extraModules });

  useEffect(() => {
    (async () => {
      const [{ data: terminalStages }, { data: allTasks }] = await Promise.all([
        supabase.from('stages').select('id').eq('is_final', true),
        supabase.from('tasks').select('stage_id').is('packaging_track', null),
      ]);
      const terminalIds = new Set((terminalStages ?? []).map((s) => s.id));
      setOpenTasks((allTasks ?? []).filter((t) => !terminalIds.has(t.stage_id)).length);
    })();
  }, []);

  // módulos visíveis (achatados dos grupos), com seus itens visíveis
  const modules = useMemo(
    () =>
      NAV_GROUPS.flatMap((g) => g.modules.map((mod) => ({ group: g.title, mod, items: mod.items.filter(isVisible) }))).filter(
        (x) => x.items.length > 0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, department, hiddenModules.join(), extraModules.join(), openTasks],
  );

  const matchItem = (i: NavItem) =>
    i.to === '/' ? location.pathname === '/' : i.end ? location.pathname === i.to : location.pathname.startsWith(i.to);

  const activeKey = modules.find((x) => x.items.some(matchItem))?.mod.key ?? modules[0]?.mod.key;
  const currentKey = selected ?? activeKey;
  const current = modules.find((x) => x.mod.key === currentKey) ?? modules[0];

  // ao trocar de rota, o painel volta a acompanhar o módulo da rota
  useEffect(() => {
    setSelected(null);
  }, [location.pathname]);

  function renderItem(item: NavItem) {
    if (item.requiresConfig && !seesConfig) {
      return (
        <div className="npi npi-locked" key={item.to}>
          <span className="ic"><Icon name={item.icon} /></span>
          <span>{item.label}</span>
          <span className="ic" style={{ marginLeft: 'auto', opacity: 0.6 }}>🔒</span>
        </div>
      );
    }
    return (
      <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose} className={({ isActive }) => `npi${isActive ? ' active' : ''}`}>
        <span className="ic"><Icon name={item.icon} /></span>
        <span>{item.label}</span>
        {item.to === '/demandas' && openTasks !== null && openTasks > 0 && <span className="npi-badge">{openTasks}</span>}
      </NavLink>
    );
  }

  return (
    <div className={`shellnav${open ? ' open' : ''}`}>
      {/* RAIL escuro — um ícone por módulo */}
      <div className="rail">
        <div className="rail-logo" title="Cardoso Hub">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none"><path d="M23 9.5a10 10 0 1 0 0 13" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" /></svg>
        </div>
        <div className="rail-icons">
          {modules.map(({ mod }) => (
            <button
              key={mod.key}
              type="button"
              className={`rail-ic${mod.key === currentKey ? ' on' : ''}`}
              title={mod.label}
              onClick={() => setSelected(mod.key)}
            >
              <Icon name={mod.icon} />
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <div className="rail-avatar" title={profile?.name ?? ''}>
            <Avatar profile={profile} />
          </div>
        </div>
      </div>

      {/* PAINEL claro — itens do módulo ativo */}
      <div className="navpanel">
        <button className="navpanel-x" onClick={onClose} aria-label="Fechar">✕</button>
        <div className="navpanel-head">
          <div className="navpanel-kicker">Módulo</div>
          <h3>{current?.mod.label ?? 'Menu'}</h3>
        </div>
        <nav className="navpanel-items">{current?.items.map(renderItem)}</nav>

        {openTasks !== null && openTasks > 0 && (
          <NavLink to="/demandas" onClick={onClose} className="navpanel-card">
            <div className="npc-ic"><Icon name="demandas" /></div>
            <div>
              <div className="npc-num">{openTasks}</div>
              <div className="npc-lbl">demandas em aberto</div>
            </div>
          </NavLink>
        )}

        <div className="navpanel-foot">
          <Avatar profile={profile} />
          <div className="meta">
            <div className="name">{profile?.name ?? '…'}</div>
            <div className="role">{ROLE_LABELS[role]}{profile?.job_title ? ` · ${profile.job_title}` : ''}</div>
          </div>
          <button className="logout-btn" onClick={signOut}>Sair</button>
        </div>
      </div>
    </div>
  );
}
