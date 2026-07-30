const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/projetos': 'Projetos',
  '/demandas': 'Demandas',
  '/calendario': 'Calendário',
  '/redes-sociais': 'Redes Sociais',
  '/biblioteca': 'Biblioteca',
  '/produtos': 'Produtos',
  '/campanhas': 'Campanhas',
  '/ia': 'IA',
  '/relatorios': 'Relatórios',
  '/relatorio-diario': 'Relatório Diário',
  '/brand': 'Brand',
  '/configuracoes': 'Configurações',
  '/auditoria': 'Auditoria',
  '/perfil': 'Perfil',
};

// Título de página por rota — usado pelo Topbar (desktop) e pelo MobileTopBar (celular), pra
// não ter duas cópias do mesmo mapeamento.
export function breadcrumbFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/projetos/')) return 'Projetos';
  if (pathname.startsWith('/campanhas/')) return 'Campanhas';
  return '';
}
