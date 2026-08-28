import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface TrendChartProps {
  data: Array<{
    date: string;
    count: number;
    label: string;
  }>;
  isLoading?: boolean;
  trend?: 'up' | 'down' | 'stable';
}

export function TrendChart({ data, isLoading = false, trend = 'stable' }: TrendChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[140px] w-full" />;
  }

  // Calcular domínio customizado do YAxis para melhor visualização de pequenas variações
  const values = data.map(d => d.count);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  
  // Adicionar padding de 20% para melhor visualização
  const range = maxValue - minValue;
  const padding = Math.max(1, Math.ceil(range * 0.2));
  
  const yAxisDomain: [number, number] = [
    Math.max(0, minValue - padding),
    maxValue + padding
  ];

  const getStrokeColor = () => {
    switch (trend) {
      case 'up':
        return 'hsl(var(--success))';
      case 'down':
        return 'hsl(var(--destructive))';
      default:
        return 'hsl(var(--primary))';
    }
  };

  const getFillColor = () => {
    switch (trend) {
      case 'up':
        return 'hsla(var(--success), 0.1)';
      case 'down':
        return 'hsla(var(--destructive), 0.1)';
      default:
        return 'hsla(var(--primary), 0.1)';
    }
  };

  return (
    <div className="w-full h-[140px] bg-muted/20 rounded-lg p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 5, left: -20, bottom: 2 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={getStrokeColor()} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={getStrokeColor()} stopOpacity={0}/>
            </linearGradient>
          </defs>
          
          <XAxis 
            dataKey="label" 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            stroke="hsl(var(--border))"
            tickLine={false}
          />
          
          <YAxis 
            domain={yAxisDomain}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            stroke="hsl(var(--border))"
            tickLine={false}
            allowDecimals={false}
          />
          
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              padding: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--popover-foreground))', fontWeight: 600 }}
            itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
            formatter={(value: number) => [`${value} leads`, 'Total']}
          />
          
          <Line 
            type="monotone" 
            dataKey="count" 
            stroke={getStrokeColor()}
            strokeWidth={2.5}
            dot={{ 
              fill: getStrokeColor(), 
              strokeWidth: 2,
              r: 3.5,
              stroke: 'hsl(var(--background))'
            }}
            activeDot={{ 
              r: 5,
              fill: getStrokeColor(),
              stroke: 'hsl(var(--background))',
              strokeWidth: 2
            }}
            fill="url(#colorCount)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
