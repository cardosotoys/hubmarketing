import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { ROLE_LABELS, type Department } from '../types/database';

const NAV: { to: string; label: string; icon: string; end?: boolean; hideFor?: Department[] }[] = [
  { to: '/', label: 'Dashboard', icon: '▣', end: true },
  { to: '/projetos', label: 'Projetos', icon: '◧' },
  { to: '/demandas', label: 'Demandas', icon: '☰' },
  { to: '/calendario', label: 'Calendário', icon: '▦' },
  { to: '/redes-sociais', label: 'Redes Sociais', icon: '◎', hideFor: ['design'] },
  { to: '/biblioteca', label: 'Biblioteca', icon: '▤' },
  { to: '/produtos', label: 'Produtos', icon: '◫' },
  { to: '/campanhas', label: 'Campanhas', icon: '◆' },
  { to: '/ia', label: 'IA', icon: '✦' },
  { to: '/relatorios', label: 'Relatórios', icon: '▥', hideFor: ['design', 'assistente'] },
  { to: '/relatorio-diario', label: 'Relatório Diário', icon: '✎' },
  { to: '/brand', label: 'Brand', icon: '◈' },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, signOut } = useAuth();
  const role = profile?.role ?? 'equipe';
  const department = profile?.department ?? 'growth';
  const seesConfig = role === 'diretoria' || role === 'administrador';
  const visibleNav = NAV.filter((item) => !item.hideFor?.includes(department));
  const [openTasks, setOpenTasks] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .neq('stage', 'finalizado')
      .then(({ count }) => setOpenTasks(count ?? 0));
  }, []);

  return (
    <div className={`sidebar${open ? ' open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">C</div>
        <div>
          <div className="brand-name">Cardoso Hub</div>
          <div className="brand-sub mono">marketing · estrutura</div>
        </div>
        <button className="hamburger-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
          ✕
        </button>
      </div>

      {visibleNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span className="ic">{item.icon}</span>
          <span>{item.label}</span>
          {item.to === '/demandas' && openTasks !== null && openTasks > 0 && (
            <span className="badge">{openTasks}</span>
          )}
        </NavLink>
      ))}

      {seesConfig ? (
        <NavLink to="/configuracoes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="ic">⚙</span>
          <span>Configurações</span>
        </NavLink>
      ) : (
        <div className="nav-locked">
          <span className="ic">⚙</span>
          <span>Configurações</span>
          <span className="ic" style={{ marginLeft: 'auto' }}>
            🔒
          </span>
        </div>
      )}

      <NavLink to="/auditoria" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="ic">◷</span>
        <span>Auditoria</span>
      </NavLink>

      <NavLink to="/perfil" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <span className="ic">◉</span>
        <span>Perfil</span>
      </NavLink>

      <div className="sidebar-footer">
        <div className="user-footer">
          <div className="avatar">{profile?.avatar_initials ?? '··'}</div>
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
