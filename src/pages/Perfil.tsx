import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import StatusTag from '../components/StatusTag';
import { ROLE_LABELS, type Project } from '../types/database';

export default function Perfil() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('project_members')
      .select('project:projects(*)')
      .eq('user_id', profile.id)
      .then(({ data }) => {
        setProjects(((data as { project: Project | null }[] | null) ?? []).flatMap((row) => (row.project ? [row.project] : [])));
        setLoading(false);
      });
  }, [profile]);

  if (!profile) return null;

  return (
    <div className="page">
      <h1 className="page-title">Perfil</h1>
      <div className="info-grid">
        <div>
          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="avatar lg">{profile.avatar_initials}</div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15 }}>{profile.name}</div>
                <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                  {ROLE_LABELS[profile.role]}
                  {profile.job_title ? ` · ${profile.job_title}` : ''}
                </div>
              </div>
            </div>
          </div>
          <div className="panel">
            <h4>Projetos em que participa</h4>
            {loading ? (
              <div className="page-sub">Carregando…</div>
            ) : projects.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                Você ainda não foi adicionado a nenhum projeto.
              </div>
            ) : (
              projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projetos/${p.id}`}
                  className="field-row"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  <span className="k">{p.name}</span>
                  <StatusTag status={p.status} />
                </Link>
              ))
            )}
          </div>
        </div>
        <div className="panel">
          <h4>Preferências</h4>
          <div className="field-row">
            <span className="k">Tema</span>
            <span>Escuro</span>
          </div>
          <div className="field-row">
            <span className="k">Notificações</span>
            <span>Ativadas</span>
          </div>
          <div className="field-row">
            <span className="k">Idioma</span>
            <span>Português (BR)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
