import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface MetricCardProps {
  title: React.ReactNode;
  value: number;
  suffix?: string;
  subtitle?: React.ReactNode;
  icon?: string;
  isLoading?: boolean;
}

export function MetricCard({ 
  title, 
  value, 
  suffix = '', 
  subtitle, 
  icon,
  isLoading = false 
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className="p-3 bg-muted/30 border-border">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-12" />
          {subtitle && <Skeleton className="h-3 w-16" />}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 bg-muted/30 border-border hover:bg-muted/40 transition-colors">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 group">
          <div className="min-w-0 flex-1">{title}</div>
          {icon && <span className="text-lg shrink-0">{icon}</span>}
        </div>
        
        <div className="flex items-baseline gap-1">
          <p className="text-xl md:text-2xl font-bold text-foreground">
            {value.toLocaleString('pt-BR')}
          </p>
          {suffix && (
            <span className="text-base font-semibold text-muted-foreground">
              {suffix}
            </span>
          )}
        </div>

        {subtitle && (
          <div className="text-xs text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
    </Card>
  );
}
