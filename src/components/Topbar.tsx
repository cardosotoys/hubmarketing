import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import NotificationsPanel from './NotificationsPanel';
import { useNotifications } from '../hooks/useNotifications';
import { useGlobalSearch } from '../hooks/useGlobalSearch';

export default function Topbar({ breadcrumb, onMenuClick }: { breadcrumb: string; onMenuClick: () => void }) {
  const { profile, setTheme } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Workspace = contexto (Todos/Marketing/Comercial/Produtos/Diretoria). Por ora guarda a escolha;
  // a segmentação real dos dados por setor entra na fase de multi-tenant.
  const [workspace, setWorkspace] = useState(() => localStorage.getItem('workspace') || 'todos');
  function changeWorkspace(w: string) {
    setWorkspace(w);
    localStorage.setItem('workspace', w);
  }
  const { notifications, recent, unreadCount, markRead, markAllRead, loadRecent, reload } = useNotifications(profile?.id);
  const { query, setQuery, searching, results, hasResults, goTo: searchGoTo } = useGlobalSearch();

  function goTo(path: string) {
    searchGoTo(path);
    setSearchOpen(false);
  }

  function toggleNotif() {
    setShowNotif((s) => {
      if (!s) {
        loadRecent();
        reload();
      }
      return !s;
    });
  }

  // fecha o painel de notificações ao clicar fora dele/do sino, ou no Esc
  useEffect(() => {
    if (!showNotif) return;
    function onDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest('.notif-panel') || t.closest('.notif-bell')) return;
      setShowNotif(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowNotif(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showNotif]);

  return (
    <div className="topbar">
      <button className="hamburger-btn" onClick={onMenuClick}>
        ☰
      </button>
      <div className="breadcrumb">
        <b>{breadcrumb}</b>
      </div>
      <select
        className="chip-select ws-select"
        value={workspace}
        onChange={(e) => changeWorkspace(e.target.value)}
        title="Workspace (contexto)"
      >
        <option value="todos">🌐 Todos</option>
        <option value="marketing">Marketing</option>
        <option value="comercial">Comercial</option>
        <option value="produtos">Produtos</option>
        <option value="diretoria">Diretoria</option>
      </select>
      <div className="search-bar" style={{ cursor: 'text', position: 'relative' }}>
        <span>⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          placeholder="Pesquisar projetos, demandas, produtos…"
          style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12.5, outline: 'none' }}
        />
        {query && (
          <span style={{ cursor: 'pointer' }} onMouseDown={() => setQuery('')}>
            ✕
          </span>
        )}

        {searchOpen && query.trim().length >= 2 && (
          <div className="notif-panel" style={{ top: 40, left: 0, right: 'auto', width: 340 }}>
            {searching ? (
              <div className="item">Buscando…</div>
            ) : !hasResults ? (
              <div className="item">Nada encontrado pra "{query.trim()}".</div>
            ) : (
              <>
                {results.projects.length > 0 && (
                  <>
                    <div className="head">Projetos</div>
                    {results.projects.map((p) => (
                      <div className="item" key={p.id} style={{ cursor: 'pointer' }} onMouseDown={() => goTo(`/projetos/${p.id}`)}>
                        {p.name}
                      </div>
                    ))}
                  </>
                )}
                {results.tasks.length > 0 && (
                  <>
                    <div className="head">Demandas</div>
                    {results.tasks.map((t) => (
                      <div className="item" key={t.id} style={{ cursor: 'pointer' }} onMouseDown={() => goTo(`/demandas?task=${t.id}`)}>
                        {t.title}
                      </div>
                    ))}
                  </>
                )}
                {results.products.length > 0 && (
                  <>
                    <div className="head">Produtos</div>
                    {results.products.map((p) => (
                      <div className="item" key={p.id} style={{ cursor: 'pointer' }} onMouseDown={() => goTo(`/produtos?q=${encodeURIComponent(p.code)}`)}>
                        {p.code} — {p.name}
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div className="topbar-right">
        <div
          className="icon-btn"
          title={profile?.theme === 'light' ? 'Mudar pro modo escuro' : 'Mudar pro modo claro'}
          onClick={() => setTheme(profile?.theme === 'light' ? 'dark' : 'light')}
        >
          {profile?.theme === 'light' ? '☾' : '☀'}
        </div>
        <Link className="btn sm" to="/demandas?new=1" title="Nova demanda">
          + Demanda
        </Link>
        <div className="icon-btn notif-bell" onClick={toggleNotif}>
          🔔
          {unreadCount > 0 && <span className="pip-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </div>
        <Link className="user-chip" to="/perfil">
          <Avatar profile={profile} />
          <span>{profile?.name ?? '…'}</span>
        </Link>
      </div>

      {showNotif && (
        <NotificationsPanel
          notifications={notifications}
          recent={recent}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onClose={() => setShowNotif(false)}
        />
      )}
    </div>
  );
}
