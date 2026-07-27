import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/projetos': 'Projetos',
  '/demandas': 'Demandas',
  '/calendario': 'Calendário',
  '/redes-sociais': 'Redes Sociais',
  '/biblioteca': 'Biblioteca',
  '/produtos': 'Produtos',
  '/campanhas': 'Campanhas',
  '/ia': 'IA',
  '/relatorios': 'Relatórios',
  '/relatorio-diario': 'Relatório Diário',
  '/brand': 'Brand',
  '/configuracoes': 'Configurações',
  '/auditoria': 'Auditoria',
  '/perfil': 'Perfil',
};

function breadcrumbFor(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/projetos/')) return 'Projetos';
  if (pathname.startsWith('/campanhas/')) return 'Campanhas';
  return '';
}

export default function AppLayout() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="centered-loading">Carregando…</div>;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar breadcrumb={breadcrumbFor(location.pathname)} />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
