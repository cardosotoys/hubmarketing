import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Brand, Project } from '../types/database';
import StatusTag from './StatusTag';

export default function ProjectCard({
  project,
  brand,
  percent,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  brand: Brand;
  percent: number;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="project-card" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0 }}>{project.name}</h3>
        <p style={{ color: 'var(--red)', margin: 0 }}>Excluir este projeto? Demandas, checklist e histórico dele somem junto.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" onClick={() => setConfirming(false)}>
            Cancelar
          </button>
          <button className="btn sm" style={{ background: 'var(--red)' }} onClick={onDelete}>
            Excluir
          </button>
        </div>
      </div>
    );
  }

  return (
    <Link to={`/projetos/${project.id}`} className="project-card" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
        {onDuplicate && (
          <button
            className="btn ghost sm"
            title="Duplicar projeto"
            style={{ padding: '2px 8px' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDuplicate();
            }}
          >
            ⧉
          </button>
        )}
        {onDelete && (
          <button
            className="btn ghost sm"
            title="Excluir projeto"
            style={{ padding: '2px 8px', color: 'var(--red)' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirming(true);
            }}
          >
            ✕
          </button>
        )}
      </div>
      <div className="brand-strip" style={{ background: brand.color }} />
      <span
        className="pill"
        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-faint)' }}
      >
        {brand.label}
      </span>
      <h3>{project.name}</h3>
      <p>{project.sub}</p>
      <div className="project-meta">
        <StatusTag status={project.status} />
        <div className="progress-mini">
          <div className="bar">
            <i style={{ width: `${percent}%` }} />
          </div>
          {percent}%
        </div>
      </div>
    </Link>
  );
}
