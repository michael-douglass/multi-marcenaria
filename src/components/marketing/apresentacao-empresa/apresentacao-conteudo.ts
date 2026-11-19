/**
 * Conteúdo editável da apresentação para arquitetos e do capítulo Pontua (por empresa).
 * Gravado em `crm.apresentacao_conteudo` (conteudo/pontua jsonb, só os campos alterados ou completos);
 * a tela mescla o que está salvo sobre o padrão. Ver docs/modelos-padrao/DESIGN.md §4.
 *
 * - `CONTEUDO_NEUTRO` / `PONTUA_NEUTRO`: padrão de empresa que ainda não editou nada (sem marca de
 *   cliente — ADR 0006). `{empresa}` vira o nome fantasia na hora de mostrar.
 */
import {
  APRESENTACAO_CUBO_DESTAQUES,
  APRESENTACAO_IMAGES,
  APRESENTACAO_PROJETOS,
  type ApresentacaoSectionId,
} from './apresentacao-content';
import {
  PONTUA_DEMO,
  type PontuaComissaoStatus,
  type PontuaSaqueStatus,
} from './pontua-demo-data';

export interface ApresentacaoSecao {
  id: ApresentacaoSectionId;
  eyebrow: string;
  title: string;
  paragraphs: string[];
  highlight?: string;
}

export interface ApresentacaoMidia {
  id: string;
  type: 'image' | 'video';
  src: string;
  poster?: string;
  title: string;
  caption: string;
}

export interface ApresentacaoConteudo {
  marca: {
    /** Linha pequena acima do título (ex.: nome da empresa). */
    sobrescrito: string;
    titulo: string;
    subtitulo: string;
    slogan: string;
  };
  imagens: { hero: string; origem: string; proposta: string; fechamento: string };
  secoes: ApresentacaoSecao[];
  fechamento: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    closing: string;
    ctaLabel: string;
    ctaHint: string;
  };
  projetos: { eyebrow: string; title: string; subtitle: string; hint: string; items: ApresentacaoMidia[] };
  cubo: { id: string; src: string; title: string; caption: string }[];
  instagram: {
    eyebrow: string;
    title: string;
    subtitle: string;
    handle: string;
    profileUrl: string;
    embedUrl: string;
    profileCta: string;
    phoneDisplay: string;
    phoneTel: string;
    phoneWhatsApp: string;
    phoneLabel: string;
  };
  contato: {
    /** "A {empresa} irá entrar em contato com você." (encerramento e formulário) */
    aviso: string;
    formTexto: string;
    formSucesso: string;
    formRodape: string;
    rodapeInstagram: string;
  };
}

/** Catálogo de interfaces da página Pontua (o banco valida os mesmos valores). */
export type PontuaInterface = 'sem_marca' | 'classica';

export const PONTUA_INTERFACES: { id: PontuaInterface; nome: string; descricao: string }[] = [
  {
    id: 'sem_marca',
    nome: 'Sem marca',
    descricao: 'Banner neutro: sem logo nem nome da empresa. É o padrão.',
  },
  {
    id: 'classica',
    nome: 'Clássica',
    descricao: 'Logo da empresa no centro do globo e o nome nos textos.',
  },
];

export function interfacePontua(valor: unknown): PontuaInterface {
  return valor === 'classica' ? 'classica' : 'sem_marca';
}

