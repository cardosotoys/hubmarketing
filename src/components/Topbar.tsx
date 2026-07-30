import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import Avatar from './Avatar';
import type { ActivityLogEntry, TaskComment } from '../types/database';

type ActivityWithActor = ActivityLogEntry & { actor: { name: string } | null };
type MentionRow = TaskComment & { author: { name: string } | null; task: { title: string } | null };

interface SearchResults {
  projects: { id: string; name: string }[];
  tasks: { id: string; title: string; project_id: string | null }[];
  products: { id: string; code: string; name: string }[];
}

const EMPTY_RESULTS: SearchResults = { projects: [], tasks: [], products: [] };

export default function Topbar({ breadcrumb, onMenuClick }: { breadcrumb: string; onMenuClick: () => void }) {
  const { profile, setTheme } = useAuth();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [recent, setRecent] = useState<ActivityWithActor[]>([]);
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY_RESULTS);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const like = `%${q}%`;
      const [projectsByName, tasksByTitle, productsByName, productsByCode] = await Promise.all([
        supabase.from('projects').select('id, name').ilike('name', like).limit(5),
        supabase.from('tasks').select('id, title, project_id').ilike('title', like).limit(5),
        supabase.from('products').select('id, code, name').ilike('name', like).limit(5),
        supabase.from('products').select('id, code, name').ilike('code', like).limit(5),
      ]);
      const productMap = new Map<string, { id: string; code: string; name: string }>();
      [...(productsByName.data ?? []), ...(productsByCode.data ?? [])].forEach((p) => productMap.set(p.id, p));
      setResults({
        projects: (projectsByName.data as { id: string; name: string }[]) ?? [],
        tasks: (tasksByTitle.data as { id: string; title: string; project_id: string | null }[]) ?? [],
        products: Array.from(productMap.values()),
      });
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hasResults = results.projects.length > 0 || results.tasks.length > 0 || results.products.length > 0;

  function goTo(path: string) {
    setQuery('');
    setSearchOpen(false);
    navigate(path);
  }

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('task_comments')
      .select('*, author:profiles(name), task:tasks(title)')
      .contains('mentioned_ids', [profile.id])
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setMentions((data as MentionRow[] | null) ?? []));
  }, [profile]);

  useEffect(() => {
    if (!showNotif) return;
    supabase
      .from('activity_log')
      .select('*, actor:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecent((data as ActivityWithActor[] | null) ?? []));
  }, [showNotif]);

  return (
    <div className="topbar">
      <button className="hamburger-btn" onClick={onMenuClick}>
        ☰
      </button>
      <div className="breadcrumb">
        <b>{breadcrumb}</b>
      </div>
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
        <Link className="icon-btn" to="/demandas">
          ☰
        </Link>
        <div className="icon-btn" onClick={() => setShowNotif((s) => !s)}>
          🔔
          {mentions.length > 0 && <span className="pip"></span>}
        </div>
        <Link className="user-chip" to="/perfil">
          <Avatar profile={profile} />
          <span>{profile?.name ?? '…'}</span>
        </Link>
      </div>

      {showNotif && (
        <div className="notif-panel">
          {mentions.length > 0 && (
            <>
              <div className="head">Menções pra você</div>
              {mentions.map((m) => (
                <Link
                  className="item"
                  key={m.id}
                  to={`/demandas?task=${m.task_id}&focus=comments`}
                  onClick={() => setShowNotif(false)}
                >
                  <b>{m.author?.name ?? 'Alguém'}</b> te marcou em "{m.task?.title ?? 'uma demanda'}": {m.body}
                </Link>
              ))}
            </>
          )}
          <div className="head">Atividade recente</div>
          {recent.length === 0 && <div className="item">Nada por aqui ainda.</div>}
          {recent.map((r) => {
            const content = (
              <>
                <b>{r.actor?.name ?? 'Alguém'}</b> {r.action_text}
                {r.detail ? ` — ${r.detail}` : ''}
              </>
            );
            if (r.task_id) {
              return (
                <Link className="item" key={r.id} to={`/demandas?task=${r.task_id}`} onClick={() => setShowNotif(false)}>
                  {content}
                </Link>
              );
            }
            if (r.project_id) {
              return (
                <Link className="item" key={r.id} to={`/projetos/${r.project_id}`} onClick={() => setShowNotif(false)}>
                  {content}
                </Link>
              );
            }
            return (
              <div className="item" key={r.id}>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
