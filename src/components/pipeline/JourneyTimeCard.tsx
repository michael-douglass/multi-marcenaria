import { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Route, Calendar, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { formatJourneyTime } from '@/hooks/useJourneyTimeStats';
import { cn } from '@/lib/utils';
import { EditableCardTitle } from './EditableCardTitle';

interface MonthJourneyStats {
  month: string;
  label: string;
  avgJourneyDays: number;
  salesCount: number;
}

interface JourneyTimeCardProps {
  monthlyStats: MonthJourneyStats[];
  currentMonthIndex: number;
  totalAvgJourneyDays: number;
  totalSalesCount: number;
  isLoading?: boolean;
}

type ViewMode = 'monthly' | 'total';

export function JourneyTimeCard({
  monthlyStats,
  currentMonthIndex,
  totalAvgJourneyDays,
  totalSalesCount,
  isLoading = false,
}: JourneyTimeCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  // Scroll para o mês atual ao montar
  useEffect(() => {
    if (isExpanded && viewMode === 'monthly' && currentRef.current && scrollRef.current) {
      setTimeout(() => {
        currentRef.current?.scrollIntoView({ 
          behavior: 'auto', 
          block: 'nearest', 
          inline: 'center' 
        });
      }, 100);
    }
  }, [monthlyStats, viewMode, isExpanded]);

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

  return (
    <Card className="p-3 bg-muted/30 border-border flex flex-col">
      {/* Header com botão de expansão */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 group">
          <Route className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
          <EditableCardTitle labelKey="journey" variant="metric" className="flex-1" />
        </div>
        <div className="flex items-center gap-2">
          {/* Valor resumido quando colapsado */}
          {!isExpanded && (
            <p className="text-sm font-bold text-foreground">
              {formatJourneyTime(totalAvgJourneyDays)}
            </p>
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

      {/* Conteúdo expandido */}
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {/* Toggle Mês/Total */}
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setViewMode('monthly')}
            >
              <Calendar className="h-3 w-3 mr-1" />
              Por Mês
            </Button>
            <Button
              variant={viewMode === 'total' ? 'default' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setViewMode('total')}
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              Média Geral
            </Button>
          </div>

          {viewMode === 'total' ? (
            /* Visualização de média total */
            <div className="flex flex-col items-center justify-center py-4">
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                {formatJourneyTime(totalAvgJourneyDays)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Média de <span className="font-medium text-foreground">{totalSalesCount}</span> vendas — do
                cadastro ao fechamento
              </p>
            </div>
          ) : (
            /* Grid responsivo com meses - aproveita altura */
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[280px] overflow-y-auto pr-1">
              {monthlyStats.map((month, index) => {
                const isCurrent = index === currentMonthIndex;
                const hasSales = month.salesCount > 0;
                
                return (
                  <div
                    key={month.month}
                    ref={isCurrent ? currentRef : null}
                    className={cn(
                      "p-2 rounded-lg border text-center transition-all",
                      isCurrent 
                        ? "bg-primary/10 border-primary ring-2 ring-primary/20" 
                        : "bg-muted/20 border-border hover:bg-muted/40",
                      !hasSales && "opacity-50"
                    )}
                  >
                    <p className={cn(
                      "text-[10px] font-medium mb-0.5 capitalize",
                      isCurrent ? "text-primary" : "text-muted-foreground"
                    )}>
                      {isCurrent ? 'Mês Atual' : month.label}
                    </p>
                    <p className={cn(
                      "text-base font-bold leading-tight",
                      isCurrent ? "text-primary" : "text-foreground"
                    )}>
                      {hasSales ? formatJourneyTime(month.avgJourneyDays) : '-'}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      {month.salesCount} venda{month.salesCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
