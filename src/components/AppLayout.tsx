import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { breadcrumbFor } from '../lib/breadcrumb';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileLayout from './mobile/MobileLayout';
import OfflineBanner from './OfflineBanner';

export default function AppLayout() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  if (loading) return <div className="centered-loading">Carregando…</div>;
  if (!session) return <Navigate to="/login" replace />;

  if (isMobile) return <MobileLayout />;

  return (
    <div className="app">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className={`sidebar-backdrop${navOpen ? ' open' : ''}`} onClick={() => setNavOpen(false)} />
      <div className="main">
        <Topbar breadcrumb={breadcrumbFor(location.pathname)} onMenuClick={() => setNavOpen(true)} />
        <OfflineBanner />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
