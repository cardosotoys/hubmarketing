import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Avatar from './Avatar';
import { ROLE_LABELS, type Department, type ModuleKey, type Role } from '../types/database';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  moduleKey: ModuleKey;
  hideFor?: Department[];
  defaultRoles?: Role[];
  requiresConfig?: boolean;
}

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Visão geral',
    items: [
      { to: '/', label: 'Dashboard', icon: '▣', end: true, moduleKey: 'dashboard' },
      { to: '/relatorios', label: 'Relatórios', icon: '▥', hideFor: ['design', 'assistente'], moduleKey: 'relatorios' },
    ],
  },
  {
    label: 'Trabalho',
    items: [
      { to: '/projetos', label: 'Projetos', icon: '◧', moduleKey: 'projetos' },
      { to: '/demandas', label: 'Demandas', icon: '☰', moduleKey: 'demandas' },
      { to: '/calendario', label: 'Calendário', icon: '▦', moduleKey: 'calendario' },
    ],
  },
  {
    label: 'Marca & conteúdo',
    items: [
      {
        to: '/redes-sociais',
        label: 'Redes Sociais',
        icon: '◎',
        defaultRoles: ['diretoria', 'administrador'],
        moduleKey: 'redes-sociais',
      },
      { to: '/biblioteca', label: 'Biblioteca', icon: '▤', moduleKey: 'biblioteca' },
      { to: '/produtos', label: 'Produtos', icon: '◫', moduleKey: 'produtos' },
      { to: '/monitor-precos', label: 'Monitor de Preços', icon: '⌁', hideFor: ['design', 'assistente'], moduleKey: 'monitor-precos' },
      { to: '/brand', label: 'Brand', icon: '◈', moduleKey: 'brand' },
    ],
  },
  {
    label: 'Campanhas',
    items: [
      { to: '/campanhas', label: 'Campanhas', icon: '◆', moduleKey: 'campanhas' },
      { to: '/ia', label: 'IA', icon: '✦', moduleKey: 'ia' },
    ],
  },
  {
    label: 'Registro',
    items: [
      { to: '/relatorio-diario', label: 'Relatório Diário', icon: '✎', moduleKey: 'relatorio-diario' },
      { to: '/auditoria', label: 'Auditoria', icon: '◷', moduleKey: 'auditoria' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/configuracoes', label: 'Configurações', icon: '⚙', requiresConfig: true, moduleKey: 'configuracoes' },
      { to: '/perfil', label: 'Perfil', icon: '◉', moduleKey: 'perfil' },
    ],
  },
];

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
    if (hiddenModules.includes(item.moduleKey)) return false;
    if (extraModules.includes(item.moduleKey)) return true;
    if (item.defaultRoles && !item.defaultRoles.includes(role)) return false;
    if (item.hideFor?.includes(department)) return false;
    return true;
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
