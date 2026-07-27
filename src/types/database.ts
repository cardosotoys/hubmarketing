export type Role = 'diretoria' | 'equipe' | 'administrador';
export type Department = 'diretoria' | 'growth' | 'coordenacao' | 'design' | 'assistente';
export const DEPARTMENTS: Department[] = ['diretoria', 'growth', 'coordenacao', 'design', 'assistente'];
export const DEPARTMENT_LABELS: Record<Department, string> = {
  diretoria: 'Diretoria',
  growth: 'Growth / Marketing Digital',
  coordenacao: 'Coordenação',
  design: 'Design',
  assistente: 'Assistente',
};
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'done';
export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type Stage =
  | 'recebido'
  | 'planejamento'
  | 'producao'
  | 'revisao'
  | 'aprovacao'
  | 'finalizado';

export interface Profile {
  id: string;
  name: string;
  role: Role;
  department: Department;
  job_title: string;
  avatar_initials: string;
  created_at: string;
}

export interface Brand {
  id: string;
  key: string;
  label: string;
  color: string;
}

export interface Project {
  id: string;
  brand_id: string;
  name: string;
  sub: string;
  status: ProjectStatus;
  priority: Priority;
  category: string;
  start_date: string | null;
  end_date: string | null;
  ref: string;
  objective: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role_label: string;
}

