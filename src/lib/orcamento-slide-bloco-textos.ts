import type { BlocoFerragemItem, BlocoTipo, PrecoFracionadoItem } from '@/lib/orcamento-slide-types';

export const TEXTOS_PADRAO_BLOCO: Partial<Record<BlocoTipo, Record<string, string>>> = {
  capa: {
    titulo: 'Proposta Comercial',
    subtitulo: '',
  },
  valorizacao: {
    percentual: '30%',
    titulo: 'Valorização Garantida',
    texto: 'Móveis planejados elevam o valor do seu imóvel e transformam a qualidade da sua vida.',
  },
  galeria_projetos: {
    etiqueta: 'Portfólio',
    titulo: 'Nossos Projetos',
  },
  comparativo_ferragens: {
    etiqueta: 'Qualidade',
    titulo: 'Ferragens Premium',
    texto: 'Usamos apenas ferragens certificadas que garantem durabilidade, suavidade e acabamento impecável.',
  },
  precificacao: {
    titulo: 'Investimento',
  },
  precos_fracionados: {
    etiqueta: 'Detalhamento',
    titulo: 'Valores separados',
  },
  prazos: {
    titulo: 'Prazos de Execução',
    texto: 'Trabalhamos com planejamento rigoroso para entregar no prazo combinado, sem surpresas.',
  },
  garantia: {
    titulo: 'Garantia',
    meses: '24',
    texto: 'Todos os nossos móveis possuem garantia total de fábrica e suporte pós-venda.',
  },
  texto_livre: {
    titulo: '',
    texto: '',
  },
  dados_projeto: {
    etiqueta: 'Seu projeto',
    titulo: 'Dados do projeto',
  },
  imagens_orcamento: {
    etiqueta: 'Projeto',
    titulo: 'Imagens do seu orçamento',
  },
  analise_ia: {
    etiqueta: 'Estudo do ambiente',
    titulo: 'Análise do seu projeto',
    texto: '',
  },
};

export function textoDoConfig(
  config: Record<string, unknown>,
  key: string,
  tipo: BlocoTipo,
): string {
  const v = config[key];
  if (typeof v === 'string') return v;
  return TEXTOS_PADRAO_BLOCO[tipo]?.[key] ?? '';
}

export function itensFracionadosDoConfig(config: Record<string, unknown>): PrecoFracionadoItem[] {
  const itens = config.itens;
  if (!Array.isArray(itens)) return [];
  return itens
    .filter(
      (item): item is PrecoFracionadoItem =>
        typeof item === 'object'
        && item !== null
        && typeof (item as PrecoFracionadoItem).label === 'string',
    )
    .map((item) => ({
      label: item.label,
      valor: typeof item.valor === 'number' ? item.valor : parseFloat(String(item.valor)) || 0,
    }));
}

export function itensFerragensDoConfig(config: Record<string, unknown>): BlocoFerragemItem[] {
  const itens = config.itens;
  if (!Array.isArray(itens)) return [];
  return itens.filter(
    (item): item is BlocoFerragemItem =>
      typeof item === 'object'
      && item !== null
      && typeof (item as BlocoFerragemItem).titulo === 'string',
  );
}
