export type Role = 'diretoria' | 'equipe' | 'administrador';
export type Theme = 'dark' | 'light';
export type FontScale = 'sm' | 'md' | 'lg' | 'xl';
export type CategoryScope = 'projeto' | 'campanha';

export interface Category {
  id: string;
  scope: CategoryScope;
  label: string;
  created_at: string;
}
export type Department = 'diretoria' | 'growth' | 'coordenacao' | 'design' | 'assistente' | 'produto_eng';
export const DEPARTMENTS: Department[] = ['diretoria', 'growth', 'coordenacao', 'design', 'assistente', 'produto_eng'];
export const DEPARTMENT_LABELS: Record<Department, string> = {
  diretoria: 'Diretoria',
  growth: 'Growth / Marketing Digital',
  coordenacao: 'Coordenação',
  design: 'Design',
  assistente: 'Assistente',
  produto_eng: 'Produto / Engenharia',
};
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'done';
export type Priority = 'urgent' | 'high' | 'medium' | 'low';

export interface ProjectStage {
  id: string;
  project_id: string | null;
  packaging_track: PackagingTrack | null;
  name: string;
  position: number;
  is_final: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectTemplateStage {
  id: string;
  template_id: string;
  name: string;
  position: number;
  is_final: boolean;
  created_at: string;
}

export const MODULE_KEYS = [
  'dashboard',
  'relatorios',
  'projetos',
  'demandas',
  'calendario',
  'redes-sociais',
  'biblioteca',
  'produtos',
  'monitor-precos',
  'brand',
  'campanhas',
  'design-produto',
  'embalagens',
  'marcas',
  'ia',
  'monday',
  'relatorio-diario',
  'auditoria',
  'notificacoes',
  'configuracoes',
  'perfil',
  'trade-marketing',
  // módulos novos (estrutura vazia — implementação futura)
  'aprovacoes',
  'pesquisa-mercado',
  'concorrentes',
  'certificacoes',
  'fotos',
  'videos',
  'templates',
  'documentos',
  'usuarios',
  'permissoes',
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  relatorios: 'Relatórios',
  projetos: 'Projetos',
  demandas: 'Demandas',
  calendario: 'Calendário',
  'redes-sociais': 'Redes Sociais',
  biblioteca: 'Drive',
  produtos: 'Produtos',
  'monitor-precos': 'Monitor de Preços',
  brand: 'Brand',
  campanhas: 'Campanhas',
  'design-produto': 'Design de Produto',
  embalagens: 'Embalagens',
  marcas: 'Marcas',
  ia: 'IA',
  monday: 'Monday (arquivo)',
  'relatorio-diario': 'Relatório Diário',
  auditoria: 'Auditoria',
  notificacoes: 'Notificações',
  configuracoes: 'Configurações',
  perfil: 'Perfil',
  'trade-marketing': 'Trade Marketing',
  aprovacoes: 'Aprovações',
  'pesquisa-mercado': 'Pesquisa de Mercado',
  concorrentes: 'Concorrentes',
  certificacoes: 'Certificações',
  fotos: 'Fotos',
  videos: 'Vídeos',
  templates: 'Templates',
  documentos: 'Documentos',
  usuarios: 'Usuários',
  permissoes: 'Permissões',
};

export interface Profile {
  id: string;
  name: string;
  role: Role;
  department: Department;
  job_title: string;
  avatar_initials: string;
  avatar_url: string;
  phone: string;
  bio: string;
  hidden_modules: string[];
  extra_modules: string[];
  theme: Theme;
  font_scale: FontScale;
  disabled: boolean;
  can_edit_products: boolean;
  created_at: string;
}

export interface Brand {
  id: string;
  key: string;
  label: string;
  color: string;
}

export interface BrandLicensee {
  id: string;
  name: string;
  licensor: string;
  color: string;
  source_type: 'site' | 'drive';
  guide_url: string;
  palette: BrandColor[];
  logos_url: string;
  colors_url: string;
  typography_url: string;
  icons_url: string;
  pattern_url: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface BrandColor {
  name: string;
  hex: string;
}
export type BrandAssetCategory = 'logos' | 'colors' | 'typography' | 'icons' | 'pattern';
export interface BrandLicenseeFile {
  id: string;
  licensee_id: string;
  category: BrandAssetCategory;
  name: string;
  url: string;
  path: string;
  added_by: string | null;
  created_at: string;
}

export type PackagingTrack = 'criacao' | 'melhoria' | 'criacao_teste' | 'melhoria_teste' | 'marca';
export const PACKAGING_TRACKS: { key: PackagingTrack; label: string; hint: string }[] = [
  { key: 'criacao', label: 'Criação', hint: 'Embalagem nova — do planejamento à produção' },
  { key: 'melhoria', label: 'Melhoria', hint: 'Corrigir/aprovar embalagem de produto existente' },
];
// Trilhas do módulo isolado "Embalagens (Teste)" — dados de teste/importação, sem afetar o real
export const PACKAGING_TRACKS_TESTE: { key: PackagingTrack; label: string; hint: string }[] = [
  { key: 'criacao_teste', label: 'Criação', hint: 'Embalagem nova (teste)' },
  { key: 'melhoria_teste', label: 'Melhoria', hint: 'Corrigir/aprovar embalagem existente (teste)' },
];
// Etapas-padrão de cada trilha (pré-carregadas ao criar um projeto de embalagem, editáveis depois).
// A última (is_final) fecha o fluxo.
export const PACKAGING_TRACK_STAGES: Record<'criacao' | 'melhoria', { name: string; is_final: boolean }[]> = {
  criacao: [
    { name: 'Planejamento', is_final: false },
    { name: 'Planificação', is_final: false },
    { name: 'Aprovado para Impressão', is_final: false },
    { name: 'Impressão da Embalagem', is_final: false },
    { name: 'Produção', is_final: true },
  ],
  melhoria: [
    { name: 'Recebido', is_final: false },
    { name: 'Planejamento', is_final: false },
    { name: 'Produção', is_final: false },
    { name: 'Revisão', is_final: false },
    { name: 'Aprovação', is_final: false },
    { name: 'Finalizado', is_final: true },
  ],
};

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

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  mentioned_ids: string[];
  parent_id: string | null;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export type ApprovalState = 'none' | 'aguardando' | 'aprovado' | 'correcao';
export const APPROVAL_STATE_LABELS: Record<ApprovalState, string> = {
  none: 'Sem aprovação pendente',
  aguardando: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  correcao: 'Correção solicitada',
};

export interface Task {
  id: string;
  project_id: string | null;
  product_id: string | null;
  stage_id: string;
  title: string;
  priority: Priority;
  assignee_id: string | null;
  start_date: string | null;
  target_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  delay_reason: string;
  notes: string;
  budget: number | null;
  packaging_track: PackagingTrack | null;
  brand_id: string | null;
  approval_state: ApprovalState;
  approval_requested_to: string | null;
  approval_note: string;
  updated_by: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export type ApprovalDecision = 'pendente' | 'aprovado' | 'correcao';
export interface TaskApproval {
  id: string;
  task_id: string;
  approver_id: string;
  decision: ApprovalDecision;
  note: string;
  decided_at: string | null;
  created_at: string;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  label: string;
  done: boolean;
  done_at: string | null;
  is_gate: boolean;
  stage_id: string | null;
  substep_id: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
}

// Template de sub-etapas de uma etapa (com prazo relativo e condicional/gate)
export interface StageSubstep {
  id: string;
  stage_id: string;
  label: string;
  position: number;
  is_conditional: boolean;
  due_offset_days: number | null;
  created_at: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  default_priority: Priority;
  objective: string;
  created_at: string;
}

export interface ProjectTemplateChecklistItem {
  id: string;
  template_id: string;
  label: string;
  position: number;
}

export interface ProjectTemplateTask {
  id: string;
  template_id: string;
  title: string;
  stage_template_id: string;
  priority: Priority;
  position: number;
}

export interface ProjectFile {
  id: string;
  project_id: string | null;
  task_id: string | null;
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
  product_dev_item_id: string | null;
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
  ean: string;
  inmetro_number: string;
  image_url: string; // imagem do produto
  packaging_image_url: string; // imagem da embalagem
  gender: string;
  material: string;
  color: string;
  toy_category: string;
  technical_name: string;
  has_mechanism: boolean;
  has_sound: boolean;
  has_light: boolean;
  battery_type: string;
  supported_weight: string;
  product_length_mm: number | null;
  product_width_mm: number | null;
  product_height_mm: number | null;
  product_volume_m3: number | null;
  product_weight_kg: number | null;
  package_contents: string;
  package_length_mm: number | null;
  package_width_mm: number | null;
  package_height_mm: number | null;
  package_volume_m3: number | null;
  package_weight_kg: number | null;
  ncm: string;
  cst: string;
  dun: string;
  carton_length_mm: number | null;
  carton_width_mm: number | null;
  carton_height_mm: number | null;
  carton_volume_m3: number | null;
  carton_quantity: number | null;
  carton_gross_weight_kg: number | null;
  pallet_layer_pattern: string;
  pallet_height_m: number | null;
  pallet_total_units: number | null;
  created_at: string;
  updated_at: string;
}

export type MpmMarketplace = 'mercado_livre' | 'amazon' | 'shopee' | 'google_shopping' | 'google_search';
export const MPM_MARKETPLACE_LABELS: Record<MpmMarketplace, string> = {
  mercado_livre: 'Mercado Livre',
  amazon: 'Amazon',
  shopee: 'Shopee',
  google_shopping: 'Google Shopping',
  google_search: 'Google Search',
};

export type MpmMatchStatus = 'high_confidence' | 'needs_review' | 'confirmed_match' | 'rejected';
export const MPM_MATCH_STATUS_LABELS: Record<MpmMatchStatus, string> = {
  high_confidence: 'Confiança alta',
  needs_review: 'Revisão manual',
  confirmed_match: 'Confirmado',
  rejected: 'Rejeitado',
};

export type MpmAlertStatus = 'new' | 'acknowledged' | 'resolved';

export interface MpmProduct {
  id: string;
  product_id: string;
  min_price: number;
  suggested_price: number | null;
  keywords: string[];
  synonyms: string[];
  monitoring_status: 'active' | 'paused';
  created_at: string;
  updated_at: string;
}

export interface MpmListing {
  id: string;
  mpm_product_id: string;
  marketplace: MpmMarketplace;
  external_id: string;
  store_name: string;
  title: string;
  url: string;
  image_url: string;
  shipping_price: number | null;
  installment_info: string;
  // null quando o anúncio veio da busca de site: (Mercado Livre/Shopee) e não deu pra confirmar
  // o preço real com segurança — evita mostrar um valor errado (ex.: frete/parcela confundido
  // com preço do produto).
  current_price: number | null;
  match_status: MpmMatchStatus;
  match_score: number;
  is_violation: boolean;
  first_seen_at: string;
  last_checked_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string;
  created_at: string;
  updated_at: string;
}

export interface MpmPriceHistory {
  id: string;
  listing_id: string;
  price: number;
  min_price_at_check: number;
  is_violation: boolean;
  diff_amount: number | null;
  diff_percent: number | null;
  collected_at: string;
}

export interface MpmAlert {
  id: string;
  mpm_product_id: string;
  listing_id: string;
  price: number;
  min_price: number;
  diff_amount: number;
  diff_percent: number;
  status: MpmAlertStatus;
  notified_internal: boolean;
  notified_email: boolean;
  notified_webhook: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolved_note: string;
  created_at: string;
}

export interface MpmSyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'error';
  products_checked: number;
  listings_found: number;
  violations_found: number;
  error_message: string;
  queries_attempted: number;
  queries_failed: number;
  last_error_sample: string;
}

export interface MpmSettings {
  id: boolean;
  search_interval_hours: number;
  sources: MpmMarketplace[];
  alert_email: string;
  alert_webhook_url: string;
  whatsapp_number: string;
  updated_at: string;
  updated_by: string | null;
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

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string;
  task_id: string | null;
  project_id: string | null;
  read: boolean;
  created_at: string;
}

export interface AccessPreset {
  id: string;
  name: string;
  modules: string[]; // ModuleKey[] — conjunto de módulos que o preset libera
  created_at: string;
}

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
  campaign_id: string | null;
  project_id: string | null;
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
  campaign_id: string | null;
  project_id: string | null;
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
  campaign_id: string | null;
  project_id: string | null;
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

export interface IaSkill {
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

// ============================================================
// Design de Produto — desenvolvimento stage-gate (brinquedo de plástico injetado)
// ============================================================

export type ProductDevOwner = 'compartilhado' | 'produto' | 'marketing' | 'qualidade';
export const PRODUCT_DEV_OWNER_LABELS: Record<ProductDevOwner, string> = {
  compartilhado: 'Compartilhado',
  produto: 'Produto / Eng.',
  marketing: 'Marketing',
  qualidade: 'Produto/Eng. + Qualidade',
};

export interface ProductDevPhaseDef {
  n: number;
  name: string;
  owner: ProductDevOwner;
  deliverable: string;
  gate: string;
  blocking?: boolean;
}

// As 9 fases do fluxo. Nome/dono/portão vivem aqui (o banco guarda só o número da fase
// e a decisão de cada portão). Marketing e Embalagens rodam em paralelo desde a Fase 1.
export const PRODUCT_DEV_PHASES: ProductDevPhaseDef[] = [
  { n: 1, name: 'Estratégia & concepção', owner: 'compartilhado', deliverable: 'Conceito + faixa etária + meta de preço', gate: 'Viável comercial e no orçamento?' },
  { n: 2, name: 'Requisitos & especificação', owner: 'produto', deliverable: 'PRD + material definido', gate: 'Requisitos completos e sem conflito?' },
  { n: 3, name: 'Design conceitual & industrial', owner: 'produto', deliverable: 'Modelo 3D + análise de DFM', gate: 'É injetável e mantém o apelo?' },
  { n: 4, name: 'Prototipagem & validação', owner: 'produto', deliverable: 'Protótipo aprovado + design congelado', gate: 'Produto físico ok e seguro?' },
  { n: 5, name: 'Ferramentaria (molde)', owner: 'produto', deliverable: 'Molde + amostras aprovadas', gate: 'Amostras conforme o padrão?' },
  { n: 6, name: 'Certificação & conformidade', owner: 'qualidade', deliverable: 'Certificado INMETRO + registro', gate: 'Certificado válido? (bloqueante)', blocking: true },
  { n: 7, name: 'Pré-produção & produção', owner: 'produto', deliverable: 'Lote piloto + produto embalado', gate: 'Qualidade estável e estoque ok?' },
  { n: 8, name: 'Go-to-market & lançamento', owner: 'marketing', deliverable: 'Kit de lançamento + produto nos canais', gate: 'Lançamento executado' },
  { n: 9, name: 'Pós-lançamento & melhoria', owner: 'compartilhado', deliverable: 'Relatório + backlog de melhorias', gate: 'Repor / evoluir / descontinuar' },
];

export type ProductDevStatus = 'ativo' | 'pausado' | 'concluido' | 'descontinuado' | 'cancelado';
export const PRODUCT_DEV_STATUSES: { key: ProductDevStatus; label: string }[] = [
  { key: 'ativo', label: 'Ativo' },
  { key: 'pausado', label: 'Pausado' },
  { key: 'concluido', label: 'Concluído' },
  { key: 'descontinuado', label: 'Descontinuado' },
  { key: 'cancelado', label: 'Cancelado' },
];

export type CertificationStatus = 'nao_iniciado' | 'em_ensaio' | 'aprovado' | 'reprovado';
export const CERTIFICATION_STATUSES: { key: CertificationStatus; label: string }[] = [
  { key: 'nao_iniciado', label: 'Não iniciado' },
  { key: 'em_ensaio', label: 'Em ensaio' },
  { key: 'aprovado', label: 'Aprovado' },
  { key: 'reprovado', label: 'Reprovado' },
];

// Materiais comuns em injeção plástica de brinquedo
export const PRODUCT_DEV_MATERIALS = ['ABS', 'PP', 'PE', 'PS', 'Outro'] as const;

export interface ProductDevItem {
  id: string;
  brand_id: string;
  product_id: string | null;
  name: string;
  concept: string;
  age_range: string;
  material: string;
  target_price: number | null;
  target_volume: number | null;
  tooling_investment: number | null;
  licensed: boolean;
  license_notes: string;
  current_phase: number;
  status: ProductDevStatus;
  certification_status: CertificationStatus;
  certification_number: string;
  certification_expiry: string | null;
  requires_anatel: boolean;
  launch_target_date: string | null;
  priority: Priority;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type GateDecision = 'pendente' | 'aprovado' | 'ajustar' | 'reprovado';
export const GATE_DECISIONS: { key: GateDecision; label: string }[] = [
  { key: 'pendente', label: 'Pendente' },
  { key: 'aprovado', label: 'Aprovado (go)' },
  { key: 'ajustar', label: 'Ajustar' },
  { key: 'reprovado', label: 'Reprovado (no-go)' },
];

export interface ProductDevGate {
  id: string;
  item_id: string;
  phase: number;
  decision: GateDecision;
  approver_id: string | null;
  decided_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type ProductDevTrack = 'produto' | 'marketing' | 'embalagem';
export const PRODUCT_DEV_TRACKS: { key: ProductDevTrack; label: string }[] = [
  { key: 'produto', label: 'Produto / Eng.' },
  { key: 'marketing', label: 'Marketing / GTM' },
  { key: 'embalagem', label: 'Embalagem' },
];

export interface ProductDevTask {
  id: string;
  item_id: string;
  phase: number;
  track: ProductDevTrack;
  title: string;
  done: boolean;
  assignee_id: string | null;
  due_date: string | null;
  notes: string;
  position: number;
  created_by: string | null;
  created_at: string;
}

export type PackagingKind = 'primaria' | 'secundaria' | 'terciaria';
export const PACKAGING_KINDS: { key: PackagingKind; label: string; hint: string }[] = [
  { key: 'primaria', label: 'Primária', hint: 'Contato direto: blister, caixa, saco' },
  { key: 'secundaria', label: 'Secundária', hint: 'Display/expositora, caixa master' },
  { key: 'terciaria', label: 'Terciária', hint: 'Transporte, paletização' },
];

export type PackagingArtStatus = 'nao_iniciada' | 'em_producao' | 'em_aprovacao' | 'aprovada';
export const PACKAGING_ART_STATUSES: { key: PackagingArtStatus; label: string }[] = [
  { key: 'nao_iniciada', label: 'Não iniciada' },
  { key: 'em_producao', label: 'Em produção' },
  { key: 'em_aprovacao', label: 'Em aprovação' },
  { key: 'aprovada', label: 'Aprovada' },
];

// Rotulagem é BLOQUEANTE para o lançamento (Fase 8)
export type PackagingLabelingStatus = 'pendente' | 'em_producao' | 'validada';
export const PACKAGING_LABELING_STATUSES: { key: PackagingLabelingStatus; label: string }[] = [
  { key: 'pendente', label: 'Pendente' },
  { key: 'em_producao', label: 'Em produção' },
  { key: 'validada', label: 'Validada' },
];

export type PackagingTestStatus = 'nao_testado' | 'reprovado' | 'aprovado';
export const PACKAGING_TEST_STATUSES: { key: PackagingTestStatus; label: string }[] = [
  { key: 'nao_testado', label: 'Não testado' },
  { key: 'reprovado', label: 'Reprovado' },
  { key: 'aprovado', label: 'Aprovado' },
];

export interface ProductDevPackaging {
  id: string;
  item_id: string;
  kind: PackagingKind;
  pack_type: string;
  dimensions: string;
  material: string;
  art_status: PackagingArtStatus;
  labeling_status: PackagingLabelingStatus;
  supplier: string;
  unit_cost: number | null;
  protection_test_status: PackagingTestStatus;
  guide_url: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ProductDevRisk {
  id: string;
  item_id: string;
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

export interface ProductDevDecision {
  id: string;
  item_id: string;
  context: string;
  alternatives: string;
  choice: string;
  impact: string;
  stakeholders: string;
  decided_at: string;
  created_by: string | null;
  created_at: string;
}

export type ProductDevDocKind = 'prd' | 'cad' | 'laudo' | 'guia' | 'outro';
export const PRODUCT_DEV_DOC_KINDS: { key: ProductDevDocKind; label: string }[] = [
  { key: 'prd', label: 'PRD / Requisitos' },
  { key: 'cad', label: 'CAD / 3D' },
  { key: 'laudo', label: 'Laudo de laboratório' },
  { key: 'guia', label: 'Guia de embalagem' },
  { key: 'outro', label: 'Outro' },
];

export interface ProductDevDocument {
  id: string;
  item_id: string;
  kind: ProductDevDocKind;
  name: string;
  url: string;
  added_by: string | null;
  created_at: string;
}

// ============================================================
// Módulo Monday — arquivo completo importado do Monday.com
// ============================================================
export interface MondayColumnValue {
  id: string;
  title: string;
  type: string;
  text: string;
  url?: string;
}
export interface MondayBoard {
  id: string;
  monday_id: string;
  name: string;
  state: string;
  groups: { id: string; title: string; position?: number }[];
  columns: { id: string; title: string; type: string }[];
  item_count: number;
  update_count: number;
  activity_count: number;
  suggested_destination: string;
  imported_at: string;
}
export interface MondayItem {
  id: string;
  board_id: string;
  monday_id: string;
  name: string;
  group_id: string;
  group_title: string;
  creator_name: string;
  monday_created_at: string | null;
  column_values: MondayColumnValue[];
  subitems: { name: string; status: string }[];
  position: number;
}
export interface MondayReply {
  author_name: string;
  body: string;
  created_at: string | null;
}
export interface MondayUpdate {
  id: string;
  item_id: string;
  author_name: string;
  body: string;
  monday_created_at: string | null;
  replies: MondayReply[];
}
export interface MondayActivity {
  id: string;
  board_id: string;
  item_id: string | null;
  event: string;
  action_text: string;
  actor_name: string;
  monday_created_at: string | null;
}
