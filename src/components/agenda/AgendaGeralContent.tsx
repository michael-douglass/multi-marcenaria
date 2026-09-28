import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAgendaGeral } from '@/hooks/useAgendaGeral';
import { FullCalendar } from './FullCalendar';
import { AgendaGeralSearch } from './AgendaGeralSearch';
import { AgendaGeralCompletedHistory } from './AgendaGeralCompletedHistory';
import { AgendaGeralTitularFilter } from './AgendaGeralTitularFilter';
import { AgendaCreateMenu } from './AgendaCreateMenu';
import { CreateTarefaPessoalDialog } from './CreateTarefaPessoalDialog';
import { EditReuniaoDialog } from './EditReuniaoDialog';
import { LeadLembreteDialog } from './LeadLembreteDialog';
import { MarketingTaskDialog } from '../marketing-conteudo/MarketingTaskDialog';
import { TarefaPessoalOcorrenciaDialog } from './TarefaPessoalOcorrenciaDialog';

interface AgendaGeralContentProps {
  compact?: boolean;
  className?: string;
  /** Zoom do painel flutuante (80–140%). Escala o calendário sem cortar cards. */
  zoomPercent?: number;
  /** Notifica o dia visível no calendário (para o botão Criar da página). */
  onSelectedDateChange?: (date: Date) => void;
}

export function AgendaGeralContent({
  compact = false,
  className,
  zoomPercent,
  onSelectedDateChange,
}: AgendaGeralContentProps) {
  // Painel flutuante: sempre só as tarefas do próprio titular.
  // Na página agenda-comercial o admin pode ampliar o filtro na UI.
  const agenda = useAgendaGeral({ forceOwnTitular: compact });
  const [createTarefaSlot, setCreateTarefaSlot] = useState<{
    date: Date;
    hora: string;
  } | null>(null);

  useEffect(() => {
    onSelectedDateChange?.(agenda.selectedDate);
  }, [agenda.selectedDate, onSelectedDateChange]);

  if (agenda.isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-20', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        compact ? 'flex flex-col gap-1.5 min-h-0' : 'space-y-4',
        className,
      )}
    >
      {!compact && agenda.isAdminAgendaGeral && agenda.adminGeralTitularFilter && (
        <AgendaGeralTitularFilter
          filter={agenda.adminGeralTitularFilter}
          onModeChange={(mode, titularId) =>
            agenda.saveAdminGeralTitularFilter.mutate({
              filter_mode: mode,
              filter_titular_id: titularId ?? null,
            })
          }
          isSaving={agenda.saveAdminGeralTitularFilter.isPending}
        />
      )}

      <AgendaGeralSearch
        searchTerm={agenda.searchTerm}
        onSearchTermChange={agenda.setSearchTerm}
        results={agenda.filteredEvents}
        onSelectResult={agenda.handleSearchResultSelect}
        compact={compact}
      />

      <AgendaGeralCompletedHistory
        events={agenda.completedEvents}
        onSelectEvent={agenda.handleSearchResultSelect}
        compact={compact}
      />

      <Card className={cn(compact && 'border-0 shadow-none flex-1 min-h-0 flex flex-col')}>
        <CardContent className={cn('p-0', compact && 'flex-1 min-h-0 flex flex-col relative')}>
          <FullCalendar
            events={agenda.calendarEvents}
            selectedDate={agenda.selectedDate}
            onSelectDate={agenda.setSelectedDate}
            onEditEvent={agenda.handleEditEvent}
            onCompleteEvent={agenda.handleCompleteEvent}
            onDeleteEvent={agenda.handleDeleteEvent}
            onEventDrop={agenda.handleEventDrop}
            onBulkReschedule={agenda.handleBulkReschedule}
            onBulkComplete={agenda.handleBulkComplete}
            isRescheduling={agenda.isRescheduling}
            focusDate={agenda.calendarFocusDate}
            onFocusDateApplied={() => agenda.setCalendarFocusDate(null)}
            compact={compact}
            zoomPercent={zoomPercent}
            floatingLayer={compact}
            onTimeSlotClick={
              compact
                ? (dateTime) =>
                    setCreateTarefaSlot({
                      date: dateTime,
                      hora: format(dateTime, 'HH:mm'),
                    })
                : undefined
            }
          />

          {compact && (
            <div
              className="absolute bottom-2 right-2 z-50 pointer-events-none"
              title="Criar tarefa, lembrete ou reunião no dia visível"
            >
              <div className="pointer-events-auto">
                <AgendaCreateMenu
                  variant="fab"
                  initialDate={agenda.selectedDate}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EditReuniaoDialog
        reuniao={agenda.editingReuniao}
        isOpen={!!agenda.editingReuniao}
        onClose={() => agenda.setEditingReuniao(null)}
        onSave={agenda.handleSaveReuniao}
        isLoading={agenda.updateReuniao.isPending}
        reunioes={agenda.reunioes}
        config={agenda.config || undefined}
        floatingLayer={compact}
      />

      {agenda.editingLembrete && (
        <LeadLembreteDialog
          open={!!agenda.editingLembrete}
          onOpenChange={(open) => !open && agenda.setEditingLembrete(null)}
          leadId={agenda.editingLembrete.lead_id}
          leadName={agenda.editingLembrete.lead?.nome || ''}
          lembrete={agenda.editingLembrete}
          floatingLayer={compact}
        />
      )}

      {agenda.editingMarketingTask && (
        <MarketingTaskDialog
          open={!!agenda.editingMarketingTask}
          onOpenChange={(open) => !open && agenda.setEditingMarketingTask(null)}
          task={agenda.editingMarketingTask}
          cards={agenda.cards}
          users={agenda.users ?? []}
          selectedDate={agenda.selectedDate}
          onSave={agenda.handleSaveMarketingTask}
          floatingLayer={compact}
        />
      )}

      <TarefaPessoalOcorrenciaDialog
        open={!!agenda.editingPessoal}
        onOpenChange={(open) => !open && agenda.setEditingPessoal(null)}
        eventData={agenda.editingPessoal}
        floatingLayer={compact}
      />

      {compact && (
        <CreateTarefaPessoalDialog
          open={!!createTarefaSlot}
          onOpenChange={(open) => !open && setCreateTarefaSlot(null)}
          initialDate={createTarefaSlot?.date}
          initialHora={createTarefaSlot?.hora}
          floatingLayer
        />
      )}
    </div>
  );
}
