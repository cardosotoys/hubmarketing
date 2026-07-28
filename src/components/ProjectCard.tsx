import { Link } from 'react-router-dom';
import type { Brand, Project } from '../types/database';
import StatusTag from './StatusTag';

export default function ProjectCard({
  project,
  brand,
  percent,
  onDuplicate,
}: {
  project: Project;
  brand: Brand;
  percent: number;
  onDuplicate?: () => void;
}) {
  return (
    <Link to={`/projetos/${project.id}`} className="project-card" style={{ position: 'relative' }}>
      {onDuplicate && (
        <button
          className="btn ghost sm"
          title="Duplicar projeto"
          style={{ position: 'absolute', top: 10, right: 10, padding: '2px 8px' }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDuplicate();
          }}
        >
          ⧉
        </button>
      )}
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
