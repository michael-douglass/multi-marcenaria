import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Lead } from '@/types/selletos';
import { MetricCard } from './MetricCard';
import { TrendChart } from './TrendChart';
import { OriginChart } from './OriginChart';
import { MeetingsCard } from './MeetingsCard';
import { JourneyTimeCard } from './JourneyTimeCard';
import { ConversionRateCard } from './ConversionRateCard';
import { useJourneyTimeStats } from '@/hooks/useJourneyTimeStats';
import { useConversionStats } from '@/hooks/useConversionStats';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Pencil, RotateCcw, LineChart } from 'lucide-react';
import {
  PipelineDashboardLabelsProvider,
  usePipelineDashboardLabels,
} from '@/contexts/PipelineDashboardLabelsContext';
import { EditableCardTitle } from './EditableCardTitle';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, getTodaySaoPaulo, toSaoPauloTime } from '@/lib/utils';
import { PipelineIndicatorsSection } from './PipelineIndicatorsSection';
import { PipelineIndicatorsPreferencesProvider } from '@/contexts/PipelineIndicatorsPreferencesContext';
import { usePipelineIndicatorsPreferencesContext } from '@/contexts/PipelineIndicatorsPreferencesContext';

type DateFilterType = 'today' | 'week' | 'month' | 'current_month' | 'custom' | 'date_range' | 'all';

interface PipelineMetricsProps {
  leads: Lead[];
  allLeads: Lead[]; // Todos os leads para calcular "Leads Hoje" independente de filtros
  isLoading: boolean;
  userRole?: string;
  dateFilter?: DateFilterType;
  customDateFilter?: Date;
  selectedOrigins?: string[];
  selectedRegioes?: string[];
}

function IndicatorsToggle({
  open,
  onToggle,
  closedLabel,
  openLabel,
}: {
  open: boolean;
  onToggle: () => void;
  closedLabel: string;
  openLabel: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'h-8 gap-1.5 rounded-full border px-3 text-[11px] font-medium tracking-wide transition-colors',
        open
          ? 'border-[rgba(240,210,140,0.45)] bg-[rgba(240,210,140,0.14)] text-[#f2d892] hover:bg-[rgba(240,210,140,0.2)]'
          : 'border-border/70 text-muted-foreground hover:border-[rgba(240,210,140,0.35)] hover:text-foreground',
      )}
    >
      {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
      <span>{open ? openLabel : closedLabel}</span>
    </Button>
  );
}

function DashboardLabelsToolbar() {
  const { canEdit, editMode, setEditMode, resetAllLabels } = usePipelineDashboardLabels();
  if (!canEdit) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={editMode ? 'default' : 'outline'}
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => setEditMode(!editMode)}
      >
        <Pencil className="h-3.5 w-3.5" />
        <span className="text-xs">{editMode ? 'Concluir edição' : 'Editar nomes dos cards'}</span>
      </Button>
      {editMode && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground"
          onClick={resetAllLabels}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="text-xs">Restaurar todos</span>
        </Button>
      )}
    </div>
  );
}

export function PipelineMetrics(props: PipelineMetricsProps) {
  const isAdmin = props.userRole === 'ADMIN';
  return (
    <PipelineIndicatorsPreferencesProvider>
      <PipelineDashboardLabelsProvider canEdit={isAdmin}>
        <PipelineMetricsContent {...props} isAdmin={isAdmin} />
      </PipelineDashboardLabelsProvider>
    </PipelineIndicatorsPreferencesProvider>
  );
}

