import type { Department, ModuleKey, Role } from '../types/database';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  moduleKey: ModuleKey;
  hideFor?: Department[];
  defaultRoles?: Role[];
  requiresConfig?: boolean;
  // opt-in: some pra todo mundo por padrão; só aparece pra quem for "Liberado" em Perfis &
  // Permissões (Diretoria/Administrador continuam vendo, pois é quem configura/gerencia).
  hiddenByDefault?: boolean;
}

// Um "módulo" agrupa páginas relacionadas dentro de um grupo do menu (colapsável na sidebar).
export interface NavModule {
  key: string;
  label: string;
  icon: string;
  items: NavItem[];
}

// Um "grupo" é a seção com título maiúsculo (GERAL, GESTÃO, NEGÓCIOS, RECURSOS, SISTEMA).
export interface NavGroup {
  title: string;
  modules: NavModule[];
}

// Estrutura por MÓDULOS (não por páginas). Grupo → Módulo → páginas.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'GERAL',
    modules: [
      {
        key: 'painel',
        label: 'Painel',
        icon: 'painel',
        items: [
          { to: '/', label: 'Dashboard', icon: 'dashboard', end: true, moduleKey: 'dashboard' },
          { to: '/calendario', label: 'Calendário', icon: 'calendar', moduleKey: 'calendario' },
          { to: '/relatorios', label: 'Relatórios', icon: 'reports', hideFor: ['design', 'assistente'], moduleKey: 'relatorios' },
        ],
      },
    ],
  },
  {
    title: 'GESTÃO',
    modules: [
      {
        key: 'operacao',
        label: 'Operação',
        icon: 'operacao',
        items: [
          { to: '/demandas', label: 'Demandas', icon: 'demandas', moduleKey: 'demandas' },
          { to: '/projetos', label: 'Projetos', icon: 'projetos', moduleKey: 'projetos' },
          { to: '/aprovacoes', label: 'Aprovações', icon: 'aprovacoes', moduleKey: 'aprovacoes' },
          { to: '/auditoria', label: 'Auditoria', icon: 'auditoria', moduleKey: 'auditoria' },
        ],
      },
    ],
  },
  {
    title: 'NEGÓCIOS',
    modules: [
      {
        key: 'inteligencia',
        label: 'Inteligência',
        icon: 'inteligencia',
        items: [
          { to: '/monitor-precos', label: 'Monitor de Preços', icon: 'monitor', hideFor: ['design', 'assistente'], moduleKey: 'monitor-precos' },
          { to: '/pesquisa-mercado', label: 'Pesquisa de Mercado', icon: 'pesquisa', moduleKey: 'pesquisa-mercado' },
          { to: '/concorrentes', label: 'Concorrentes', icon: 'concorrentes', moduleKey: 'concorrentes' },
          { to: '/relatorio-diario', label: 'Relatório Diário', icon: 'relatorioDiario', moduleKey: 'relatorio-diario' },
          { to: '/ia', label: 'IA', icon: 'ia', moduleKey: 'ia' },
        ],
      },
      {
        key: 'marketing',
        label: 'Marketing',
        icon: 'marketing',
        items: [
          { to: '/redes-sociais', label: 'Redes Sociais', icon: 'redes', defaultRoles: ['diretoria', 'administrador'], moduleKey: 'redes-sociais' },
          { to: '/campanhas', label: 'Campanhas', icon: 'campanhas', moduleKey: 'campanhas' },
          { to: '/marcas', label: 'Marcas', icon: 'brand', moduleKey: 'marcas' },
          { to: '/brand', label: 'Brand Center', icon: 'design', moduleKey: 'brand' },
        ],
      },
      {
        key: 'produtos',
        label: 'Produtos',
        icon: 'produtos',
        items: [
          { to: '/produtos', label: 'Produtos', icon: 'produtos', moduleKey: 'produtos' },
          { to: '/design-produto', label: 'Design', icon: 'design', hideFor: ['assistente'], moduleKey: 'design-produto' },
          { to: '/design-produto/embalagens', label: 'Embalagens', icon: 'embalagens', hideFor: ['assistente'], moduleKey: 'embalagens', hiddenByDefault: true },
          { to: '/certificacoes', label: 'Certificações', icon: 'certificacoes', moduleKey: 'certificacoes' },
        ],
      },
    ],
  },
  {
    title: 'RECURSOS',
    modules: [
      {
        key: 'biblioteca',
        label: 'Biblioteca',
        icon: 'biblioteca',
        items: [
          { to: '/biblioteca', label: 'Drive', icon: 'drive', moduleKey: 'biblioteca' },
          { to: '/recursos/fotos', label: 'Fotos', icon: 'fotos', moduleKey: 'fotos' },
          { to: '/recursos/videos', label: 'Vídeos', icon: 'videos', moduleKey: 'videos' },
        ],
      },
      {
        key: 'arquivos',
        label: 'Arquivos',
        icon: 'arquivos',
        items: [
          { to: '/recursos/templates', label: 'Templates', icon: 'templates', moduleKey: 'templates' },
          { to: '/recursos/documentos', label: 'Documentos', icon: 'documentos', moduleKey: 'documentos' },
          { to: '/monday', label: 'Monday (arquivo)', icon: 'monday', hideFor: ['assistente'], moduleKey: 'monday' },
        ],
      },
    ],
  },
  {
    title: 'SISTEMA',
    modules: [
      {
        key: 'administracao',
        label: 'Administração',
        icon: 'administracao',
        items: [
          { to: '/configuracoes', label: 'Configurações', icon: 'configuracoes', requiresConfig: true, moduleKey: 'configuracoes' },
          { to: '/perfil', label: 'Perfil', icon: 'perfil', moduleKey: 'perfil' },
          { to: '/usuarios', label: 'Usuários', icon: 'usuarios', defaultRoles: ['diretoria', 'administrador'], moduleKey: 'usuarios' },
          { to: '/permissoes', label: 'Permissões', icon: 'permissoes', defaultRoles: ['diretoria', 'administrador'], moduleKey: 'permissoes' },
        ],
      },
    ],
  },
];

