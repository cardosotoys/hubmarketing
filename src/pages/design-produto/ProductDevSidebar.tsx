import { NavLink } from 'react-router-dom';

const NAV: { to: string; label: string; icon: string }[] = [
  { to: 'resumo', label: 'Resumo', icon: '▣' },
  { to: 'fases', label: 'Fases & Portões', icon: '⛿' },
  { to: 'ficha', label: 'Ficha & Requisitos', icon: '✎' },
  { to: 'embalagem', label: 'Embalagem', icon: '▤' },
  { to: 'certificacao', label: 'Certificação', icon: '✓' },
  { to: 'marketing', label: 'Marketing / GTM', icon: '◆' },
  { to: 'riscos', label: 'Riscos', icon: '⚠' },
  { to: 'decisoes', label: 'Decisões', icon: '◈' },
  { to: 'historico', label: 'Histórico', icon: '◷' },
];

export default function ProductDevSidebar() {
  return (
    <div className="workspace-sidebar">
      {NAV.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="ic">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}
