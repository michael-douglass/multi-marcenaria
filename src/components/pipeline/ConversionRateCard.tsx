import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Calendar, CalendarDays } from 'lucide-react';
import { EditableCardTitle } from './EditableCardTitle';

interface ConversionRateCardProps {
  leadsPeriodo: number;
  aulasPeriodo: number;
  conversionPeriodo: number;
  periodoLabel: string;
  leadsMonth: number;
  aulasMonth: number;
  conversionMonth: number;
  isLoading?: boolean;
}

export function ConversionRateCard({
  leadsPeriodo,
  aulasPeriodo,
  conversionPeriodo,
  periodoLabel,
  leadsMonth,
  aulasMonth,
  conversionMonth,
  isLoading = false,
}: ConversionRateCardProps) {
  if (isLoading) {
    return (
      <Card className="p-3 bg-muted/30 border-border">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </Card>
    );
  }

  // Determinar tendência comparando taxa do período com mensal
  const getTrend = () => {
    const diff = conversionPeriodo - conversionMonth;
    if (Math.abs(diff) < 2) return 'stable';
    return diff > 0 ? 'up' : 'down';
  };

  const trend = getTrend();

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-success" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-destructive" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getConversionColor = (rate: number) => {
    if (rate >= 20) return 'text-success';
    if (rate >= 10) return 'text-amber-500';
    return 'text-destructive';
  };

  return (
    <Card className="p-3 bg-muted/30 border-border hover:bg-muted/40 transition-colors">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 group">
          <EditableCardTitle labelKey="conversion_rate" variant="metric" className="flex-1" />
          <span className="text-lg shrink-0">📅</span>
        </div>

        {/* Grid com Período Filtrado e Mês */}
        <div className="grid grid-cols-2 gap-3">
          {/* Período Filtrado (ou Hoje) */}
          <div className="space-y-1 p-2 rounded-md bg-background/50">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{periodoLabel}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-bold ${getConversionColor(conversionPeriodo)}`}>
                {conversionPeriodo.toFixed(1)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">%</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {aulasPeriodo} de {leadsPeriodo} leads
            </div>
          </div>

          {/* Mês */}
          <div className="space-y-1 p-2 rounded-md bg-background/50">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span>Mês</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-bold ${getConversionColor(conversionMonth)}`}>
                {conversionMonth.toFixed(1)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">%</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {aulasMonth} de {leadsMonth} leads
            </div>
          </div>
        </div>

        {/* Footer com comparação */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 border-t border-border">
          {getTrendIcon()}
          <span>
            {trend === 'up' && `${periodoLabel} acima da média`}
            {trend === 'down' && `${periodoLabel} abaixo da média`}
            {trend === 'stable' && 'Estável em relação ao mês'}
          </span>
        </div>
      </div>
    </Card>
  );
}
