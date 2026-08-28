/** Chaves dos cards do dashboard Pipeline — apenas rótulos visuais (localStorage). */
export const PIPELINE_DASHBOARD_LABEL_DEFAULTS = {
  section_title: 'Indicadores do Pipeline',
  section_subtitle: 'Métricas e tendências',
  leads_today: 'Leads Hoje',
  conversion_rate: 'Taxa Conversão Aulas',
  filtered_period: 'Período Filtrado',
  trend_period: 'Tendência (15 dias)',
  trend_daily: 'Tendência (Hoje vs Ontem)',
  origin_chart: 'Leads por Origem',
  meetings: 'Aulas Experimentais',
  journey: 'Jornada de Compra',
  evolution_chart: 'Evolução dos últimos 15 dias',
  origin_by_month: 'Leads por Região/Mês',
  sales_stats: 'Negócios Ganhos',
  orcamentos: 'Orçamentos',
  sales_by_origin: 'Vendas por Origem',
  vendor_ranking: 'Ranking de Vendedores',
} as const;

export type PipelineDashboardLabelKey = keyof typeof PIPELINE_DASHBOARD_LABEL_DEFAULTS;

export type PipelineDashboardLabels = Partial<Record<PipelineDashboardLabelKey, string>>;

export function getPipelineLabelsStorageKey(empresaId: string | null | undefined): string {
  return `crm-pipeline-dashboard-labels:${empresaId ?? 'default'}`;
}

export function loadPipelineDashboardLabels(
  empresaId: string | null | undefined
): PipelineDashboardLabels {
  try {
    const raw = localStorage.getItem(getPipelineLabelsStorageKey(empresaId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PipelineDashboardLabels;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function savePipelineDashboardLabels(
  empresaId: string | null | undefined,
  labels: PipelineDashboardLabels
): void {
  localStorage.setItem(getPipelineLabelsStorageKey(empresaId), JSON.stringify(labels));
}
