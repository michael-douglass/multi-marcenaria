import { useState, useMemo } from 'react';
import { format, addDays, subDays, isToday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  User,
  CheckCircle2,
  Pencil,
  ExternalLink,
  Repeat,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { floatingPopupPositionClass } from '@/lib/floating-ui-layout';
import type { TarefaPessoal } from '@/hooks/useAgendaPessoal';
import type { OcorrenciaTarefa } from '@/lib/agenda-pessoal-recorrencia';
import { getOcorrenciasNoDia } from '@/lib/agenda-pessoal-recorrencia';
import {
  TarefaPessoalOcorrenciaDialog,
  type PessoalAgendaEventData,
} from '@/components/agenda/TarefaPessoalOcorrenciaDialog';

interface FloatingAgendaPessoalPopupProps {
  isOpen: boolean;
  onClose: () => void;
  tarefas: TarefaPessoal[];
  onConcluirOcorrencia: (tarefa: TarefaPessoal, dataOcorrencia: string, concluida: boolean) => void;
}

export function FloatingAgendaPessoalPopup({
  isOpen,
  onClose,
  tarefas,
  onConcluirOcorrencia,
}: FloatingAgendaPessoalPopupProps) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dialogEvent, setDialogEvent] = useState<PessoalAgendaEventData | null>(null);

  // Get pending occurrences for selected date, ordered by time
  const ocorrenciasDoDia = useMemo(() => {
    const day = startOfDay(selectedDate);
    const pendentes = getOcorrenciasNoDia(tarefas, day).filter((o) => !o.concluida);
    return [...pendentes].sort((a, b) => {
      const ha = a.tarefa.hora || '';
      const hb = b.tarefa.hora || '';
      if (!ha && !hb) return 0;
      if (!ha) return 1;
      if (!hb) return -1;
      return ha.localeCompare(hb);
    });
  }, [tarefas, selectedDate]);

  const navigateDay = (direction: 'prev' | 'next') => {
    setSelectedDate((prev) => (direction === 'next' ? addDays(prev, 1) : subDays(prev, 1)));
  };

  const goToToday = () => setSelectedDate(new Date());

  const openOcorrenciaDialog = (oc: OcorrenciaTarefa) => {
    setDialogEvent({
      ...oc.tarefa,
      dataOcorrencia: oc.dataOcorrencia,
    });
  };

  const handleConcluir = (oc: OcorrenciaTarefa) => {
    const dateStr = format(oc.dataOcorrencia, 'yyyy-MM-dd');
    onConcluirOcorrencia(oc.tarefa, dateStr, true);
  };

  const handleGoToAgenda = () => {
    navigate('/agenda-comercial');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={cn(
          floatingPopupPositionClass,
          'w-[380px] h-[500px]',
          'bg-background border rounded-lg shadow-2xl',
          'flex flex-col',
          'animate-in slide-in-from-top-2 fade-in duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30 rounded-t-lg">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-violet-500" />
            <h3 className="font-semibold text-sm">Agenda Pessoal</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoToAgenda}
              className="h-7 w-7"
              title="Ir para Agenda Pessoal"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between p-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => navigateDay('prev')} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {isToday(selectedDate) ? 'Hoje' : format(selectedDate, 'EEEE', { locale: ptBR })}
            </span>
            <span className="text-muted-foreground text-sm">
              {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
            </span>
            {!isToday(selectedDate) && (
              <Button variant="outline" size="sm" onClick={goToToday} className="h-6 text-xs ml-2">
                Hoje
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigateDay('next')} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Counter */}
        <div className="px-4 py-2 bg-muted/20 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tarefas pendentes</span>
            <Badge variant={ocorrenciasDoDia.length > 0 ? 'destructive' : 'secondary'}>
              {ocorrenciasDoDia.length}
            </Badge>
          </div>
        </div>

        {/* Task list – scrollable vertically and horizontally */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2 min-w-[360px]">
            {ocorrenciasDoDia.length > 0 ? (
              ocorrenciasDoDia.map((oc, idx) => (
                <div
                  key={`${oc.tarefa.id}-${idx}`}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div
                      className="flex-1 cursor-pointer min-w-0"
                      onClick={() => handleGoToAgenda()}
                    >
                      <h4 className="font-medium text-sm whitespace-normal break-words">
                        {oc.tarefa.titulo}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {oc.tarefa.tipo_agendamento === 'recorrente' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          <Repeat className="h-3 w-3 mr-0.5" />
                          Rec.
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          openOcorrenciaDialog(oc);
                        }}
                        title="Editar tarefa"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-green-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConcluir(oc);
                        }}
                        title="Concluir tarefa"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div
                    className="space-y-1 text-xs text-muted-foreground cursor-pointer whitespace-normal break-words"
                    onClick={() => openOcorrenciaDialog(oc)}
                  >
                    {oc.tarefa.hora && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span>{oc.tarefa.hora}</span>
                      </div>
                    )}
                    {oc.tarefa.titular_nome && (
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 flex-shrink-0" />
                        <span>{oc.tarefa.titular_nome}</span>
                      </div>
                    )}
                    {oc.tarefa.descricao && (
                      <p className="text-muted-foreground/80 line-clamp-2 italic mt-1 whitespace-pre-wrap break-words">
                        {oc.tarefa.descricao}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhuma tarefa pendente</p>
                <p className="text-xs">
                  para {isToday(selectedDate) ? 'hoje' : format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <TarefaPessoalOcorrenciaDialog
        open={!!dialogEvent}
        onOpenChange={(open) => !open && setDialogEvent(null)}
        eventData={dialogEvent}
        floatingLayer
      />
    </>
  );
}
