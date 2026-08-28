import { useMemo } from 'react';
import { Lead } from '@/types/selletos';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tag } from 'lucide-react';
import { EditableCardTitle } from './EditableCardTitle';

interface OriginChartProps {
  leads: Lead[];
  isLoading: boolean;
}

// Cores para cada origem (paleta vibrante)
const ORIGIN_COLORS = [
  '#F59E0B', // amber
  '#3B82F6', // blue
  '#10B981', // emerald
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo
  '#EF4444', // red
  '#84CC16', // lime
  '#06B6D4', // cyan
  '#A855F7', // purple
];

export function OriginChart({ leads, isLoading }: OriginChartProps) {
  // Processar dados por origem
  const originData = useMemo(() => {
    const originCounts: Record<string, number> = {};
    
    leads.forEach(lead => {
      const origin = lead.origin || 'Sem origem';
      originCounts[origin] = (originCounts[origin] || 0) + 1;
    });

    // Converter para array e ordenar por quantidade (maior primeiro)
    return Object.entries(originCounts)
      .map(([name, count], index) => ({
        name,
        count,
        color: ORIGIN_COLORS[index % ORIGIN_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  // Calcular total
  const totalLeads = useMemo(() => {
    return originData.reduce((sum, item) => sum + item.count, 0);
  }, [originData]);

  if (isLoading) {
    return (
      <Card className="h-[200px] flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </Card>
    );
  }

  if (originData.length === 0) {
    return (
      <Card className="h-[200px] flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Nenhum dado disponível</div>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <div>
            <CardTitle className="text-xs font-semibold p-0">
              <EditableCardTitle labelKey="origin_chart" variant="section" className="normal-case tracking-normal" />
            </CardTitle>
            <CardDescription className="text-[10px]">
              Total: {totalLeads} leads
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-2 pb-2">
        <ScrollArea className="w-full">
          <div className="h-[140px] min-w-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={originData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  allowDecimals={false}
                />
                <YAxis 
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 9 }}
                  className="text-muted-foreground"
                  width={80}
                  tickFormatter={(value) => value.length > 12 ? `${value.slice(0, 12)}...` : value}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(value: number) => [`${value} leads`, 'Quantidade']}
                />
                <Bar 
                  dataKey="count" 
                  radius={[0, 4, 4, 0]}
                >
                  {originData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
