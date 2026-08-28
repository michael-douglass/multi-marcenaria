import { useMemo, useState } from 'react';
import { Lead } from '@/types/selletos';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, subMonths, parse, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronUp, TrendingUp, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { EditableCardTitle } from './EditableCardTitle';

interface RegionByMonthChartProps {
  leads: Lead[];
  isLoading: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Cores para cada região
const REGION_COLORS: Record<string, string> = {
  'Minas Gerais': '#F59E0B',
  'São Paulo': '#3B82F6',
  'Rio de Janeiro': '#10B981',
  'Bahia': '#8B5CF6',
  'Paraná': '#EC4899',
  'Santa Catarina': '#14B8A6',
  'Rio Grande do Sul': '#F97316',
  'Sem região': '#6B7280',
};

export function OriginByMonthChart({
  leads,
  isLoading,
  open,
  onOpenChange,
}: RegionByMonthChartProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isVisible = open ?? internalOpen;
  const setIsVisible = onOpenChange ?? setInternalOpen;

  // Processar dados dos últimos 12 meses
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { date: Date; label: string; monthKey: string }[] = [];
    
    // Gerar últimos 12 meses
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(now, i);
      months.push({
        date,
        label: format(date, 'MMM/yy', { locale: ptBR }),
        monthKey: format(date, 'yyyy-MM'),
      });
    }

    // Coletar todas as regiões únicas
    const allRegions = new Set<string>();
    leads.forEach(lead => {
      const region = lead.regiao || 'Sem região';
      allRegions.add(region);
    });

    // Para cada mês, contar leads por região
    return months.map(({ date, label, monthKey }) => {
      const monthLeads = leads.filter(lead => 
        lead.dateArrived && lead.dateArrived.startsWith(monthKey)
      );

      const data: Record<string, number | string> = {
        month: label,
        monthFull: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
        total: monthLeads.length,
      };

      // Contar por região
      allRegions.forEach(region => {
        data[region] = monthLeads.filter(l => (l.regiao || 'Sem região') === region).length;
      });

      return data;
    });
  }, [leads]);

  // Extrair regiões únicas para as barras
  const regions = useMemo(() => {
    const regionsSet = new Set<string>();
    leads.forEach(lead => {
      const region = lead.regiao || 'Sem região';
      regionsSet.add(region);
    });
    // Ordenar, colocando "Sem região" por último
    return Array.from(regionsSet).sort((a, b) => {
      if (a === 'Sem região') return 1;
      if (b === 'Sem região') return -1;
      return a.localeCompare(b);
    });
  }, [leads]);

  // Calcular totais e projeção dos últimos 12 meses
  const stats = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 12);
    const twelveMonthsAgoStr = format(twelveMonthsAgo, 'yyyy-MM-dd');
    
    const last12MonthsLeads = leads.filter(lead => 
      lead.dateArrived && lead.dateArrived >= twelveMonthsAgoStr
    );

    const total = last12MonthsLeads.length;
    const avgPerMonth = Math.round(total / 12);
    
    // Projeção para os próximos 12 meses baseada na média
    const projectedYear = total;

    return {
      total,
      avgPerMonth,
      projectedYear,
    };
  }, [leads]);

  // Totais por região nos últimos 12 meses
  const regionTotals = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 12);
    const twelveMonthsAgoStr = format(twelveMonthsAgo, 'yyyy-MM-dd');
    
    const totals: Record<string, number> = {};

    leads.forEach(lead => {
      if (!lead.dateArrived || lead.dateArrived < twelveMonthsAgoStr) return;
      const region = lead.regiao || 'Sem região';
      totals[region] = (totals[region] || 0) + 1;
    });

    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1]);
  }, [leads]);

  if (isLoading) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </Card>
    );
  }

  return (
    <Collapsible open={isVisible} onOpenChange={setIsVisible}>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2 p-0">
                  <MapPin className="h-4 w-4 text-amber-500 shrink-0" />
                  <EditableCardTitle labelKey="origin_by_month" variant="section" className="normal-case tracking-normal" />
                </CardTitle>
                <CardDescription className="text-xs">Últimos 12 meses por localização</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(!isVisible)}
                className="gap-1.5 h-7"
              >
                {isVisible ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span className="text-xs">Ocultar</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span className="text-xs">Mostrar</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Estatísticas */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">Total (12 meses):</span>
                <span className="text-sm font-bold text-primary">{stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Média/mês:</span>
                <span className="text-sm font-medium">{stats.avgPerMonth}</span>
              </div>
            </div>

            {/* Gráfico com scroll horizontal */}
            <ScrollArea className="w-full">
              <div className="h-[280px] min-w-[700px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.monthFull;
                        }
                        return label;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '10px' }}
                      iconSize={10}
                    />
                    {regions.map((region) => (
                      <Bar 
                        key={region}
                        dataKey={region}
                        name={region}
                        stackId="a"
                        fill={REGION_COLORS[region] || '#6B7280'}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ScrollArea>

            {/* Resumo por região */}
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Distribuição por região:</p>
              <div className="flex flex-wrap gap-2">
                {regionTotals.map(([region, count]) => (
                  <div 
                    key={region}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                    style={{ 
                      backgroundColor: `${REGION_COLORS[region] || '#6B7280'}15`,
                      color: REGION_COLORS[region] || '#6B7280',
                    }}
                  >
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: REGION_COLORS[region] || '#6B7280' }}
                    />
                    <span className="font-medium">{region}</span>
                    <span className="opacity-75">({count})</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
