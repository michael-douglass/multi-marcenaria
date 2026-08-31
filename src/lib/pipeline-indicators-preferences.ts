export const PIPELINE_INDICATOR_KEYS = [
  'origin_by_month',
  'sales_stats',
  'orcamentos',
  'sales_by_origin',
  'vendor_ranking',
] as const;

export type PipelineIndicatorKey = (typeof PIPELINE_INDICATOR_KEYS)[number];

export interface PipelineIndicatorsState {
  /** Bloco principal (leads hoje, conversão, etc.) — true = visível/expandido. */
  metricsOpen: boolean;
  /** Gráfico de evolução 15 dias — true = visível/expandido. Sempre inicia fechado ao abrir a página. */
  chartOpen: boolean;
  /** Container dos 5 indicadores — true = visível/expandido. */
  sectionOpen: boolean;
  cards: Record<PipelineIndicatorKey, boolean>;
}

export const DEFAULT_PIPELINE_INDICATORS: PipelineIndicatorsState = {
  metricsOpen: false,
  chartOpen: false,
  sectionOpen: false,
  cards: {
    origin_by_month: false,
    sales_stats: false,
    orcamentos: false,
    sales_by_origin: false,
    vendor_ranking: false,
  },
};

export function normalizePipelineIndicators(
  raw: unknown,
): PipelineIndicatorsState {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_PIPELINE_INDICATORS,
      cards: { ...DEFAULT_PIPELINE_INDICATORS.cards },
    };
  }

  const obj = raw as Record<string, unknown>;
  const cardsRaw =
    obj.cards && typeof obj.cards === 'object'
      ? (obj.cards as Record<string, unknown>)
      : {};

  const cards = { ...DEFAULT_PIPELINE_INDICATORS.cards };
  for (const key of PIPELINE_INDICATOR_KEYS) {
    if (typeof cardsRaw[key] === 'boolean') {
      cards[key] = cardsRaw[key];
    }
  }

  return {
    metricsOpen:
      typeof obj.metricsOpen === 'boolean'
        ? obj.metricsOpen
        : DEFAULT_PIPELINE_INDICATORS.metricsOpen,
    chartOpen:
      typeof obj.chartOpen === 'boolean'
        ? obj.chartOpen
        : DEFAULT_PIPELINE_INDICATORS.chartOpen,
    sectionOpen:
      typeof obj.sectionOpen === 'boolean'
        ? obj.sectionOpen
        : DEFAULT_PIPELINE_INDICATORS.sectionOpen,
    cards,
  };
}
