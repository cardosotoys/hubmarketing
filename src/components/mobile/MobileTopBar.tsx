import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { breadcrumbFor } from '../../lib/breadcrumb';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationsPanel from '../NotificationsPanel';

export default function MobileTopBar() {
  const { profile, setTheme } = useAuth();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { mentions, recent, unreadCount, loadRecent, markSeen } = useNotifications(profile?.id);
  const { query, setQuery, searching, results, hasResults, goTo } = useGlobalSearch();

  function handleGoTo(path: string) {
    goTo(path);
    setSearchOpen(false);
  }

  function toggleNotif() {
    setNotifOpen((s) => {
      if (!s) {
        loadRecent();
        markSeen();
      }
      return !s;
    });
  }

  return (
    <>
      <div className="mobile-topbar">
        <div className="mobile-topbar-title">{breadcrumbFor(location.pathname) || 'Cardoso Hub'}</div>
        <div className="mobile-topbar-actions">
          <button
            type="button"
            className="icon-btn"
            title={profile?.theme === 'light' ? 'Mudar pro modo escuro' : 'Mudar pro modo claro'}
            onClick={() => setTheme(profile?.theme === 'light' ? 'dark' : 'light')}
          >
            {profile?.theme === 'light' ? '☾' : '☀'}
          </button>
          <button type="button" className="icon-btn" onClick={() => setSearchOpen(true)}>
            ⌕
          </button>
          <button type="button" className="icon-btn" onClick={toggleNotif}>
            🔔
            {unreadCount > 0 && <span className="pip-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="mobile-search-overlay">
          <div className="mobile-search-bar">
            <span>⌕</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar projetos, demandas, produtos…"
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setQuery('');
                setSearchOpen(false);
              }}
            >
              ✕
            </button>
          </div>
          <div className="mobile-search-results">
            {query.trim().length < 2 ? (
              <div className="item">Digite pelo menos 2 letras…</div>
            ) : searching ? (
              <div className="item">Buscando…</div>
            ) : !hasResults ? (
              <div className="item">Nada encontrado pra "{query.trim()}".</div>
            ) : (
              <>
                {results.projects.length > 0 && (
                  <>
                    <div className="head">Projetos</div>
                    {results.projects.map((p) => (
                      <div className="item" key={p.id} onClick={() => handleGoTo(`/projetos/${p.id}`)}>
                        {p.name}
                      </div>
                    ))}
                  </>
                )}
                {results.tasks.length > 0 && (
                  <>
                    <div className="head">Demandas</div>
                    {results.tasks.map((t) => (
                      <div className="item" key={t.id} onClick={() => handleGoTo(`/demandas?task=${t.id}`)}>
                        {t.title}
                      </div>
                    ))}
                  </>
                )}
                {results.products.length > 0 && (
                  <>
                    <div className="head">Produtos</div>
                    {results.products.map((p) => (
                      <div className="item" key={p.id} onClick={() => handleGoTo(`/produtos?q=${encodeURIComponent(p.code)}`)}>
                        {p.code} — {p.name}
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {notifOpen && (
        <div className="mobile-sheet-backdrop" onClick={() => setNotifOpen(false)}>
          <div className="mobile-more-sheet mobile-notif-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <NotificationsPanel mentions={mentions} recent={recent} onClose={() => setNotifOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
