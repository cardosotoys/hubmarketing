// Ícones do menu padronizados por nome semântico → glifo (sem dependência externa, build leve).
const MAP: Record<string, string> = {
  dashboard: '▣',
  painel: '▣',
  calendar: '▦',
  reports: '▥',
  demandas: '☰',
  operacao: '☰',
  projetos: '◧',
  aprovacoes: '✓',
  auditoria: '◷',
  monitor: '⌁',
  pesquisa: '◍',
  concorrentes: '⊚',
  relatorioDiario: '✎',
  ia: '✦',
  inteligencia: '⌁',
  redes: '◎',
  campanhas: '◆',
  marketing: '◆',
  brand: '◈',
  produtos: '◫',
  design: '◭',
  embalagens: '▤',
  certificacoes: '🏅',
  drive: '▤',
  biblioteca: '▤',
  fotos: '▦',
  videos: '►',
  templates: '▧',
  documentos: '▢',
  monday: '◱',
  arquivos: '◱',
  configuracoes: '⚙',
  administracao: '⚙',
  perfil: '◉',
  usuarios: '◕',
  permissoes: '⛊',
};

export default function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <span style={{ fontSize: size - 2, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {MAP[name] ?? '•'}
    </span>
  );
}
