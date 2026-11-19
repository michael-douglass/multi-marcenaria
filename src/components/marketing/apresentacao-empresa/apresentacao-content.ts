/** Estrutura da apresentação (navegação, tipos) e fotos de exemplo do padrão neutro. */

/** Schema compartilhado do CRM (multi-empresa por empresa_id). */
export const APRESENTACAO_SCHEMA = 'crm';

export const APRESENTACAO_IMAGES = {
  hero: '/imagens/apresentacao/projetos/suite-painel-ripado.png',
  proposta: '/imagens/apresentacao/proposta-banco.jpg',
  fechamento: '/imagens/apresentacao/projetos/painel-madeira-continuidade.png',
} as const;

export type ApresentacaoSectionId =
  | 'hero'
  | 'origem'
  | 'proposta'
  | 'prova-social'
  | 'fechamento'
  | 'projetos'
  | 'instagram'
  | 'projetos-fim';

export type PontuaSectionId = 'pontua' | 'pontua-passos' | 'pontua-painel';

export interface ApresentacaoNavItem {
  id: string;
  label: string;
}

export const APRESENTACAO_NAV: ApresentacaoNavItem[] = [
  { id: 'hero', label: 'Início' },
  { id: 'origem', label: 'A Origem' },
  { id: 'proposta', label: 'A Proposta' },
  { id: 'prova-social', label: 'Prova Social' },
  { id: 'fechamento', label: 'Fechamento' },
  { id: 'projetos', label: 'Projetos' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'projetos-fim', label: 'Encerramento' },
];

/** Navegação da página só do programa de pontuação (Pontua). */
export const PONTUA_NAV: ApresentacaoNavItem[] = [
  { id: 'pontua', label: 'Pontua' },
  { id: 'pontua-passos', label: 'Como funciona' },
  { id: 'pontua-painel', label: 'Painel' },
];

/** Apresentação completa + programa de pontuação. */
export const APRESENTACAO_NAV_COM_PONTUA: ApresentacaoNavItem[] = [
  ...APRESENTACAO_NAV,
  ...PONTUA_NAV,
];

/** Mídia vertical (celular 1080×1920) da galeria de projetos e obras. */
export type ProjetoMediaType = 'image' | 'video';

export interface ProjetoMediaItem {
  id: string;
  type: ProjetoMediaType;
  /** Caminho público da foto ou do vídeo */
  src: string;
  /** Poster do vídeo (opcional) */
  poster?: string;
  title: string;
  caption: string;
}

/** Destaques do cubo 3D — face fechada vira e revela a obra. */
export const APRESENTACAO_CUBO_DESTAQUES = [
  {
    id: 'cubo-cristaleira',
    src: '/imagens/apresentacao/projetos/cubo-cristaleira.png',
    title: 'Cristaleira iluminada',
    caption: 'Vitrine floor-to-ceiling com LED e organização impecável.',
  },
  {
    id: 'cubo-sala-integrada',
    src: '/imagens/apresentacao/projetos/cubo-sala-integrada.png',
    title: 'Sala e cozinha integradas',
    caption: 'Ambiente aberto com marcenaria sob medida e iluminação quente.',
  },
  {
    id: 'cubo-painel-madeira',
    src: '/imagens/apresentacao/projetos/cubo-painel-madeira.png',
    title: 'Painel em continuidade',
    caption: 'Madeira do piso à parede — volume único e acabamento preciso.',
  },
  {
    id: 'cubo-suite-trofeus',
    src: '/imagens/apresentacao/projetos/cubo-suite-trofeus.png',
    title: 'Suíte com nichos iluminados',
    caption: 'Ripado, LED em V e prateleiras que valorizam cada detalhe.',
  },
  {
    id: 'cubo-suite-tv',
    src: '/imagens/apresentacao/projetos/cubo-suite-tv.png',
    title: 'Suíte com painel e espelho',
    caption: 'TV embutida, espelho orgânico retroiluminado e console flutuante.',
  },
] as const;

export type CuboDestaqueItem = (typeof APRESENTACAO_CUBO_DESTAQUES)[number];

export const APRESENTACAO_PROJETOS = {
  eyebrow: 'PROJETOS & OBRAS',
  title: 'A {empresa} em cada detalhe',
  subtitle:
    'Ambientes executados com precisão — madeira, luz e acabamento no formato da obra real.',
  hint: 'Deslize o carrossel',
  items: [
    {
      id: 'suite-painel-ripado',
      type: 'image',
      src: '/imagens/apresentacao/projetos/suite-painel-ripado.png',
      title: 'Suíte com painel e espelho',
      caption: 'TV embutida, espelho orgânico retroiluminado e console flutuante em madeira.',
    },
    {
      id: 'cozinha-cristaleira',
      type: 'image',
      src: '/imagens/apresentacao/projetos/cozinha-cristaleira.png',
      title: 'Cristaleira iluminada',
      caption: 'Vitrine floor-to-ceiling com LED integrado e organização impecável.',
    },
    {
      id: 'sala-cozinha-integrada',
      type: 'image',
      src: '/imagens/apresentacao/projetos/sala-cozinha-integrada.png',
      title: 'Sala e cozinha integradas',
      caption: 'Ambiente aberto com sofá, marcenaria sob medida e ilha iluminada.',
    },
    {
      id: 'suite-nichos-led',
      type: 'image',
      src: '/imagens/apresentacao/projetos/cubo-suite-trofeus.png',
      title: 'Suíte com nichos iluminados',
      caption: 'Ripado, LED em V e prateleiras que valorizam cada detalhe.',
    },
    {
      id: 'painel-madeira-continuidade',
      type: 'image',
      src: '/imagens/apresentacao/projetos/painel-madeira-continuidade.png',
      title: 'Painel em continuidade',
      caption: 'Madeira do piso à parede — volume único, luz quente e acabamento preciso.',
    },
  ] satisfies ProjetoMediaItem[],
};
