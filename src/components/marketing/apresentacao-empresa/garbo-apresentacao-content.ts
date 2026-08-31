/** Conteúdo estático da apresentação Garbo Movelaria (v1). */

export const GARBO_APRESENTACAO_PUBLIC_PATH = '/apresentacao/garbo';

/** Cadastro de prestador vinculado ao Pontua Garbo (empresa Garbo). */
export const GARBO_APRESENTACAO_EMPRESA_ID = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd';
export const GARBO_APRESENTACAO_SCHEMA = 'emp_garbo';

export const GARBO_APRESENTACAO_CTA_URL =
  `/cadastro/prestador?e=${GARBO_APRESENTACAO_EMPRESA_ID}&s=${GARBO_APRESENTACAO_SCHEMA}`;

export const GARBO_APRESENTACAO_IMAGES = {
  hero: '/imagens/apresentacao-garbo/hero-painel-logo.jpg',
  proposta: '/imagens/apresentacao-garbo/proposta-banco.jpg',
  fechamento: '/imagens/apresentacao-garbo/fechamento-painel-logo.jpg',
} as const;

export type GarboApresentacaoSectionId =
  | 'hero'
  | 'origem'
  | 'proposta'
  | 'prova-social'
  | 'fechamento'
  | 'projetos'
  | 'instagram'
  | 'projetos-fim';

export type GarboPontuaSectionId = 'pontua-garbo' | 'pontua-passos' | 'pontua-painel';

export interface GarboApresentacaoNavItem {
  id: string;
  label: string;
}

export const GARBO_APRESENTACAO_NAV: GarboApresentacaoNavItem[] = [
  { id: 'hero', label: 'Início' },
  { id: 'origem', label: 'A Origem' },
  { id: 'proposta', label: 'A Proposta' },
  { id: 'prova-social', label: 'Prova Social' },
  { id: 'fechamento', label: 'Fechamento' },
  { id: 'projetos', label: 'Projetos' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'projetos-fim', label: 'Encerramento' },
];

/** Navegação da página só do Programa Pontua Garbo (leads / parceiros). */
export const GARBO_PONTUA_NAV: GarboApresentacaoNavItem[] = [
  { id: 'pontua-garbo', label: 'Pontua Garbo' },
  { id: 'pontua-passos', label: 'Como funciona' },
  { id: 'pontua-painel', label: 'Painel' },
];

/** Apresentação completa + Programa Pontua Garbo. */
export const GARBO_APRESENTACAO_NAV_COM_PONTUA: GarboApresentacaoNavItem[] = [
  ...GARBO_APRESENTACAO_NAV,
  ...GARBO_PONTUA_NAV,
];

export const GARBO_PONTUA_INTERNAL_PATH = '/marketing/pontua-garbo';

/** Mídia vertical (celular 1080×1920) da galeria de projetos e obras. */
export type GarboProjetoMediaType = 'image' | 'video';

export interface GarboProjetoMediaItem {
  id: string;
  type: GarboProjetoMediaType;
  /** Caminho público da foto ou do vídeo */
  src: string;
  /** Poster do vídeo (opcional) */
  poster?: string;
  title: string;
  caption: string;
}

/** Destaques do cubo 3D — face fechada vira e revela a obra. */
export const GARBO_APRESENTACAO_CUBO_DESTAQUES = [
  {
    id: 'cubo-cristaleira',
    src: '/imagens/apresentacao-garbo/projetos/cubo-cristaleira.png',
    title: 'Cristaleira iluminada',
    caption: 'Vitrine floor-to-ceiling com LED e organização impecável.',
  },
  {
    id: 'cubo-sala-integrada',
    src: '/imagens/apresentacao-garbo/projetos/cubo-sala-integrada.png',
    title: 'Sala e cozinha integradas',
    caption: 'Ambiente aberto com marcenaria sob medida e iluminação quente.',
  },
  {
    id: 'cubo-painel-madeira',
    src: '/imagens/apresentacao-garbo/projetos/cubo-painel-madeira.png',
    title: 'Painel em continuidade',
    caption: 'Madeira do piso à parede — volume único e acabamento preciso.',
  },
  {
    id: 'cubo-suite-trofeus',
    src: '/imagens/apresentacao-garbo/projetos/cubo-suite-trofeus.png',
    title: 'Suíte com nichos iluminados',
    caption: 'Ripado, LED em V e prateleiras que valorizam cada detalhe.',
  },
  {
    id: 'cubo-suite-tv',
    src: '/imagens/apresentacao-garbo/projetos/cubo-suite-tv.png',
    title: 'Suíte com painel e espelho',
    caption: 'TV embutida, espelho orgânico retroiluminado e console flutuante.',
  },
] as const;

export type GarboCuboDestaqueItem = (typeof GARBO_APRESENTACAO_CUBO_DESTAQUES)[number];

