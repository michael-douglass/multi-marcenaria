import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Settings2,
} from 'lucide-react';
import { useMeetingsStats } from '@/hooks/useMeetingsStats';
import { cn } from '@/lib/utils';
import { EditableCardTitle } from './EditableCardTitle';
import { MetricasColunaConfigDialog } from './MetricasColunaConfigDialog';
import { usePermissions } from '@/hooks/usePermissions';

interface MeetingsCardProps {
  isLoading?: boolean;
}

export function MeetingsCard({ isLoading: externalLoading }: MeetingsCardProps) {
  const { userRole } = usePermissions();
  const isAdmin = userRole === 'admin';
  const [isExpanded, setIsExpanded] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedWeekRef = useRef<HTMLDivElement>(null);

  const {
    monthLabel,
    weeksOfMonth,
    selectedWeekIndex,
    setSelectedWeekIndex,
    goToPreviousMonth,
    goToNextMonth,
    canGoNext,
    totalThisMonth,
    statusColuna,
    isLoading: statsLoading,
  } = useMeetingsStats();

  // Auto-scroll para mostrar a semana selecionada
  useEffect(() => {
    if (selectedWeekRef.current && scrollContainerRef.current) {
      selectedWeekRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedWeekIndex]);

  const isLoading = externalLoading || statsLoading;

  if (isLoading) {
    return (
      <Card className="p-3 bg-muted/30 border-border">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
      </Card>
    );
  }

  // Semana selecionada e anterior para comparação
  const selectedWeek = weeksOfMonth[selectedWeekIndex];
  const previousWeek = selectedWeekIndex > 0 ? weeksOfMonth[selectedWeekIndex - 1] : null;

  // Calcular crescimento entre semanas
  const selectedTotal = selectedWeek?.total || 0;
  const previousTotal = previousWeek?.total || 0;
  
  let weekGrowth = 0;
  let weekTrend: 'up' | 'down' | 'stable' = 'stable';
  
  if (previousTotal === 0 && selectedTotal > 0) {
    weekGrowth = 100;
    weekTrend = 'up';
  } else if (previousTotal > 0) {
    weekGrowth = ((selectedTotal - previousTotal) / previousTotal) * 100;
    weekTrend = weekGrowth > 5 ? 'up' : weekGrowth < -5 ? 'down' : 'stable';
  }

  // Calcular altura máxima SEPARADAMENTE para cada semana
  const selectedMaxValue = Math.max(...(selectedWeek?.dailyStats.map(d => d.count) || []), 1);
  const previousMaxValue = Math.max(...(previousWeek?.dailyStats.map(d => d.count) || []), 1);

  // Para a barra de comparação horizontal
  const maxTotal = Math.max(selectedTotal, previousTotal, 1);

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="p-3 bg-muted/30 border-border flex flex-col">
      {/* Header com botão de expansão */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 group">
          <CalendarCheck className="h-4 w-4 text-warning flex-shrink-0" />
          <EditableCardTitle labelKey="meetings" variant="metric" className="flex-1" />
        </div>
        <div className="flex items-center gap-2">
          {/* Valor resumido quando colapsado */}
          {!isExpanded && (
            <p className="text-sm font-bold text-warning">
              {totalThisMonth}{' '}
              <span className="text-xs text-muted-foreground font-normal">este mês</span>
            </p>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              title="Escolher coluna do pipeline"
              onClick={() => setShowConfig(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mt-1 truncate" title={statusColuna}>
        Coluna: {statusColuna}
      </p>

      {/* Conteúdo expandido */}
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {/* Indicador de crescimento semanal */}
          {previousWeek && (
            <div className="flex items-center gap-1">
              {getTrendIcon(weekTrend)}
              <span className={cn("text-sm font-bold", getTrendColor(weekTrend))}>
                {Math.abs(weekGrowth).toFixed(0)}%
              </span>
              <span className="text-xs text-muted-foreground">vs semana anterior</span>
            </div>
          )}

          {/* Navegação de Mês */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium text-foreground capitalize">
              {monthLabel}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={goToNextMonth}
              disabled={!canGoNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Seletor de Semanas */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {weeksOfMonth.map((week, idx) => (
              <Button
                key={week.weekNumber}
                variant={idx === selectedWeekIndex ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  "h-6 px-2 text-[10px] flex-shrink-0",
                  week.isCurrentWeek && idx !== selectedWeekIndex && "ring-1 ring-warning/50"
                )}
                onClick={() => setSelectedWeekIndex(idx)}
              >
                S{week.weekNumber}
                {week.isCurrentWeek && <span className="ml-1 text-[8px]">●</span>}
              </Button>
            ))}
          </div>

          {/* Gráfico de Barras Comparativo */}
          <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-hidden">
            <div className="flex gap-6 pb-2 min-w-max px-2">
              {/* Semana Anterior (se existir) */}
              {previousWeek && (
                <>
                  <div className="flex flex-col items-center">
                    <p className="text-xs text-muted-foreground mb-2 whitespace-nowrap font-medium">
                      {previousWeek.weekLabel}
                    </p>
                    <div className="flex gap-3 items-end h-[100px]">
                      {previousWeek.dailyStats.map((day, idx) => {
                        const heightPercent = previousMaxValue > 0 ? (day.count / previousMaxValue) * 100 : 0;
                        return (
                          <div key={idx} className="flex flex-col items-center">
                            <span className="text-sm text-muted-foreground font-bold mb-1">
                              {day.count > 0 ? day.count : ''}
                            </span>
                            <div
                              className="w-9 bg-muted-foreground/50 rounded-t transition-all"
                              style={{ height: `${Math.max(heightPercent, 10)}%`, minHeight: '10px' }}
                            />
                            <span className="text-xs text-muted-foreground mt-1.5 font-medium">{day.label}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xl font-bold text-muted-foreground mt-2">{previousTotal}</p>
                  </div>

                  {/* Divisor */}
                  <div className="w-px bg-border self-stretch my-3" />
                </>
              )}

              {/* Semana Selecionada */}
              {selectedWeek && (
                <div ref={selectedWeekRef} className="flex flex-col items-center">
                  <p className={cn(
                    "text-xs mb-2 whitespace-nowrap font-semibold",
                    selectedWeek.isCurrentWeek ? "text-warning" : "text-primary"
                  )}>
                    {selectedWeek.weekLabel}
                    {selectedWeek.isCurrentWeek && " (Atual)"}
                  </p>
                  <div className="flex gap-3 items-end h-[100px]">
                    {selectedWeek.dailyStats.map((day, idx) => {
                      const heightPercent = selectedMaxValue > 0 ? (day.count / selectedMaxValue) * 100 : 0;
                      const isFuture = day.isFuture;
                      return (
                        <div key={idx} className={cn(
                          "flex flex-col items-center",
                          isFuture && "opacity-40"
                        )}>
                          <span className={cn(
                            "text-sm font-bold mb-1",
                            isFuture ? "text-muted-foreground" : day.count > 0 ? "text-warning" : "text-transparent"
                          )}>
                            {isFuture ? '-' : day.count > 0 ? day.count : ''}
                          </span>
                          <div
                            className={cn(
                              "w-9 rounded-t transition-all",
                              isFuture 
                                ? "bg-muted-foreground/20 border border-dashed border-muted-foreground/40" 
                                : day.count > 0 ? "bg-warning" : "bg-warning/30"
                            )}
                            style={{ height: isFuture ? '10px' : `${Math.max(heightPercent, 10)}%`, minHeight: '10px' }}
                          />
                          <span className={cn(
                            "text-xs mt-1.5 font-medium",
                            isFuture ? "text-muted-foreground/60" : "text-muted-foreground"
                          )}>{day.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className={cn(
                    "text-xl font-bold mt-2",
                    selectedWeek.isCurrentWeek ? "text-warning" : "text-primary"
                  )}>{selectedTotal}</p>
                </div>
              )}
            </div>
          </div>

          {/* Rodapé com comparativo */}
          <div className="pt-2 border-t border-border/50 space-y-1.5">
            {/* Barras de comparação */}
            {previousWeek && (
              <div className="flex gap-2 items-center">
                <div 
                  className="h-2.5 bg-muted-foreground/50 rounded-full transition-all"
                  style={{ width: `${(previousTotal / maxTotal) * 100}%`, minWidth: '20px' }}
                />
                <div 
                  className="h-2.5 bg-warning rounded-full transition-all"
                  style={{ width: `${(selectedTotal / maxTotal) * 100}%`, minWidth: '20px' }}
                />
              </div>
            )}
            
            {/* Totais */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                {previousWeek && (
                  <span className="text-muted-foreground">
                    Semana anterior: <span className="font-bold text-foreground">{previousTotal}</span>
                  </span>
                )}
                <span className="text-muted-foreground">
                  Semana atual: <span className="font-bold text-warning">{selectedTotal}</span>
                </span>
              </div>
              <span className="text-muted-foreground">
                Total mês: <span className="font-bold text-foreground">{totalThisMonth}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <MetricasColunaConfigDialog
          open={showConfig}
          onOpenChange={setShowConfig}
          cardTitle="Aulas Experimentais"
        />
      )}
    </Card>
  );
}
