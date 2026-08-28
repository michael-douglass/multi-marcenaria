import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
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

const STATUS_EM_ABERTO = new Set<AgendaEvent['status']>(['pendente', 'confirmado', 'em_andamento']);

function isEventoEmAberto(event: AgendaEvent) {
  return STATUS_EM_ABERTO.has(event.status);
}

interface AgendaGeralSearchProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  results: AgendaEvent[];
  onSelectResult: (event: AgendaEvent) => void;
  compact?: boolean;
}

function getEventTypeColor(type: AgendaEvent['type']) {
  switch (type) {
    case 'tarefa':
      return 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800';
    case 'lembrete':
      return 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800';
    case 'pessoal':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800';
    case 'conteudo':
      return 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800';
  }
}

export function AgendaGeralSearch({
  searchTerm,
  onSearchTermChange,
  results,
  onSelectResult,
  compact = false,
}: AgendaGeralSearchProps) {
  const isSearching = searchTerm.trim().length > 0;

  const sortedResults = useMemo(
    () =>
      [...results].sort((a, b) => {
        const aAberto = isEventoEmAberto(a) ? 0 : 1;
        const bAberto = isEventoEmAberto(b) ? 0 : 1;
        if (aAberto !== bAberto) return aAberto - bAberto;
        return a.start.getTime() - b.start.getTime();
      }),
    [results],
  );

  return (
    <div className="relative z-20 shrink-0">
      <Search
        className={cn(
          'absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none',
          compact ? 'h-3.5 w-3.5' : 'left-3 h-4 w-4',
        )}
      />
      <Input
        value={searchTerm}
        onChange={(e) => onSearchTermChange(e.target.value)}
        placeholder={compact ? 'Buscar tarefas...' : 'Buscar por nome, horários, valores e detalhes das tarefas...'}
        className={cn(compact ? 'h-8 pl-8 text-xs' : 'pl-9')}
        lang="pt-BR"
        role="combobox"
        aria-expanded={isSearching}
        aria-autocomplete="list"
      />

      {isSearching && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 rounded-md border bg-popover text-popover-foreground shadow-lg overflow-hidden"
          role="listbox"
        >
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">
            {sortedResults.length === 0
              ? 'Nenhum evento encontrado'
              : `${sortedResults.length} ${
                  sortedResults.length === 1 ? 'evento encontrado' : 'eventos encontrados'
                } — de qualquer dia`}
          </div>

          {sortedResults.length > 0 && (
            // overflow-y-auto (não ScrollArea): max-h sozinho não cria scroll no Viewport do Radix.
            <div
              className={cn(
                'overflow-y-auto overscroll-contain',
                compact ? 'max-h-[min(220px,35vh)]' : 'max-h-[min(360px,50vh)]',
              )}
            >
              <ul className="p-1.5 space-y-1">
                {sortedResults.map((event) => {
                  const untimed = isUntimedCalendarBlock(event);
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        role="option"
                        onClick={() => onSelectResult(event)}
                        className={cn(
                          'w-full text-left rounded-md border p-2.5 transition-colors hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          getEventTypeColor(event.type),
                          event.status === 'concluido' && 'opacity-70',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              'text-sm font-medium leading-snug line-clamp-2',
                              event.status === 'concluido' && 'line-through',
                            )}
                          >
                            {event.title}
                          </span>
                          <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                            {EVENT_TYPE_LABELS[event.type]}
                          </Badge>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] opacity-90">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {format(event.start, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" />
                            {untimed
                              ? 'Sem horário definido'
                              : `${format(event.start, 'HH:mm')} – ${format(event.end, 'HH:mm')}`}
                          </span>
                        </div>

                        {event.description && (
                          <p className="mt-1 text-[11px] opacity-80 line-clamp-2">{event.description}</p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
