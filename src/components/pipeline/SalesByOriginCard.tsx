import { useMemo, useState } from 'react';
import { Lead } from '@/types/selletos';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toSaoPauloTime } from '@/lib/utils';
import { EditableCardTitle } from './EditableCardTitle';
import { useVendasGanhosConfig } from '@/hooks/useVendasGanhosConfig';
import { filterNegociosGanhos } from '@/lib/vendas-ganhos';

interface SalesByOriginCardProps {
  allLeads: Lead[];
  isLoading: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Cores para cada origem
const ORIGIN_COLORS: Record<string, string> = {
  'Facebook': '#1877F2',
  'Instagram': '#E4405F',
  'Google': '#4285F4',
  'Site': '#10B981',
  'Indicação': '#F59E0B',
  'WhatsApp': '#25D366',
  'Telefone': '#6366F1',
  'Outros': '#6B7280',
};

const getOriginColor = (origin: string): string => {
  return ORIGIN_COLORS[origin] || ORIGIN_COLORS['Outros'];
};

export function SalesByOriginCard({
  allLeads,
  isLoading,
  open,
  onOpenChange,
}: SalesByOriginCardProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isVisible = open ?? internalOpen;
  const setIsVisible = onOpenChange ?? setInternalOpen;
  const { config, isLoading: isLoadingConfig } = useVendasGanhosConfig();

  const { chartData, totalVendas, monthLabel } = useMemo(() => {
    const now = toSaoPauloTime(new Date());
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const label = format(now, 'MMMM yyyy', { locale: ptBR });

    const vendasDoMes = filterNegociosGanhos(allLeads, config, {
      periodStart: monthStart,
      periodEnd: monthEnd,
    });

    // Agrupar por origem
    const vendasPorOrigem: Record<string, { count: number; valor: number }> = {};

    vendasDoMes.forEach(lead => {
      const origem = lead.origin || 'Outros';
      if (!vendasPorOrigem[origem]) {
        vendasPorOrigem[origem] = { count: 0, valor: 0 };
      }
      vendasPorOrigem[origem].count++;
      vendasPorOrigem[origem].valor += lead.dealValue || 0;
    });

    // Converter para array e ordenar por quantidade
    const data = Object.entries(vendasPorOrigem)
      .map(([origem, { count, valor }]) => ({
        origem,
        vendas: count,
        valor,
        color: getOriginColor(origem),
      }))
      .sort((a, b) => b.vendas - a.vendas);

    return {
      chartData: data,
      totalVendas: vendasDoMes.length,
      monthLabel: label,
    };
  }, [allLeads, config]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading || isLoadingConfig) {
    return (
      <Card className="flex items-center justify-center p-6">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </Card>
    );
  }

  return (
    <Collapsible open={isVisible} onOpenChange={setIsVisible}>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 p-0">
              <BarChart3 className="h-4 w-4 text-primary shrink-0" />
              <EditableCardTitle labelKey="sales_by_origin" variant="section" className="normal-case tracking-normal" />
            </CardTitle>
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
          <CardDescription className="text-xs">
            {monthLabel} • {totalVendas} vendas
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {chartData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma venda registrada no mês
              </div>
            ) : (
              <>
                {/* Gráfico de Barras Horizontal */}
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                      <XAxis 
                        type="number" 
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                        allowDecimals={false}
                      />
                      <YAxis 
                        dataKey="origem" 
                        type="category"
                        tick={{ fontSize: 11 }}
                        className="text-muted-foreground"
                        width={55}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number, name: string, props: any) => [
                          `${value} vendas (${formatCurrency(props.payload.valor)})`,
                          'Vendas'
                        ]}
                      />
                      <Bar 
                        dataKey="vendas" 
                        radius={[0, 4, 4, 0]}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Legenda/Resumo */}
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex flex-wrap gap-2">
                    {chartData.map(item => (
                      <div 
                        key={item.origem}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                        style={{ 
                          backgroundColor: `${item.color}15`,
                          color: item.color,
                        }}
                      >
                        <span 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium">{item.origem}</span>
                        <span className="opacity-75">({item.vendas})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