export const GARBO_APRESENTACAO_PROJETOS = {
  eyebrow: 'PROJETOS & OBRAS',
  title: 'A Garbo em cada detalhe',
  subtitle:
    'Ambientes executados com precisão — madeira, luz e acabamento no formato da obra real.',
  hint: 'Deslize o carrossel',
  items: [
    {
      id: 'suite-painel-ripado',
      type: 'image',
      src: '/imagens/apresentacao-garbo/projetos/suite-painel-ripado.png',
      title: 'Suíte com painel e espelho',
      caption: 'TV embutida, espelho orgânico retroiluminado e console flutuante em madeira.',
    },
    {
      id: 'cozinha-cristaleira',
      type: 'image',
      src: '/imagens/apresentacao-garbo/projetos/cozinha-cristaleira.png',
      title: 'Cristaleira iluminada',
      caption: 'Vitrine floor-to-ceiling com LED integrado e organização impecável.',
    },
    {
      id: 'sala-cozinha-integrada',
      type: 'image',
      src: '/imagens/apresentacao-garbo/projetos/sala-cozinha-integrada.png',
      title: 'Sala e cozinha integradas',
      caption: 'Ambiente aberto com sofá, marcenaria sob medida e ilha iluminada.',
    },
    {
      id: 'suite-nichos-led',
      type: 'image',
      src: '/imagens/apresentacao-garbo/projetos/cubo-suite-trofeus.png',
      title: 'Suíte com nichos iluminados',
      caption: 'Ripado, LED em V e prateleiras que valorizam cada detalhe.',
    },
    {
      id: 'painel-madeira-continuidade',
      type: 'image',
      src: '/imagens/apresentacao-garbo/projetos/painel-madeira-continuidade.png',
      title: 'Painel em continuidade',
      caption: 'Madeira do piso à parede — volume único, luz quente e acabamento preciso.',
    },
  ] satisfies GarboProjetoMediaItem[],
};

export interface GarboApresentacaoContentSection {
  id: GarboApresentacaoSectionId;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  highlight?: string;
}

export const GARBO_APRESENTACAO_SECTIONS: GarboApresentacaoContentSection[] = [
  {
    id: 'origem',
    eyebrow: 'A ORIGEM',
    title: 'Fábio Faria e o motivo da Garbo existir',
    paragraphs: [
      'Fábio Faria cresceu dentro de uma oficina. Desde cedo, aprendeu que madeira não mente — ela revela tudo: o capricho de quem a trabalhou, a atenção ao detalhe, o respeito pelo projeto.',
      'O que ele viu no mercado ao longo dos anos foi diferente. Marcenarias que prometem muito e entregam pouco. Profissionais que tratam o projeto do arquiteto como sugestão, não como lei. Clientes insatisfeitos. Reputações arranhadas.',
      'Foi por recusa — recusa em fazer parte disso — que a Garbo nasceu.',
    ],
    highlight: 'Não como mais uma marcenaria. Como uma resposta.',
  },
  {
    id: 'proposta',
    eyebrow: 'A PROPOSTA',
    title: 'O que a Garbo resolve',
    paragraphs: [
      'A Garbo foi construída com um princípio único: o projeto do arquiteto é sagrado.',
      'Cada medida, cada detalhe, cada escolha de ferragem — executados com precisão cirúrgica. Com materiais de primeira, com processos que eliminam surpresas, com comunicação que você consegue acompanhar do começo ao fim.',
    ],
    highlight: 'Aqui, você não precisa ser o intermediário entre o seu cliente e o executor. Você é o autor. Nós somos o instrumento.',
  },
  {
    id: 'prova-social',
    eyebrow: 'PROVA SOCIAL',
    title: 'O que nossos parceiros dizem',
    paragraphs: [
      'Arquitetos que trabalham conosco uma vez raramente buscam outro fornecedor. Não porque a gente prende ninguém — mas porque eles não querem mais correr o risco de trabalhar sem uma parceria assim.',
    ],
    highlight: 'A reputação do seu escritório é construída em cada entrega. A nossa também.',
  },
];

export const GARBO_APRESENTACAO_FECHAMENTO = {
  eyebrow: 'FECHAMENTO',
  title: 'Uma parceria, não um orçamento',
  paragraphs: [
    'A Garbo não escala no volume. Escala na qualidade.',
    'Trabalhamos com um número limitado de projetos por vez — porque é a única forma de garantir que cada um receba a atenção que merece.',
    'Se você chegou até aqui, já entendeu que o que oferecemos não é um orçamento. É uma parceria.',
  ],
  closing:
    'A pergunta não é se você pode trabalhar com a Garbo. É se você pode continuar entregando seus projetos sem ela.',
  ctaLabel: 'Iniciar parceria',
  ctaHint: 'A Garbo irá entrar em contato com você.',
};

/** Contato + feed real do Instagram (embed oficial ampliado). */
export const GARBO_APRESENTACAO_INSTAGRAM = {
  eyebrow: 'INSTAGRAM',
  title: 'Entre no feed da oficina',
  subtitle:
    'Obras, detalhes e o dia a dia da Garbo — o feed oficial, completo e ao vivo.',
  handle: '@garbomovelaria',
  profileUrl: 'https://www.instagram.com/garbomovelaria/',
  /** Embed oficial do perfil público — atualiza sozinho com posts novos */
  embedUrl: 'https://www.instagram.com/garbomovelaria/embed/',
  profileCta: 'Abrir Instagram',
  phoneDisplay: '(35) 99140-1611',
  phoneTel: '+5535991401611',
  phoneWhatsApp: 'https://wa.me/5535991401611',
  phoneLabel: 'Falar agora',
};
