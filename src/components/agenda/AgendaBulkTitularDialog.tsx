import { useEffect, useMemo, useState } from 'react';
import { Loader2, UserRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AgendaTitularCombobox } from '@/components/agenda/AgendaTitularCombobox';
import { useAuth } from '@/contexts/AuthContext';
import { useTitularesAgenda } from '@/hooks/useTitularesAgenda';
import {
  eventSupportsBulkTitularChange,
  type AgendaEvent,
} from '@/hooks/useAgendaGeral';

interface AgendaBulkTitularDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: AgendaEvent[];
  isSubmitting?: boolean;
  floatingLayer?: boolean;
  onConfirm: (titularId: string, titularNome: string) => Promise<void> | void;
}

export function AgendaBulkTitularDialog({
  open,
  onOpenChange,
  events,
  isSubmitting = false,
  floatingLayer,
  onConfirm,
}: AgendaBulkTitularDialogProps) {
  const { user } = useAuth();
  const { titulares } = useTitularesAgenda();
  const [titularId, setTitularId] = useState(user?.id ?? '');

  useEffect(() => {
    if (!open) return;
    setTitularId(user?.id ?? '');
  }, [open, user?.id]);

  const summary = useMemo(() => {
    let eligible = 0;
    let skipped = 0;
    for (const event of events) {
      if (eventSupportsBulkTitularChange(event)) eligible += 1;
      else skipped += 1;
    }
    return { eligible, skipped };
  }, [events]);

  const selectedNome = useMemo(
    () => titulares.find((t) => t.id === titularId)?.nome ?? '',
    [titulares, titularId],
  );

  const canSubmit =
    !!titularId && summary.eligible > 0 && events.length > 0 && !isSubmitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    await onConfirm(titularId, selectedNome);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        nested={!floatingLayer}
        floatingLayer={floatingLayer}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Mudar titularidade</DialogTitle>
          <DialogDescription>
            Escolha o novo titular das tarefas selecionadas. Itens de marketing não entram nesta
            transferência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>Novo titular</Label>
            <AgendaTitularCombobox
              value={titularId}
              onChange={setTitularId}
              elevated={floatingLayer}
              disabled={isSubmitting}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {summary.eligible > 0
              ? `${summary.eligible} ${
                  summary.eligible === 1 ? 'tarefa será transferida' : 'tarefas serão transferidas'
                }`
              : 'Nenhuma tarefa selecionada aceita troca de titular'}
            {summary.skipped > 0 &&
              ` · ${summary.skipped} ${
                summary.skipped === 1 ? 'será ignorada' : 'serão ignoradas'
              } (ex.: marketing)`}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={!canSubmit} className="gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <UserRound className="h-4 w-4" />
                Transferir {summary.eligible}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
