import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Megaphone, 
  Send, 
  CheckCircle2, 
  Clock,
  CalendarDays,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { floatingPopupPositionClass } from '@/lib/floating-ui-layout';
import { format, addDays, subDays, isToday, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MarketingTask } from '@/hooks/useMarketingTasks';

interface FloatingMarketingCalendarPopupProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: MarketingTask[];
  onCompleteTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  isUpdating?: boolean;
}

export function FloatingMarketingCalendarPopup({ 
  isOpen, 
  onClose, 
  tasks,
  onCompleteTask,
  onDeleteTask,
  isUpdating 
}: FloatingMarketingCalendarPopupProps) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Filtrar tarefas do dia selecionado (apenas pendentes/em andamento)
  const tarefasDoDia = useMemo(() => {
    return tasks.filter((t) => {
      const taskDate = parseISO(t.data_agendada);
      return isSameDay(taskDate, selectedDate) && (t.status === 'pendente' || t.status === 'em_andamento');
    }).sort((a, b) => {
      const aTime = a.hora_agendada || '00:00';
      const bTime = b.hora_agendada || '00:00';
      return aTime.localeCompare(bTime);
    });
  }, [tasks, selectedDate]);

  const navigateDay = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => direction === 'next' ? addDays(prev, 1) : subDays(prev, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleNavigateToTask = (task: MarketingTask) => {
    // Navegar para a página de marketing com o card vinculado ou aba de calendário
    if (task.content_card_id) {
      navigate(`/marketing-conteudo?tab=kanban&card=${task.content_card_id}`);
    } else {
      navigate('/marketing-conteudo?tab=calendario');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay para fechar */}
      <div 
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />
      
      {/* Popup */}
      <div 
        className={cn(
          floatingPopupPositionClass,
          "w-[380px] h-[450px]",
          "bg-background border rounded-lg shadow-2xl",
          "flex flex-col",
          "animate-in slide-in-from-top-2 fade-in duration-200"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 rounded-t-lg">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">Calendário de Postagens</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navegação de Data */}
        <div className="p-3 border-b flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigateDay('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
            {isToday(selectedDate) && (
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300">
                Hoje
              </Badge>
            )}
          </div>
          
          <Button variant="ghost" size="icon" onClick={() => navigateDay('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Botão voltar para hoje */}
        {!isToday(selectedDate) && (
          <div className="px-3 pt-2">
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={goToToday}>
              Voltar para hoje
            </Button>
          </div>
        )}

        {/* Lista de Tarefas */}
        <ScrollArea className="flex-1 p-3">
          {tarefasDoDia.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Megaphone className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Nenhuma tarefa de postagem</p>
              <p className="text-xs">para esta data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tarefasDoDia.map((task) => (
                <div 
                  key={task.id} 
                  className={cn(
                    "p-3 rounded-lg border transition-all cursor-pointer group",
                    "bg-background hover:shadow-md hover:border-emerald-300"
                  )}
                  onClick={() => handleNavigateToTask(task)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Badges */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {task.tipo === 'produzir' ? (
                          <Badge className="bg-purple-600 text-xs py-0">
                            <Megaphone className="h-3 w-3 mr-1" />
                            Produzir
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-xs py-0">
                            <Send className="h-3 w-3 mr-1" />
                            Postar
                          </Badge>
                        )}
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-xs py-0">
                          <Clock className="h-3 w-3 mr-1" />
                          Pendente
                        </Badge>
                      </div>
                      
                      {/* Título */}
                      <p className="text-sm font-medium truncate">{task.titulo}</p>
                      
                      {/* Card vinculado */}
                      {task.content_card && (
                        <p className="text-xs text-primary mt-1 truncate flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          {task.content_card.titulo}
                        </p>
                      )}
                      
                      {/* Info */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {task.hora_agendada && (
                          <span>⏰ {task.hora_agendada.slice(0, 5)}</span>
                        )}
                        
                        {task.destinatario && (
                          <div className="flex items-center gap-1">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={task.destinatario.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {task.destinatario.nome?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{task.destinatario.nome}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex flex-col gap-1">
                      {/* Botão Concluir */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompleteTask(task.id);
                        }}
                        disabled={isUpdating}
                        title="Marcar como concluída"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      
                      {/* Botão Excluir */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTask(task.id);
                        }}
                        disabled={isUpdating}
                        title="Excluir tarefa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t bg-muted/30 rounded-b-lg">
          <p className="text-xs text-muted-foreground text-center">
            {tarefasDoDia.length} tarefa{tarefasDoDia.length !== 1 ? 's' : ''} para este dia
          </p>
        </div>
      </div>
    </>
  );
}