export interface NavVisibilityContext {
  role: Role;
  department: Department;
  hiddenModules: string[];
  extraModules: string[];
}

// Regra única de visibilidade de item de menu — consumida pela Sidebar (desktop) e pela
// MobileTabBar/folha "Mais" (celular), pra nunca ter duas cópias da mesma regra de permissão.
export function isNavItemVisible(item: NavItem, ctx: NavVisibilityContext): boolean {
  if (ctx.hiddenModules.includes(item.moduleKey)) return false;
  if (ctx.extraModules.includes(item.moduleKey)) return true;
  // opt-in: oculto por padrão, exceto Diretoria/Administrador (que gerenciam quem libera)
  if (item.hiddenByDefault && ctx.role !== 'diretoria' && ctx.role !== 'administrador') return false;
  if (item.defaultRoles && !item.defaultRoles.includes(ctx.role)) return false;
  if (item.hideFor?.includes(ctx.department)) return false;
  return true;
}

// ModuleGate usa isto pra bloquear por URL um módulo opt-in que a pessoa não tem liberado
// (sem afetar os demais módulos, que seguem só com a checagem de hidden_modules).
export function isModuleOptInLocked(moduleKey: string, ctx: NavVisibilityContext): boolean {
  const optIn = NAV_GROUPS.flatMap((g) => g.modules)
    .flatMap((m) => m.items)
    .some((i) => i.moduleKey === moduleKey && i.hiddenByDefault);
  if (!optIn) return false;
  if (ctx.extraModules.includes(moduleKey)) return false;
  if (ctx.role === 'diretoria' || ctx.role === 'administrador') return false;
  return true;
}

// Lista plana de todos os itens visíveis — usada pela barra inferior do celular.
export function getVisibleNavItems(ctx: NavVisibilityContext): NavItem[] {
  return NAV_GROUPS.flatMap((g) => g.modules)
    .flatMap((m) => m.items)
    .filter((item) => isNavItemVisible(item, ctx));
}
