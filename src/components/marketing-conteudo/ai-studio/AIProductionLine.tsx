import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Feather,
  FileText,
  Lightbulb,
  Megaphone,
  Search,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketingAIGenerationType } from '@/hooks/useMarketingAIStudio';

export interface ProductionStation {
  id: string;
  label: string;
  detail: string;
  icon: typeof Search;
}

interface AIProductionLineProps {
  mode: MarketingAIGenerationType | null;
  personalityNome?: string | null;
  /** Quando true, marca todas as estações como concluídas */
  completed?: boolean;
}

function stationsForMode(
  mode: MarketingAIGenerationType | null,
  personalityNome?: string | null,
): ProductionStation[] {
  const voz = personalityNome?.trim() || 'voz escolhida';

  if (mode === 'Criar com Script') {
    return [
      {
        id: 'script',
        label: 'Script base',
        detail: 'Lendo o rascunho do card',
        icon: FileText,
      },
      {
        id: 'voz',
        label: 'Voz',
        detail: `Aplicando ${voz}`,
        icon: Feather,
      },
      {
        id: 'rewrite',
        label: 'Reescrita',
        detail: 'Aprimorando clareza e ritmo',
        icon: Sparkles,
      },
      {
        id: 'cta',
        label: 'CTA',
        detail: 'Fechamento alinhado à voz',
        icon: Megaphone,
      },
    ];
  }

  // Aleatório e Com sugestão: tema → pesquisa → briefing → voz → copy → CTA
  return [
    {
      id: 'tema',
      label: mode === 'Criar com sugestão' ? 'Tema' : 'Semente',
      detail:
        mode === 'Criar com sugestão'
          ? 'Usando a sugestão informada'
          : 'Sorteando pilar do dia',
      icon: Lightbulb,
    },
    {
      id: 'pesquisa',
      label: 'Pesquisa',
      detail: 'Buscando fatos e ângulos',
      icon: Search,
    },
    {
      id: 'briefing',
      label: 'Briefing',
      detail: 'Montando resumo estratégico',
      icon: FileText,
    },
    {
      id: 'voz',
      label: 'Voz',
      detail: `Escrevendo como ${voz}`,
      icon: Feather,
    },
    {
      id: 'copy',
      label: 'Copy',
      detail: 'Gancho → promessa → entrega',
      icon: Sparkles,
    },
    {
      id: 'cta',
      label: 'CTA',
      detail: 'Fechamento da personalidade',
      icon: Megaphone,
    },
  ];
}

/**
 * Painel visual da “linha de produção” durante a geração.
 * Avança as estações enquanto a API trabalha (progresso estimado).
 */
export function AIProductionLine({
  mode,
  personalityNome,
  completed = false,
}: AIProductionLineProps) {
  const stations = useMemo(
    () => stationsForMode(mode, personalityNome),
    [mode, personalityNome],
  );

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [mode, personalityNome]);

  useEffect(() => {
    if (completed) {
      setActiveIndex(stations.length);
      return;
    }

    // Progresso estimado: pesquisa+copy costuma levar 15–40s
    const stepMs =
      mode === 'Criar com Script'
        ? 2200
        : mode === 'Criar com sugestão'
          ? 3200
          : 3500;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => {
        // Não marca a última como “feita” até a API terminar
        if (prev >= stations.length - 1) return prev;
        return prev + 1;
      });
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [completed, mode, stations.length]);

  const currentLabel =
    completed
      ? 'Roteiro pronto'
      : stations[Math.min(activeIndex, stations.length - 1)]?.label ?? '…';

  return (
    <div className="studio-reveal w-full space-y-4 py-2 text-left">
      <div className="text-center">
        <p className="font-serif text-lg">Linha de produção</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {completed ? 'Todas as estações concluídas' : `Estação: ${currentLabel}`}
        </p>
      </div>

      <ol className="space-y-2" aria-label="Estações da geração">
        {stations.map((station, index) => {
          const Icon = station.icon;
          const isDone = completed || index < activeIndex;
          const isActive = !completed && index === activeIndex;
          const isPending = !isDone && !isActive;

          return (
            <li
              key={station.id}
              className={cn(
                'studio-station flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                isActive &&
                  'border-amber-800/40 bg-amber-50/90 dark:border-amber-400/35 dark:bg-amber-950/40',
                isDone &&
                  !isActive &&
                  'border-emerald-700/25 bg-emerald-50/50 dark:border-emerald-400/20 dark:bg-emerald-950/20',
                isPending && 'border-border/60 bg-background/50 opacity-60',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  isActive && 'studio-writing-pulse bg-amber-900 text-amber-50',
                  isDone && !isActive && 'bg-emerald-700 text-emerald-50',
                  isPending && 'bg-muted text-muted-foreground',
                )}
                aria-hidden
              >
                {isDone && !isActive ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{station.label}</p>
                <p className="text-xs text-muted-foreground">{station.detail}</p>
              </div>
              {isActive ? (
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  agora
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
