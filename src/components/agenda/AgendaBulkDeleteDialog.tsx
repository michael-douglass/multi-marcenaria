import { useMemo } from 'react';
import { CalendarX2, Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  isRecurringPessoalEvent,
  type AgendaEvent,
  type BulkDeleteScope,
} from '@/hooks/useAgendaGeral';

interface AgendaBulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: AgendaEvent[];
  isSubmitting?: boolean;
  floatingLayer?: boolean;
  onConfirm: (scope: BulkDeleteScope) => Promise<void> | void;
}

export function AgendaBulkDeleteDialog({
  open,
  onOpenChange,
  events,
  isSubmitting = false,
  floatingLayer,
  onConfirm,
}: AgendaBulkDeleteDialogProps) {
  const recurringCount = useMemo(
    () => events.filter(isRecurringPessoalEvent).length,
    [events],
  );
  const hasRecurring = recurringCount > 0;
  const total = events.length;

  const handleConfirm = async (scope: BulkDeleteScope) => {
    if (total === 0 || isSubmitting) return;
    await onConfirm(scope);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        nested={!floatingLayer}
        floatingLayer={floatingLayer}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Excluir tarefas selecionadas</DialogTitle>
          <DialogDescription>
            {hasRecurring
              ? `Você selecionou ${total} ${total === 1 ? 'tarefa' : 'tarefas'} (${recurringCount} ${
                  recurringCount === 1 ? 'recorrente' : 'recorrentes'
                }). Escolha se remove só deste dia ou de forma permanente.`
              : `Confirma excluir ${total} ${total === 1 ? 'tarefa' : 'tarefas'} de forma permanente? Esta ação não pode ser desfeita.`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          {hasRecurring ? (
            <>
              <Button
                type="button"
                variant="secondary"
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={total === 0 || isSubmitting}
                onClick={() => void handleConfirm('day')}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarX2 className="h-4 w-4" />
                )}
                Só neste dia
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                disabled={total === 0 || isSubmitting}
                onClick={() => void handleConfirm('permanent')}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir permanente
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={total === 0 || isSubmitting}
              onClick={() => void handleConfirm('permanent')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Excluir {total}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
