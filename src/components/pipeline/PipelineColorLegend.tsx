import { Badge } from '@/components/ui/badge';
import { usePipelineTimeConfig, PipelineTimeConfig } from '@/hooks/usePipelineTimeConfig';
import { cn } from '@/lib/utils';

// Formatar tempo baseado nos minutos configurados (dinâmico)
function formatarTempoLegenda(minutos: number): string {
  if (minutos < 60) return `Até ${minutos} min`;
  if (minutos < 1440) {
    const horas = Math.floor(minutos / 60);
    return `Até ${horas}h`;
  }
  const dias = Math.floor(minutos / 1440);
  return `Até ${dias}d`;
}

interface PipelineColorLegendProps {
  selectedTimeFilter?: string | null;
  onTimeFilterChange?: (configId: string | null) => void;
}

export function PipelineColorLegend({ 
  selectedTimeFilter, 
  onTimeFilterChange 
}: PipelineColorLegendProps) {
  const { configs, isLoading } = usePipelineTimeConfig();

  if (isLoading || !configs || configs.length === 0) {
    return null;
  }

  // Ordenar configs por tempo crescente para exibição lógica
  const sortedConfigs = [...configs].sort((a, b) => a.tempoMinutos - b.tempoMinutos);

  const handleClick = (config: PipelineTimeConfig) => {
    if (!onTimeFilterChange) return;
    
    // Se clicar no mesmo filtro, desativa
    if (selectedTimeFilter === config.id) {
      onTimeFilterChange(null);
    } else {
      onTimeFilterChange(config.id);
    }
  };

  const isClickable = !!onTimeFilterChange;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sortedConfigs.map(config => {
        const isSelected = selectedTimeFilter === config.id;
        
        return (
          <Badge
            key={config.id}
            variant="outline"
            onClick={() => handleClick(config)}
            className={cn(
              "flex items-center gap-1.5 py-1 px-2 text-xs transition-all",
              isClickable && "cursor-pointer hover:scale-105",
              isSelected && "ring-2 ring-offset-1 shadow-md"
            )}
            style={{ 
              borderColor: config.cor,
              backgroundColor: isSelected ? `${config.cor}35` : `${config.cor}15`,
              // @ts-expect-error ringColor is valid CSS custom property
              '--tw-ring-color': isSelected ? config.cor : undefined,
            }}
          >
            <div 
              className={cn(
                "h-2.5 w-2.5 rounded-full flex-shrink-0 transition-transform",
                isSelected && "scale-125"
              )}
              style={{ backgroundColor: config.cor }}
            />
            <span className="whitespace-nowrap">{formatarTempoLegenda(config.tempoMinutos)}</span>
          </Badge>
        );
      })}
    </div>
  );
}
