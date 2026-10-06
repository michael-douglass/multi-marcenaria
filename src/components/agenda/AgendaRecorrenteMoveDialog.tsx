import { CalendarClock, Repeat } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { RecurringMoveScope } from '@/lib/agenda-postpone';

interface AgendaRecorrenteMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary?: string;
  onChoose: (scope: RecurringMoveScope) => void;
  isSaving?: boolean;
  floatingLayer?: boolean;
}

/**
 * Tarefa que se repete: escolher se o novo dia/horário vale só nesta vez
 * ou se a série fixa muda para sempre.
 */
export function AgendaRecorrenteMoveDialog({
  open,
  onOpenChange,
  summary,
  onChoose,
  isSaving = false,
  floatingLayer = false,
}: AgendaRecorrenteMoveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent floatingLayer={floatingLayer}>
        <AlertDialogHeader>
          <AlertDialogTitle>Mover tarefa fixa</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Esta tarefa se repete. Você quer mudar só desta vez, ou alterar o horário
                fixo de todas as vezes?
              </p>
              {summary ? (
                <p className="rounded-md border bg-muted/50 px-3 py-2 text-foreground">{summary}</p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            className="w-full justify-start gap-2"
            onClick={() => onChoose('occurrence')}
          >
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span className="text-left">
              <span className="block font-medium text-foreground">Só desta vez</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Move esta ocorrência. A tarefa fixa continua no horário original.
              </span>
            </span>
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            className="w-full justify-start gap-2"
            onClick={() => onChoose('series')}
          >
            <Repeat className="h-4 w-4 shrink-0" />
            <span className="text-left">
              <span className="block font-medium">Permanentemente</span>
              <span className="block text-xs font-normal text-primary-foreground/80">
                Altera a tarefa fixa. Todas as vezes passam a usar este horário.
              </span>
            </span>
          </Button>
          <AlertDialogCancel disabled={isSaving} className="mt-1">
            Cancelar
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
