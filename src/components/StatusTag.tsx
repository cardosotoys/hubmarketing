import type { ProjectStatus } from '../types/database';

const STATUS_MAP: Record<ProjectStatus, [string, string]> = {
  active: ['active', 'Ativo'],
  paused: ['paused', 'Atenção'],
  planning: ['planning', 'Planejamento'],
  done: ['done', 'Concluído'],
};

export default function StatusTag({ status }: { status: ProjectStatus }) {
  const [cls, label] = STATUS_MAP[status];
  return <span className={`tag ${cls}`}>{label}</span>;
}