function PipelineMetricsContent({
  leads,
  allLeads,
  isLoading,
  userRole,
  dateFilter = 'all',
  customDateFilter,
  selectedOrigins = [],
  selectedRegioes = [],
  isAdmin,
}: PipelineMetricsProps & { isAdmin: boolean }) {
  const { getLabel } = usePipelineDashboardLabels();
  const { indicators, ready, setMetricsOpen } =
    usePipelineIndicatorsPreferencesContext();
  const metricsOpen = ready ? indicators.metricsOpen : false;
  /** Sempre começa recolhido nesta visita; a pessoa escolhe expandir. */
  const [chartOpen, setChartOpen] = useState(false);

  // Calcular estatísticas de jornada de compra
  const journeyTimeStats = useJourneyTimeStats(allLeads);

  // Calcular estatísticas de conversão (leads -> aulas experimentais)
  // Agora respeita os filtros de data, origem e região aplicados
  const conversionStats = useConversionStats({ 
    allLeads, 
    dateFilter, 
    customDateFilter,
    selectedOrigins,
    selectedRegioes,
  });

  // Calcular leads de hoje (timezone São Paulo) - usa allLeads para ser independente de filtros
  const leadsToday = useMemo(() => {
    const today = getTodaySaoPaulo();
    console.log('📅 Data atual (SP):', today);
    const count = allLeads.filter(lead => lead.dateArrived === today).length;
    console.log('📊 Leads hoje:', count, 'de', allLeads.length, 'total');
    return count;
  }, [allLeads]);

  // Calcular leads de ontem para comparação (timezone São Paulo) - usa allLeads
  const leadsYesterday = useMemo(() => {
    const todaySP = toSaoPauloTime(new Date());
    const yesterday = format(subDays(todaySP, 1), 'yyyy-MM-dd');
    return allLeads.filter(lead => lead.dateArrived === yesterday).length;
  }, [allLeads]);

  // Calcular dados dos últimos 15 dias para o gráfico (timezone São Paulo) - usa allLeads
  const last15DaysData = useMemo(() => {
    const todaySP = toSaoPauloTime(new Date());
    const data = Array.from({ length: 15 }, (_, i) => {
      const date = subDays(todaySP, 14 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const count = allLeads.filter(lead => lead.dateArrived === dateStr).length;

      return {
        date: dateStr,
        count,
        label: format(date, 'dd/MM', { locale: ptBR }),
      };
    });

    return data;
  }, [allLeads]);

  // Calcular média dos últimos 30 dias (timezone São Paulo) - usa allLeads
  const last30DaysAverage = useMemo(() => {
    const todaySP = toSaoPauloTime(new Date());
    const totalLast30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(todaySP, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      return allLeads.filter(lead => lead.dateArrived === dateStr).length;
    }).reduce((sum, count) => sum + count, 0);

    return totalLast30Days / 30;
  }, [allLeads]);

  // Calcular crescimento percentual com validação de dados
  const growthMetrics = useMemo(() => {
    const todaySP = toSaoPauloTime(new Date());
    
    // Período atual: últimos 15 dias (hoje até 14 dias atrás)
    // Exemplo: se hoje é 16/01, período é 02/01 a 16/01
    const currentPeriodDays = Array.from({ length: 15 }, (_, i) => {
      const date = subDays(todaySP, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      return allLeads.filter(lead => lead.dateArrived === dateStr).length;
    });
    const totalCurrent = currentPeriodDays.reduce((sum, count) => sum + count, 0);
    const avgCurrent = totalCurrent / 15;
    
    // Período anterior: 15 dias antes do período atual (15 a 29 dias atrás)
    // Exemplo: se hoje é 16/01, período é 18/12 a 01/01
    const previousPeriodDays = Array.from({ length: 15 }, (_, i) => {
      const date = subDays(todaySP, 15 + i); // 15, 16, 17... 29 dias atrás
      const dateStr = format(date, 'yyyy-MM-dd');
      return allLeads.filter(lead => lead.dateArrived === dateStr).length;
    });
    const totalPrevious = previousPeriodDays.reduce((sum, count) => sum + count, 0);
    const avgPrevious = totalPrevious / 15;

    // Verificar se há dados históricos suficientes
    const daysWithDataCurrent = currentPeriodDays.filter(count => count > 0).length;
    const daysWithDataPrevious = previousPeriodDays.filter(count => count > 0).length;
    
    const hasInsufficientData = daysWithDataCurrent < 3 || daysWithDataPrevious === 0;

    // Calcular variação percentual
    let percentage: number;
    let trend: 'up' | 'down' | 'stable';
    let comparisonType: 'period' | 'daily' | 'insufficient';

    if (hasInsufficientData) {
      // Comparação diária (hoje vs ontem)
      if (leadsYesterday === 0 && leadsToday === 0) {
        percentage = 0;
        trend = 'stable';
        comparisonType = 'insufficient';
      } else if (leadsYesterday === 0) {
        percentage = 100;
        trend = 'up';
        comparisonType = 'daily';
      } else {
        percentage = ((leadsToday - leadsYesterday) / leadsYesterday) * 100;
        trend = percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'stable';
        comparisonType = 'daily';
      }
    } else {
      // Comparação de períodos: ((média atual - média anterior) / média anterior) * 100
      percentage = avgPrevious > 0 
        ? ((avgCurrent - avgPrevious) / avgPrevious) * 100 
        : avgCurrent > 0 ? 100 : 0;
      trend = percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'stable';
      comparisonType = 'period';
    }

    // Log para debug
    console.log('📊 Tendência calculada:', {
      avgCurrent: avgCurrent.toFixed(2),
      avgPrevious: avgPrevious.toFixed(2),
      percentage: percentage.toFixed(2),
      trend,
      daysWithDataCurrent,
      daysWithDataPrevious
    });

    return {
      percentage: Math.abs(percentage),
      trend,
      avgCurrent,
      avgPrevious,
      comparisonType,
      leadsToday,
      leadsYesterday,
      daysWithData: daysWithDataCurrent,
    };
  }, [allLeads, leadsToday, leadsYesterday]);

  // Leads no período filtrado (já vêm filtrados do Pipeline.tsx)
  const leadsInRange = leads.length;

  const getTrendIcon = () => {
    switch (growthMetrics.trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (growthMetrics.trend) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const isVendedor = userRole === 'VENDEDOR';

  const trendTitle =
    growthMetrics.comparisonType === 'daily'
      ? getLabel('trend_daily', 'Tendência (Hoje vs Ontem)')
      : getLabel('trend_period', 'Tendência (15 dias)');

  // Não mostrar métricas para roles que não são admin nem vendedor
  if (!isAdmin && !isVendedor) {
    return null;
  }

  // Vendedor: mostrar apenas cards limitados
  if (isVendedor) {
    return (
      <Card className="overflow-hidden border-border bg-card p-2.5 md:p-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <EditableCardTitle labelKey="section_title" variant="heading" as="h2" className="text-sm" />
              <EditableCardTitle
                labelKey="section_subtitle"
                variant="metric"
                className="normal-case tracking-normal text-muted-foreground mt-0.5"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <DashboardLabelsToolbar />
              <IndicatorsToggle
                open={metricsOpen}
                onToggle={() => setMetricsOpen(!metricsOpen)}
                closedLabel="Mostrar métricas"
                openLabel="Ocultar métricas"
              />
            </div>
          </div>

          <Collapsible open={metricsOpen} onOpenChange={setMetricsOpen}>
            <CollapsibleContent className="data-[state=closed]:hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <MetricCard
                  title={<EditableCardTitle labelKey="leads_today" variant="metric" />}
                  value={leadsToday}
                  isLoading={isLoading}
                  icon="📊"
                />

                {/* Taxa de Conversão para Aulas */}
                <ConversionRateCard
                  leadsPeriodo={conversionStats.leadsPeriodo}
                  aulasPeriodo={conversionStats.aulasPeriodo}
                  conversionPeriodo={conversionStats.conversionPeriodo}
                  periodoLabel={conversionStats.periodoLabel}
                  leadsMonth={conversionStats.leadsMonth}
                  aulasMonth={conversionStats.aulasMonth}
                  conversionMonth={conversionStats.conversionMonth}
                  isLoading={conversionStats.isLoading || isLoading}
                />
              </div>

              <div className="mt-3">
                <MeetingsCard isLoading={isLoading} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <PipelineIndicatorsSection
            allLeads={allLeads}
            isLoading={isLoading}
            visibleKeys={['sales_stats', 'orcamentos']}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border bg-card p-2.5 md:p-3">
      <div className="space-y-2">
        {/* Faixa compacta: o gráfico começa recolhido e só ocupa altura se a pessoa expandir */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <EditableCardTitle labelKey="section_title" variant="heading" as="h2" className="text-sm" />
            <EditableCardTitle
              labelKey="section_subtitle"
              variant="metric"
              className="normal-case tracking-normal text-muted-foreground mt-0.5"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DashboardLabelsToolbar />
            <IndicatorsToggle
              open={metricsOpen}
              onToggle={() => setMetricsOpen(!metricsOpen)}
              closedLabel="Mostrar métricas"
              openLabel="Ocultar métricas"
            />
            <IndicatorsToggle
              open={chartOpen}
              onToggle={() => setChartOpen(!chartOpen)}
              closedLabel="Mostrar evolução"
              openLabel="Ocultar evolução"
            />
          </div>
        </div>

        {/* Grid de métricas - Collapsible */}
        <Collapsible open={metricsOpen} onOpenChange={setMetricsOpen}>
          <CollapsibleContent className="data-[state=closed]:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <MetricCard
            title={<EditableCardTitle labelKey="leads_today" variant="metric" />}
            value={leadsToday}
            isLoading={isLoading}
            icon="📊"
          />

          {/* Taxa de Conversão para Aulas - Respeita filtros de data */}
          <ConversionRateCard
            leadsPeriodo={conversionStats.leadsPeriodo}
            aulasPeriodo={conversionStats.aulasPeriodo}
            conversionPeriodo={conversionStats.conversionPeriodo}
            periodoLabel={conversionStats.periodoLabel}
            leadsMonth={conversionStats.leadsMonth}
            aulasMonth={conversionStats.aulasMonth}
            conversionMonth={conversionStats.conversionMonth}
            isLoading={conversionStats.isLoading || isLoading}
          />

          {/* Leads no período */}
          <MetricCard
            title={<EditableCardTitle labelKey="filtered_period" variant="metric" />}
            value={leadsInRange}
            subtitle="Conforme filtros aplicados"
            isLoading={isLoading}
            icon="📅"
          />

          {/* Crescimento */}
          <MetricCard
            title={<EditableCardTitle labelKey={growthMetrics.comparisonType === 'daily' ? 'trend_daily' : 'trend_period'} variant="metric" fallback={trendTitle} />}
            value={growthMetrics.percentage}
            suffix="%"
            subtitle={
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  {getTrendIcon()}
                  <span className={getTrendColor()}>
                    {growthMetrics.trend === 'up' ? 'Crescimento' : 
                     growthMetrics.trend === 'down' ? 'Queda' : 
                     'Estável'}
                  </span>
                </div>
                {growthMetrics.comparisonType === 'daily' && (
                  <div className="text-[10px] text-muted-foreground">
                    Comparando hoje ({growthMetrics.leadsToday}) vs ontem ({growthMetrics.leadsYesterday})
                  </div>
                )}
                {growthMetrics.comparisonType === 'insufficient' && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-500">
                    Dados insuficientes (apenas {growthMetrics.daysWithData} dias)
                  </div>
                )}
              </div>
            }
            isLoading={isLoading}
            icon="📈"
          />

          {/* Gráfico de Origem */}
          <OriginChart leads={leads} isLoading={isLoading} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mt-3">
              <MeetingsCard isLoading={isLoading} />

              <JourneyTimeCard
                monthlyStats={journeyTimeStats.monthlyStats}
                currentMonthIndex={journeyTimeStats.currentMonthIndex}
                totalAvgJourneyDays={journeyTimeStats.totalAvgJourneyDays}
                totalSalesCount={journeyTimeStats.totalSalesCount}
                isLoading={journeyTimeStats.isLoading || isLoading}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={chartOpen} onOpenChange={setChartOpen}>
          <CollapsibleContent className="data-[state=closed]:hidden">
            <div className="space-y-2 border-t border-[rgba(240,210,140,0.18)] pt-2">
              <div className="flex items-center gap-2">
                <LineChart className="h-3.5 w-3.5 text-[#f2d892]" />
                <EditableCardTitle
                  labelKey="evolution_chart"
                  variant="section"
                  as="h3"
                  className="text-sm font-medium normal-case tracking-normal"
                />
              </div>
              <TrendChart 
                data={last15DaysData} 
                isLoading={isLoading}
                trend={growthMetrics.trend}
              />

              {/* Info adicional */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border mt-2">
                {growthMetrics.comparisonType === 'period' ? (
                  <>
                    <div>
                      Média atual (15d): <span className="font-medium text-foreground">
                        {growthMetrics.avgCurrent.toFixed(1)} leads/dia
                      </span>
                    </div>
                    <div>
                      Média anterior (15d): <span className="font-medium text-foreground">
                        {growthMetrics.avgPrevious.toFixed(1)} leads/dia
                      </span>
                    </div>
                    <div>
                      Média (30d): <span className="font-medium text-foreground">
                        {last30DaysAverage.toFixed(1)} leads/dia
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      Hoje: <span className="font-medium text-foreground">
                        {growthMetrics.leadsToday} leads
                      </span>
                    </div>
                    <div>
                      Ontem: <span className="font-medium text-foreground">
                        {growthMetrics.leadsYesterday} leads
                      </span>
                    </div>
                    <div>
                      Média (30d): <span className="font-medium text-foreground">
                        {last30DaysAverage.toFixed(1)} leads/dia
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <PipelineIndicatorsSection allLeads={allLeads} isLoading={isLoading} />
      </div>
    </Card>
  );
}
