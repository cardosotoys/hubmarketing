import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getVisibleNavItems, type NavItem } from '../../lib/navVisibility';

// As 4 posições fixas da barra inferior — as demais entram na folha "Mais". Valor trivial de
// ajustar depois; a visibilidade real (quem vê o quê) continua vindo de getVisibleNavItems.
const PRIMARY_PATHS = ['/', '/demandas', '/calendario', '/monitor-precos'];

export default function MobileTabBar() {
  const { profile } = useAuth();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const role = profile?.role ?? 'equipe';
  const department = profile?.department ?? 'growth';
  const seesConfig = role === 'diretoria' || role === 'administrador';
  const hiddenModules = profile?.hidden_modules ?? [];
  const extraModules = profile?.extra_modules ?? [];

  const visible = getVisibleNavItems({ role, department, hiddenModules, extraModules });
  const primary = PRIMARY_PATHS.map((p) => visible.find((i) => i.to === p)).filter((i): i is NavItem => Boolean(i));
  const rest = visible.filter((i) => !PRIMARY_PATHS.includes(i.to));
  const moreActive = rest.some((i) => i.to !== '/' && location.pathname.startsWith(i.to));

  function renderSheetItem(item: NavItem) {
    if (item.requiresConfig && !seesConfig) {
      return (
        <div className="mobile-sheet-item locked" key={item.to}>
          <span className="ic">{item.icon}</span>
          <span>{item.label}</span>
          <span className="ic lock">🔒</span>
        </div>
      );
    }
    return (
      <NavLink key={item.to} to={item.to} end={item.end} className="mobile-sheet-item" onClick={() => setMoreOpen(false)}>
        <span className="ic">{item.icon}</span>
        <span>{item.label}</span>
      </NavLink>
    );
  }

  return (
    <>
      <nav className="mobile-tabbar">
        {primary.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `mobile-tab${isActive ? ' active' : ''}`}>
            <span className="ic">{item.icon}</span>
            <span className="label">{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className={`mobile-tab${moreOpen || moreActive ? ' active' : ''}`} onClick={() => setMoreOpen(true)}>
          <span className="ic">⋯</span>
          <span className="label">Mais</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="mobile-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="mobile-more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-grid">{rest.map(renderSheetItem)}</div>
          </div>
        </div>
      )}
    </>
  );
}
