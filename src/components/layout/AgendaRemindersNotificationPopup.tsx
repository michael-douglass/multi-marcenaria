import { useCallback, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit2,
  Minimize2,
  Phone,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { floatingPopupPositionClass, floatingReminderPanelMaxHeightClass } from '@/lib/floating-ui-layout';
import type { AgendaReminderNotificationItem } from '@/lib/agenda-reminder-notifications';
import { LeadLembreteDialog } from '@/components/agenda/LeadLembreteDialog';
import { TarefaPessoalOcorrenciaDialog } from '@/components/agenda/TarefaPessoalOcorrenciaDialog';
import type { LeadLembrete } from '@/hooks/useLeadLembretes';
import type { TarefaPessoal } from '@/hooks/useAgendaPessoal';

interface AgendaRemindersNotificationPopupProps {
  items: AgendaReminderNotificationItem[];
  onDismiss: (key: string) => void;
  onDismissAll: () => void;
  onCollapse: () => void;
  onCompleteLembrete: (id: string) => void;
  onCompleteTarefa: (tarefa: TarefaPessoal, dataOcorrencia: string) => void;
  onItemCompleted: (key: string) => void;
}

export function AgendaRemindersNotificationPopup({
  items,
  onDismiss,
  onDismissAll,
  onCollapse,
  onCompleteLembrete,
  onCompleteTarefa,
  onItemCompleted,
}: AgendaRemindersNotificationPopupProps) {
  const [editingLembrete, setEditingLembrete] = useState<LeadLembrete | null>(null);
  const [editingTarefa, setEditingTarefa] = useState<{
    tarefa: TarefaPessoal;
    dataOcorrencia: Date;
  } | null>(null);

  const handleCollapse = useCallback(() => {
    onCollapse();
  }, [onCollapse]);

  if (items.length === 0) return null;

  const handleComplete = (item: AgendaReminderNotificationItem) => {
    if (item.kind === 'lembrete' && item.lembrete) {
      onCompleteLembrete(item.lembrete.id);
    } else if (item.kind === 'agenda_pessoal' && item.tarefa && item.dataOcorrencia) {
      onCompleteTarefa(item.tarefa, item.dataOcorrencia);
    }
    onItemCompleted(item.key);
  };

  const handleEdit = (item: AgendaReminderNotificationItem) => {
    if (item.kind === 'lembrete' && item.lembrete) {
      setEditingLembrete(item.lembrete);
      return;
    }
    if (item.kind === 'agenda_pessoal' && item.tarefa && item.dataOcorrencia) {
      setEditingTarefa({
        tarefa: item.tarefa,
        dataOcorrencia: new Date(`${item.dataOcorrencia}T00:00:00`),
      });
    }
  };

  return (
    <>
      <div
        className={cn(
          floatingPopupPositionClass,
          'flex flex-col w-[min(360px,calc(100vw-2rem))] pointer-events-auto gap-2 overflow-y-auto',
          floatingReminderPanelMaxHeightClass,
        )}
        role="region"
        aria-label="Lembretes e notificações da agenda"
        aria-live="polite"
        aria-expanded
      >
        <div className="flex items-center justify-end gap-1 shrink-0 px-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] px-2 text-muted-foreground"
            onClick={onDismissAll}
          >
            Fechar todos
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCollapse}
            title="Recolher para ícone"
            aria-label="Recolher painel de lembretes"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>

        {items.map((item) => {
          const isLembrete = item.kind === 'lembrete';
          return (
            <div
              key={item.key}
              className={cn(
                'rounded-xl border p-3 shadow-xl animate-in slide-in-from-right-5 fade-in duration-300',
                'bg-background/50 backdrop-blur-xl border-border/50',
                isLembrete ? 'border-l-4 border-l-amber-500/80' : 'border-l-4 border-l-violet-500/80',
              )}
            >
              <div className="flex items-start gap-2">
                <div
                  className={cn(
                    'p-1.5 rounded-full shrink-0',
                    isLembrete ? 'bg-amber-500/90' : 'bg-violet-500/90',
                  )}
                >
                  {isLembrete ? (
                    <Bell className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <ClipboardList className="h-3.5 w-3.5 text-white" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4 bg-background/40"
                    >
                      {isLembrete ? 'Lembrete' : 'Agenda pessoal'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {format(item.dueAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  <p className="font-semibold text-sm leading-snug">{item.titulo}</p>

                  {isLembrete && item.lembrete?.lead && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{item.lembrete.lead.nome}</span>
                    </div>
                  )}

                  {item.descricao && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {item.descricao}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  className="p-1 rounded-full hover:bg-muted/60 shrink-0 text-muted-foreground"
                  title="Fechar"
                  onClick={() => onDismiss(item.key)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-border/30">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 flex-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                  onClick={() => handleComplete(item)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Concluir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 flex-1 text-xs"
                  onClick={() => handleEdit(item)}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {editingLembrete && (
        <LeadLembreteDialog
          open={!!editingLembrete}
          onOpenChange={(open) => !open && setEditingLembrete(null)}
          leadId={editingLembrete.lead_id}
          leadName={editingLembrete.lead?.nome || 'Lead'}
          lembrete={editingLembrete}
        />
      )}

      {editingTarefa && (
        <TarefaPessoalOcorrenciaDialog
          open={!!editingTarefa}
          onOpenChange={(open) => !open && setEditingTarefa(null)}
          eventData={{
            ...editingTarefa.tarefa,
            dataOcorrencia: editingTarefa.dataOcorrencia,
          }}
        />
      )}
    </>
  );
}