export interface ChecklistItem {
  id: string;
  project_id: string;
  label: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface Comment {
  id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  stage: Stage;
  title: string;
  priority: Priority;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  delay_reason: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  name: string;
  url: string;
  added_by: string | null;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  project_id: string | null;
  campaign_id: string | null;
  campaign_task_id: string | null;
  task_id: string | null;
  actor_id: string | null;
  action_text: string;
  detail: string;
  created_at: string;
}

export interface DailyReport {
  id: string;
  user_id: string;
  project_id: string | null;
  summary: string;
  report_date: string;
  created_at: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  brand_id: string;
  line: string;
  age_range: string;
  dimensions: string;
  licensed: boolean;
  needs_review: boolean;
  catalog_page: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuditItem {
  id: string;
  project_id: string;
  product_id: string;
  item_to_change: string;
  change_needed: string;
  responsible: string;
  correction_status: string;
  packaging_status: string;
  available: boolean;
  priority_effective: string;
  verified_by: string;
  verified_at: string | null;
  drive_link: string;
  notes: string;
  risk_flag: string;
  created_at: string;
  updated_at: string;
}

export const CORRECTION_STATUSES = ['Sem pendência', 'Não Iniciado', 'Em Andamento', 'Corrigido'] as const;
export const PACKAGING_STATUSES = ['Não Iniciado', 'Em Andamento', 'Finalizada e Correta'] as const;

export interface SocialPost {
  id: string;
  brand_id: string;
  campaign_id: string | null;
  caption: string;
  suggested_date: string | null;
  media_path: string;
  media_url: string;
  media_type: 'image' | 'video';
  status: string;
  created_by: string | null;
  reviewed_by: string | null;
  reviewer_feedback: string;
  created_at: string;
  updated_at: string;
}

export const SOCIAL_POST_STATUSES = ['Pendente', 'Aprovado', 'Alterações solicitadas'] as const;

export type DriveKey = 'cardoso' | 'playmi' | 'topi';

export interface LibraryFolder {
  id: string;
  drive: DriveKey;
  parent_id: string | null;
  name: string;
  note: string;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibraryLink {
  id: string;
  folder_id: string;
  name: string;
  url: string;
  added_by: string | null;
  created_at: string;
}

export type CampaignStatus =
  | 'planejamento'
  | 'producao'
  | 'aprovacao'
  | 'execucao'
  | 'finalizacao'
  | 'concluida'
  | 'cancelada';

export const CAMPAIGN_STATUSES: { key: CampaignStatus; label: string }[] = [
  { key: 'planejamento', label: 'Planejamento' },
  { key: 'producao', label: 'Produção' },
  { key: 'aprovacao', label: 'Aprovação' },
  { key: 'execucao', label: 'Execução' },
  { key: 'finalizacao', label: 'Finalização' },
  { key: 'concluida', label: 'Concluída' },
  { key: 'cancelada', label: 'Cancelada' },
];

// Fases que compõem a barra de "Progresso Geral" no dashboard executivo da campanha
// (concluida/cancelada são estados terminais, não aparecem na barra).
export const CAMPAIGN_PROGRESS_PHASES: CampaignStatus[] = [
  'planejamento',
  'producao',
  'aprovacao',
  'execucao',
  'finalizacao',
];

export interface Campaign {
  id: string;
  brand_id: string;
  name: string;
  category: string;
  tags: string[];
  priority: Priority;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  objective: string;
  description: string;
  problem: string;
  opportunity: string;
  target_audience: string;
  personas: string;
  competitors: string;
  message_main: string;
  tone_of_voice: string;
  promise: string;
  value_proposition: string;
  differentiators: string;
  strategy: string;
  restrictions: string;
  assumptions: string;
  stakeholders: string;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignProduct {
  campaign_id: string;
  product_id: string;
  created_at: string;
}

export interface CampaignChecklistItem {
  id: string;
  campaign_id: string;
  label: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface CampaignDocument {
  id: string;
  campaign_id: string;
  name: string;
  url: string;
  added_by: string | null;
  created_at: string;
}

export type ObjectiveKind = 'estrategico' | 'tatico' | 'operacional';
export const OBJECTIVE_KINDS: { key: ObjectiveKind; label: string }[] = [
  { key: 'estrategico', label: 'Estratégico' },
  { key: 'tatico', label: 'Tático' },
  { key: 'operacional', label: 'Operacional' },
];

export type ObjectiveStatus = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'em_risco';
export const OBJECTIVE_STATUSES: { key: ObjectiveStatus; label: string }[] = [
  { key: 'nao_iniciado', label: 'Não iniciado' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'concluido', label: 'Concluído' },
  { key: 'em_risco', label: 'Em risco' },
];

export interface CampaignObjective {
  id: string;
  campaign_id: string;
  kind: ObjectiveKind;
  description: string;
  indicator: string;
  unit: string;
  target_value: number | null;
  current_value: number | null;
  weight: number | null;
  responsible_id: string | null;
  due_date: string | null;
  status: ObjectiveStatus;
  percent: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignKpi {
  id: string;
  campaign_id: string;
  name: string;
  unit: string;
  target_value: number | null;
  current_value: number;
  source: string;
  responsible_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignKpiHistory {
  id: string;
  kpi_id: string;
  value: number;
  recorded_at: string;
}

export type CampaignTaskStage =
  | 'backlog'
  | 'planejada'
  | 'producao'
  | 'revisao'
  | 'aguardando_aprovacao'
  | 'aprovada'
  | 'publicada'
  | 'concluida'
  | 'cancelada';

export const CAMPAIGN_TASK_STAGES: { key: CampaignTaskStage; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'planejada', label: 'Planejada' },
  { key: 'producao', label: 'Em Produção' },
  { key: 'revisao', label: 'Em Revisão' },
  { key: 'aguardando_aprovacao', label: 'Aguardando Aprovação' },
  { key: 'aprovada', label: 'Aprovada' },
  { key: 'publicada', label: 'Publicada' },
  { key: 'concluida', label: 'Concluída' },
  { key: 'cancelada', label: 'Cancelada' },
];

export type Rag = 'low' | 'medium' | 'high';
export const RAG_LEVELS: { key: Rag; label: string }[] = [
  { key: 'low', label: 'Baixa' },
  { key: 'medium', label: 'Média' },
  { key: 'high', label: 'Alta' },
];

export interface CampaignTask {
  id: string;
  campaign_id: string;
  title: string;
  description: string;
  department: string;
  product_id: string | null;
  priority: Priority;
  urgency: Rag;
  complexity: Rag;
  impact: Rag;
  assignee_id: string | null;
  reviewer_id: string | null;
  approver_id: string | null;
  requester_id: string | null;
  estimated_hours: number | null;
  spent_hours: number;
  start_date: string | null;
  due_date: string | null;
  is_milestone: boolean;
  stage: CampaignTaskStage;
  approval_feedback: string;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignTaskDependency {
  task_id: string;
  depends_on_id: string;
}

export interface CampaignTaskChecklistItem {
  id: string;
  campaign_task_id: string;
  label: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface CampaignTaskComment {
  id: string;
  campaign_task_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export const BUDGET_CATEGORIES = ['Mídia paga', 'Produção', 'Evento', 'Influenciadores', 'Outro'] as const;

export interface CampaignBudgetItem {
  id: string;
  campaign_id: string;
  description: string;
  category: string;
  planned_amount: number;
  spent_amount: number;
  created_at: string;
}

export type RiskProbability = 'baixa' | 'media' | 'alta';
export type RiskImpact = 'baixo' | 'medio' | 'alto';
export type RiskStatus = 'aberto' | 'monitorando' | 'mitigado' | 'ocorreu';

export const RISK_PROBABILITIES: RiskProbability[] = ['baixa', 'media', 'alta'];
export const RISK_IMPACTS: RiskImpact[] = ['baixo', 'medio', 'alto'];
export const RISK_STATUSES: { key: RiskStatus; label: string }[] = [
  { key: 'aberto', label: 'Aberto' },
  { key: 'monitorando', label: 'Monitorando' },
  { key: 'mitigado', label: 'Mitigado' },
  { key: 'ocorreu', label: 'Ocorreu' },
];

export interface CampaignRisk {
  id: string;
  campaign_id: string;
  description: string;
  probability: RiskProbability;
  impact: RiskImpact;
  mitigation_plan: string;
  responsible_id: string | null;
  status: RiskStatus;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignDecision {
  id: string;
  campaign_id: string;
  context: string;
  alternatives: string;
  choice: string;
  impact: string;
  stakeholders: string;
  decided_at: string;
  created_by: string | null;
  created_at: string;
}

export type CreativeStatus = 'rascunho' | 'em_aprovacao' | 'aprovado' | 'reprovado';
export const CREATIVE_STATUSES: { key: CreativeStatus; label: string }[] = [
  { key: 'rascunho', label: 'Rascunho' },
  { key: 'em_aprovacao', label: 'Em aprovação' },
  { key: 'aprovado', label: 'Aprovado' },
  { key: 'reprovado', label: 'Reprovado' },
];

export interface CampaignCreative {
  id: string;
  campaign_id: string;
  name: string;
  type: string;
  file_path: string;
  file_url: string;
  version: number;
  status: CreativeStatus;
  approver_id: string | null;
  feedback: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentType = 'post' | 'video' | 'story' | 'reel' | 'short' | 'banner' | 'catalogo';
export const CONTENT_TYPES: ContentType[] = ['post', 'video', 'story', 'reel', 'short', 'banner', 'catalogo'];
export type ContentStatus = 'planejado' | 'em_producao' | 'agendado' | 'publicado';
export const CONTENT_STATUSES: { key: ContentStatus; label: string }[] = [
  { key: 'planejado', label: 'Planejado' },
  { key: 'em_producao', label: 'Em produção' },
  { key: 'agendado', label: 'Agendado' },
  { key: 'publicado', label: 'Publicado' },
];

export interface CampaignContent {
  id: string;
  campaign_id: string;
  title: string;
  content_type: ContentType;
  scheduled_date: string | null;
  status: ContentStatus;
  social_post_id: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type InfluencerStatus = 'contato' | 'negociacao' | 'confirmado' | 'entregue' | 'cancelado';
export const INFLUENCER_STATUSES: { key: InfluencerStatus; label: string }[] = [
  { key: 'contato', label: 'Contato' },
  { key: 'negociacao', label: 'Negociação' },
  { key: 'confirmado', label: 'Confirmado' },
  { key: 'entregue', label: 'Entregue' },
  { key: 'cancelado', label: 'Cancelado' },
];

export interface CampaignInfluencer {
  id: string;
  campaign_id: string;
  name: string;
  handle: string;
  platform: string;
  deliverables: string;
  fee: number;
  status: InfluencerStatus;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TradeActionStatus = 'planejada' | 'em_andamento' | 'concluida' | 'cancelada';
export const TRADE_ACTION_STATUSES: { key: TradeActionStatus; label: string }[] = [
  { key: 'planejada', label: 'Planejada' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'concluida', label: 'Concluída' },
  { key: 'cancelada', label: 'Cancelada' },
];

export interface CampaignTradeAction {
  id: string;
  campaign_id: string;
  description: string;
  channel: string;
  status: TradeActionStatus;
  start_date: string | null;
  end_date: string | null;
  responsible_id: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MarketplaceStatus = 'planejado' | 'publicado' | 'pausado';
export const MARKETPLACE_STATUSES: { key: MarketplaceStatus; label: string }[] = [
  { key: 'planejado', label: 'Planejado' },
  { key: 'publicado', label: 'Publicado' },
  { key: 'pausado', label: 'Pausado' },
];

export interface CampaignMarketplaceEntry {
  id: string;
  campaign_id: string;
  marketplace: string;
  product_id: string | null;
  url: string;
  status: MarketplaceStatus;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadStage = 'novo' | 'qualificado' | 'proposta' | 'fechado' | 'perdido';
export const LEAD_STAGES: { key: LeadStage; label: string }[] = [
  { key: 'novo', label: 'Novo' },
  { key: 'qualificado', label: 'Qualificado' },
  { key: 'proposta', label: 'Proposta' },
  { key: 'fechado', label: 'Fechado' },
  { key: 'perdido', label: 'Perdido' },
];

export interface CampaignLead {
  id: string;
  campaign_id: string;
  name: string;
  company: string;
  contact: string;
  source: string;
  stage: LeadStage;
  value: number;
  responsible_id: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignMediaInvestment {
  id: string;
  campaign_id: string;
  channel: string;
  planned_amount: number;
  spent_amount: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
  period_start: string | null;
  period_end: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  brand_id: string | null;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export const STAGES: { key: Stage; label: string }[] = [
  { key: 'recebido', label: 'Recebido' },
  { key: 'planejamento', label: 'Planejamento' },
  { key: 'producao', label: 'Produção' },
  { key: 'revisao', label: 'Revisão' },
  { key: 'aprovacao', label: 'Aprovação' },
  { key: 'finalizado', label: 'Finalizado' },
];

export const ROLE_LABELS: Record<Role, string> = {
  diretoria: 'Diretoria',
  equipe: 'Equipe',
  administrador: 'Administrador',
};

export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];
export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export interface IaPrompt {
  id: string;
  brand_id: string | null;
  category: string;
  title: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IaTemplate {
  id: string;
  brand_id: string | null;
  category: string;
  name: string;
  description: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IaPersona {
  id: string;
  brand_id: string | null;
  name: string;
  description: string;
  pains: string;
  goals: string;
  tone_notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IaBrandVoice {
  id: string;
  brand_id: string;
  archetype: string;
  tone_of_voice: string;
  dos: string;
  donts: string;
  sample_phrases: string;
  updated_by: string | null;
  updated_at: string;
}
