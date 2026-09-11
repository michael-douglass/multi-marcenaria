import { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, ChevronDown, Clock } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { isUntimedCalendarBlock } from '@/lib/calendar-event-layout';
import type { AgendaEvent } from '@/hooks/useAgendaGeral';

const EVENT_TYPE_LABELS: Record<AgendaEvent['type'], string> = {
  tarefa: 'Reunião',
  lembrete: 'Lembrete',
  pessoal: 'Pessoal',
  conteudo: 'Marketing',
};

interface AgendaGeralCompletedHistoryProps {
  events: AgendaEvent[];
  onSelectEvent: (event: AgendaEvent) => void;
  compact?: boolean;
}

export function AgendaGeralCompletedHistory({
  events,
  onSelectEvent,
  compact = false,
}: AgendaGeralCompletedHistoryProps) {
  const [open, setOpen] = useState(false);

  if (events.length === 0) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        'shrink-0 rounded-md border border-border/70 bg-muted/30',
        compact ? 'text-xs' : 'text-sm',
      )}
    >
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md',
          open && 'rounded-b-none border-b border-border/60',
        )}
      >
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <CheckCircle2 className={cn('shrink-0 text-emerald-600 dark:text-emerald-400', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          Histórico de tarefas concluídas
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal tabular-nums">
            {events.length}
          </Badge>
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div
          className={cn(
            'overflow-y-auto overscroll-contain',
            compact ? 'max-h-[min(160px,28vh)]' : 'max-h-[min(240px,36vh)]',
          )}
        >
          <ul className={cn('space-y-1', compact ? 'p-1.5' : 'p-2')}>
            {events.map((event) => {
              const untimed = isUntimedCalendarBlock(event);
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(event)}
                    className={cn(
                      'w-full rounded-md border border-transparent bg-background/80 text-left transition-colors hover:border-border hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      compact ? 'px-2 py-1.5' : 'px-2.5 py-2',
                    )}
                    title="Abrir tarefa concluída"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 font-medium leading-snug text-foreground/80 line-through opacity-80">
                        {event.title}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[10px] capitalize opacity-80">
                        {EVENT_TYPE_LABELS[event.type]}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        {untimed ? 'Sem horário' : format(event.start, 'HH:mm')}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
