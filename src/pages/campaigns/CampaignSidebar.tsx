import { NavLink } from 'react-router-dom';

interface WorkspaceNavItem {
  to: string;
  label: string;
  icon: string;
  built: boolean;
}

const NAV: WorkspaceNavItem[] = [
  { to: 'resumo', label: 'Resumo', icon: '▣', built: true },
  { to: 'planejamento', label: 'Planejamento', icon: '✎', built: true },
  { to: 'objetivos', label: 'Objetivos', icon: '◎', built: true },
  { to: 'produtos', label: 'Produtos', icon: '◫', built: true },
  { to: 'roadmap', label: 'Roadmap', icon: '↝', built: true },
  { to: 'cronograma', label: 'Cronograma', icon: '▤', built: true },
  { to: 'demandas', label: 'Demandas', icon: '☰', built: true },
  { to: 'criativos', label: 'Criativos', icon: '◈', built: true },
  { to: 'conteudos', label: 'Conteúdos', icon: '▥', built: true },
  { to: 'calendario-editorial', label: 'Calendário Editorial', icon: '▦', built: true },
  { to: 'social', label: 'Social Media', icon: '◉', built: true },
  { to: 'influenciadores', label: 'Influenciadores', icon: '✦', built: true },
  { to: 'trade', label: 'Trade Marketing', icon: '⬠', built: true },
  { to: 'marketplace', label: 'Marketplace', icon: '⛁', built: true },
  { to: 'crm', label: 'CRM', icon: '◐', built: true },
  { to: 'midia-paga', label: 'Mídia Paga', icon: '◆', built: true },
  { to: 'financeiro', label: 'Financeiro', icon: '$', built: true },
  { to: 'kpis', label: 'KPIs', icon: '◑', built: true },
  { to: 'relatorios', label: 'Relatórios', icon: '▥', built: false },
  { to: 'biblioteca', label: 'Biblioteca', icon: '▥', built: false },
  { to: 'aprovacoes', label: 'Aprovações', icon: '✓', built: true },
  { to: 'riscos', label: 'Riscos', icon: '⚠', built: true },
  { to: 'decisoes', label: 'Decisões', icon: '◈', built: true },
  { to: 'historico', label: 'Histórico', icon: '◷', built: true },
  { to: 'auditoria', label: 'Auditoria', icon: '◷', built: false },
  { to: 'configuracoes', label: 'Configurações', icon: '⚙', built: true },
];

export default function CampaignSidebar() {
  return (
    <div className="workspace-sidebar">
      {NAV.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="ic">{item.icon}</span>
          <span>{item.label}</span>
          {!item.built && (
            <span className="ic" style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 11 }}>
              🔒
            </span>
          )}
        </NavLink>
      ))}
    </div>
  );
}