/** Capítulo Pontua da apresentação (demonstração com números fictícios). */
export interface PontuaConteudo {
  /**
   * Interface do banner principal. `sem_marca` (padrão): sem logo nem nome da empresa.
   * `classica`: logo da empresa no centro do globo e `{empresa}` resolvido nos textos.
   * Escolhida pelo master por empresa-modelo (/master/modelos).
   */
  interface?: PontuaInterface;
  eyebrow: string;
  title: string;
  subtitle: string;
  badge: string;
  parceiro: { nome: string; escritorio: string; cidade: string; percentual: number };
  metricas: {
    aGanar: number;
    paraSacar: number;
    retirado: number;
    aguardandoLiberacao: number;
    totalComissaoGanha: number;
    ganhoMesAtual: number;
    mediaMensalGanhos: number;
  };
  ganhosPorMes: { key: string; label: string; valor: number }[];
  passos: { step: string; title: string; text: string }[];
  comissoes: { id: string; projeto: string; cliente: string; valorVenda: number; comissao: number; status: PontuaComissaoStatus; data: string }[];
  saques: { id: string; valor: number; status: PontuaSaqueStatus; data: string }[];
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const CONTEUDO_NEUTRO: ApresentacaoConteudo = {
  marca: {
    sobrescrito: '{empresa}',
    titulo: '{empresa}',
    subtitulo: '',
    slogan: 'Precisão na execução para arquitetos que levam o próprio nome a sério.',
  },
  imagens: {
    hero: APRESENTACAO_IMAGES.hero,
    origem: '/imagens/apresentacao/projetos/painel-madeira-continuidade.png',
    proposta: APRESENTACAO_IMAGES.proposta,
    fechamento: APRESENTACAO_IMAGES.fechamento,
  },
  secoes: [
    {
      id: 'origem',
      eyebrow: 'A ORIGEM',
      title: 'Por que a {empresa} existe',
      paragraphs: [
        'Nascemos dentro da oficina, onde madeira não mente: ela revela o capricho de quem a trabalhou e o respeito pelo projeto.',
        'Vimos o mercado prometer muito e entregar pouco, tratando o projeto do arquiteto como sugestão. Decidimos fazer diferente.',
      ],
      highlight: 'Não como mais uma empresa. Como uma resposta.',
    },
    {
      id: 'proposta',
      eyebrow: 'A PROPOSTA',
      title: 'O que a {empresa} resolve',
      paragraphs: [
        'Um princípio único: o projeto do arquiteto é sagrado.',
        'Cada medida, cada detalhe, cada ferragem executados com precisão, com materiais de primeira e comunicação que você acompanha do começo ao fim.',
      ],
      highlight: 'Você é o autor. Nós somos o instrumento.',
    },
    {
      id: 'prova-social',
      eyebrow: 'PROVA SOCIAL',
      title: 'O que nossos parceiros dizem',
      paragraphs: [
        'Arquitetos que trabalham conosco uma vez raramente buscam outro fornecedor: não querem mais correr o risco de trabalhar sem uma parceria assim.',
      ],
      highlight: 'A reputação do seu escritório é construída em cada entrega. A nossa também.',
    },
  ],
  fechamento: {
    eyebrow: 'FECHAMENTO',
    title: 'Uma parceria, não um orçamento',
    paragraphs: [
      'Crescemos na qualidade, não no volume.',
      'Trabalhamos com um número limitado de projetos por vez, para que cada um receba a atenção que merece.',
    ],
    closing: 'Se você chegou até aqui, já entendeu: o que oferecemos é uma parceria.',
    ctaLabel: 'Iniciar parceria',
    ctaHint: 'A {empresa} irá entrar em contato com você.',
  },
  projetos: clone(APRESENTACAO_PROJETOS) as ApresentacaoConteudo['projetos'],
  cubo: clone(APRESENTACAO_CUBO_DESTAQUES) as unknown as ApresentacaoConteudo['cubo'],
  instagram: {
    eyebrow: 'INSTAGRAM',
    title: 'Entre no feed da oficina',
    subtitle: 'Obras, detalhes e o dia a dia da {empresa}.',
    profileCta: 'Abrir Instagram',
    phoneLabel: 'Falar agora',
    handle: '',
    profileUrl: '',
    embedUrl: '',
    phoneDisplay: '',
    phoneTel: '',
    phoneWhatsApp: '',
  },
  contato: {
    aviso: 'A {empresa} irá entrar em contato com você.',
    formTexto: 'Cadastre-se para iniciar a parceria. A {empresa} irá entrar em contato com você —',
    formSucesso: 'Recebemos seus dados. A {empresa} irá entrar em contato com você em breve.',
    formRodape: 'Cadastro de prestador · vinculado à {empresa}',
    rodapeInstagram: '{empresa}',
  },
};

export const PONTUA_NEUTRO: PontuaConteudo = {
  ...(clone(PONTUA_DEMO) as unknown as PontuaConteudo),
  interface: 'sem_marca',
};

function eObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Mescla o salvo sobre o padrão: objetos campo a campo; listas e textos substituem inteiros. */
export function mesclar<T>(base: T, salvo: unknown): T {
  if (!eObjeto(base) || !eObjeto(salvo)) return (salvo === undefined || salvo === null ? base : (salvo as T));
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(salvo)) {
    if (v === undefined || v === null) continue;
    const b = (base as Record<string, unknown>)[k];
    out[k] = eObjeto(b) && eObjeto(v) ? mesclar(b, v) : v;
  }
  return out as T;
}

/** Troca `{empresa}` pelo nome em todos os textos. */
export function aplicarNome<T>(valor: T, nome: string): T {
  if (typeof valor === 'string') return valor.split('{empresa}').join(nome) as T;
  if (Array.isArray(valor)) return valor.map((v) => aplicarNome(v, nome)) as T;
  if (eObjeto(valor)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) out[k] = aplicarNome(v, nome);
    return out as T;
  }
  return valor;
}

export interface ConteudoResolvido {
  conteudo: ApresentacaoConteudo;
  pontua: PontuaConteudo;
}

/** Conteúdo final da tela a partir do que está salvo (ou nada) e do nome fantasia. */
export function resolverConteudo(salvo: { conteudo?: unknown; pontua?: unknown } | null | undefined, nome: string): ConteudoResolvido {
  return {
    conteudo: aplicarNome(mesclar(CONTEUDO_NEUTRO, salvo?.conteudo), nome),
    pontua: resolverPontua(mesclar(PONTUA_NEUTRO, salvo?.pontua), nome),
  };
}

/**
 * Capítulo Pontua pronto para exibir. Na interface sem marca, o `{empresa}` digitado nos textos
 * some em vez de virar o nome da empresa.
 */
export function resolverPontua(pontua: PontuaConteudo, nome: string): PontuaConteudo {
  if (interfacePontua(pontua.interface) === 'classica') return aplicarNome(pontua, nome);
  return limparEspacos(aplicarNome(pontua, ''));
}

/** Remove espaços duplicados e antes de pontuação que sobram quando `{empresa}` é retirado. */
function limparEspacos<T>(valor: T): T {
  if (typeof valor === 'string') return valor.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim() as T;
  if (Array.isArray(valor)) return valor.map((v) => limparEspacos(v)) as T;
  if (eObjeto(valor)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) out[k] = limparEspacos(v);
    return out as T;
  }
  return valor;
}
