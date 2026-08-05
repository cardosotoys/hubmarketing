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
}

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Visão geral',
    items: [
      { to: '/', label: 'Dashboard', icon: '▣', end: true, moduleKey: 'dashboard' },
      { to: '/relatorios', label: 'Relatórios', icon: '▥', hideFor: ['design', 'assistente'], moduleKey: 'relatorios' },
    ],
  },
  {
    label: 'Trabalho',
    items: [
      { to: '/projetos', label: 'Projetos', icon: '◧', moduleKey: 'projetos' },
      { to: '/demandas', label: 'Demandas', icon: '☰', moduleKey: 'demandas' },
      { to: '/calendario', label: 'Calendário', icon: '▦', moduleKey: 'calendario' },
    ],
  },
  {
    label: 'Marca & conteúdo',
    items: [
      {
        to: '/redes-sociais',
        label: 'Redes Sociais',
        icon: '◎',
        defaultRoles: ['diretoria', 'administrador'],
        moduleKey: 'redes-sociais',
      },
      { to: '/biblioteca', label: 'Biblioteca', icon: '▤', moduleKey: 'biblioteca' },
      { to: '/produtos', label: 'Produtos', icon: '◫', moduleKey: 'produtos' },
      { to: '/monitor-precos', label: 'Monitor de Preços', icon: '⌁', hideFor: ['design', 'assistente'], moduleKey: 'monitor-precos' },
      { to: '/brand', label: 'Brand', icon: '◈', moduleKey: 'brand' },
    ],
  },
  {
    label: 'Campanhas',
    items: [
      { to: '/campanhas', label: 'Campanhas', icon: '◆', moduleKey: 'campanhas' },
      { to: '/ia', label: 'IA', icon: '✦', moduleKey: 'ia' },
    ],
  },
  {
    label: 'Design de Produtos',
    items: [
      { to: '/design-produto', label: 'Design de Produto', icon: '◭', hideFor: ['assistente'], moduleKey: 'design-produto' },
      { to: '/design-produto/embalagens', label: 'Embalagens', icon: '▤', hideFor: ['assistente'], moduleKey: 'embalagens' },
    ],
  },
  {
    label: 'Registro',
    items: [
      { to: '/relatorio-diario', label: 'Relatório Diário', icon: '✎', moduleKey: 'relatorio-diario' },
      { to: '/auditoria', label: 'Auditoria', icon: '◷', moduleKey: 'auditoria' },
      { to: '/monday', label: 'Monday (arquivo)', icon: '◱', hideFor: ['assistente'], moduleKey: 'monday' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/configuracoes', label: 'Configurações', icon: '⚙', requiresConfig: true, moduleKey: 'configuracoes' },
      { to: '/perfil', label: 'Perfil', icon: '◉', moduleKey: 'perfil' },
    ],
  },
];

export interface NavVisibilityContext {
  role: Role;
  department: Department;
  // profiles.hidden_modules/extra_modules são text[] no banco (Profile os tipa como string[]),
  // não ModuleKey[] — mantém o mesmo tipo pra aceitar o valor real vindo de useAuth() sem forçar
  // um cast em quem chama.
  hiddenModules: string[];
  extraModules: string[];
}

// Regra única de visibilidade de item de menu — consumida pelo Sidebar (desktop) e pela
// MobileTabBar/folha "Mais" (celular), pra nunca ter duas cópias da mesma regra de permissão.
export function isNavItemVisible(item: NavItem, ctx: NavVisibilityContext): boolean {
  if (ctx.hiddenModules.includes(item.moduleKey)) return false;
  if (ctx.extraModules.includes(item.moduleKey)) return true;
  if (item.defaultRoles && !item.defaultRoles.includes(ctx.role)) return false;
  if (item.hideFor?.includes(ctx.department)) return false;
  return true;
}

export function getVisibleNavItems(ctx: NavVisibilityContext): NavItem[] {
  return NAV_SECTIONS.flatMap((s) => s.items).filter((item) => isNavItemVisible(item, ctx));
}
