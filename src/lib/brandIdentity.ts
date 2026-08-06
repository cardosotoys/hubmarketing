// Template do planejamento de identidade visual (mesmo pra todas as marcas). É um MODELO em código —
// o status/observação de cada tópico por marca vive em public.brand_identity_status (esparso).
// Editar as seções/tópicos aqui reflete na tela sem migração.

export interface BrandIdentitySection {
  key: string; // estável, usado pra casar o status no banco
  title: string;
  topics: string[];
}

export const BRAND_IDENTITY: BrandIdentitySection[] = [
  {
    key: 'diagnostico',
    title: '1. Diagnóstico e Estratégia da Marca',
    topics: [
      'Pesquisa de mercado',
      'Benchmark de concorrentes',
      'Análise SWOT',
      'Posicionamento da marca',
      'Arquétipo',
      'Personalidade',
      'Propósito',
      'Missão',
      'Visão',
      'Valores',
      'Manifesto',
      'Público-alvo (Persona)',
      'Tom de voz',
      'Diferenciais competitivos',
      'Proposta de Valor (UVP)',
      'Moodboard estratégico',
    ],
  },
  {
    key: 'naming',
    title: '2. Naming (quando necessário)',
    topics: ['Desenvolvimento do nome', 'Verificação de disponibilidade', 'Domínio', 'Redes sociais', 'Orientação para registro no INPI'],
  },
  {
    key: 'identidade-visual',
    title: '3. Identidade Visual',
    topics: [
      'Logotipo principal, secundário, horizontal, vertical, simplificado',
      'Símbolo',
      'Monograma',
      'Ícone',
      'Favicon',
      'Grid construtivo',
      'Área de proteção',
      'Redução mínima',
      'Variações de cor',
      'Usos corretos e incorretos',
    ],
  },
  {
    key: 'cores',
    title: '4. Sistema de Cores',
    topics: ['Paleta principal', 'Paleta de apoio', 'Especificações RGB, CMYK, Pantone, HEX e HSL'],
  },
  {
    key: 'tipografia',
    title: '5. Tipografia',
    topics: ['Fonte principal', 'Fonte secundária', 'Fontes de apoio', 'Hierarquia e espaçamentos'],
  },
  {
    key: 'elementos-graficos',
    title: '6. Elementos Gráficos',
    topics: ['Patterns', 'Texturas', 'Grafismos', 'Ícones', 'Ilustrações', 'Badges', 'Tags'],
  },
  {
    key: 'direcao-fotografica',
    title: '7. Direção Fotográfica',
    topics: ['Estilo fotográfico', 'Iluminação', 'Composição', 'Tratamento de imagem'],
  },
  {
    key: 'estilo-ilustracao',
    title: '8. Estilo de Ilustração',
    topics: ['Flat', 'Outline', '3D', 'Vetorial', 'Cartoon', 'Realista'],
  },
  {
    key: 'iconografia',
    title: '9. Iconografia',
    topics: ['Sistema de ícones', 'Grid', 'Espessura', 'Padronização'],
  },
  {
    key: 'universo-visual',
    title: '10. Universo Visual',
    topics: ['Shapes', 'Fundos', 'Texturas', 'Mockups', 'Elementos de apoio'],
  },
  {
    key: 'sistema-layout',
    title: '11. Sistema de Layout',
    topics: ['Grid', 'Margens', 'Hierarquia visual', 'Espaçamentos'],
  },
  {
    key: 'manual-comunicacao',
    title: '12. Manual de Comunicação',
    topics: ['Tom de voz', 'Vocabulário', 'Assinaturas', 'Palavras proibidas'],
  },
  {
    key: 'papelaria',
    title: '13. Papelaria Institucional',
    topics: ['Cartão', 'Papel timbrado', 'Envelope', 'Pasta', 'Assinatura de e-mail', 'Crachá'],
  },
  {
    key: 'materiais-comerciais',
    title: '14. Materiais Comerciais',
    topics: ['Apresentação institucional', 'Folder', 'Catálogo', 'Flyer', 'Templates'],
  },
  {
    key: 'redes-sociais',
    title: '15. Redes Sociais',
    topics: ['Templates de feed, stories, reels, capas, destaques e banners'],
  },
  {
    key: 'website-interface',
    title: '16. Website e Interface',
    topics: ['Botões', 'Cards', 'Ícones', 'Componentes UI', 'Landing pages'],
  },
  {
    key: 'embalagens',
    title: '17. Embalagens',
    topics: ['Rótulos', 'Caixas', 'Displays', 'Etiquetas'],
  },
  {
    key: 'comunicacao-fisica',
    title: '18. Comunicação Física',
    topics: ['Fachadas', 'Sinalização', 'Uniformes', 'Veículos', 'Brindes'],
  },
  {
    key: 'comunicacao-digital',
    title: '19. Comunicação Digital',
    topics: ['E-mail marketing', 'Newsletter', 'WhatsApp', 'Templates PDF'],
  },
  {
    key: 'motion-branding',
    title: '20. Motion Branding',
    topics: ['Animação do logo', 'Vinhetas', 'Transições', 'GIFs'],
  },
  {
    key: 'brand-assets',
    title: '21. Brand Assets',
    topics: ['Biblioteca de ícones', 'Imagens', 'Patterns', 'Templates editáveis'],
  },
  {
    key: 'brand-book',
    title: '22. Brand Book',
    topics: ['História', 'Conceito', 'Posicionamento', 'DNA', 'Regras de uso', 'Aplicações'],
  },
  {
    key: 'mockups',
    title: '23. Mockups',
    topics: ['Papelaria', 'Uniformes', 'Fachadas', 'Site', 'Embalagens', 'Redes sociais'],
  },
  {
    key: 'gestao-marca',
    title: '24. Gestão da Marca',
    topics: ['Guia rápido', 'Checklist', 'Biblioteca de arquivos', 'Controle de versões'],
  },
];

export type BrandIdentityStatus = 'pendente' | 'producao' | 'entregue' | 'aprovado' | 'na';

export const IDENTITY_STATUS: { key: BrandIdentityStatus; label: string; color: string }[] = [
  { key: 'pendente', label: 'Pendente', color: 'var(--text-faint)' },
  { key: 'producao', label: 'Em produção', color: 'var(--yellow)' },
  { key: 'entregue', label: 'Entregue', color: 'var(--blue)' },
  { key: 'aprovado', label: 'Aprovado', color: 'var(--green)' },
  { key: 'na', label: 'N/A', color: 'var(--text-faint)' },
];
