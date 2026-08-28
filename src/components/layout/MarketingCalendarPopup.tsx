import { useState, useMemo } from 'react';
import { useMarketingTasks, MarketingTask } from '@/hooks/useMarketingTasks';
import { useMarketingContentCards } from '@/hooks/useMarketingConteudo';
import { useUsers } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Megaphone,
  Send,
  CheckCircle2,
  Clock,
  FileText,
  ExternalLink
} from 'lucide-react';
import { format, addDays, subDays, isToday, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { floatingPopupPositionClass } from '@/lib/floating-ui-layout';
import { useNavigate } from 'react-router-dom';

interface MarketingCalendarPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MarketingCalendarPopup({ isOpen, onClose }: MarketingCalendarPopupProps) {
  const navigate = useNavigate();
  const { tasks, completeTask } = useMarketingTasks();
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Filter tasks for selected date (only pending/in progress)
  const tasksForDate = useMemo(() => {
    return tasks.filter(task => {
      const taskDate = parseISO(task.data_agendada);
      return isSameDay(taskDate, selectedDate) && 
             (task.status === 'pendente' || task.status === 'em_andamento');
    }).sort((a, b) => {
      if (a.hora_agendada && b.hora_agendada) {
        return a.hora_agendada.localeCompare(b.hora_agendada);
      }
      return 0;
    });
  }, [tasks, selectedDate]);

  const navigateDay = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => direction === 'next' ? addDays(prev, 1) : subDays(prev, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const goToMarketingPage = () => {
    navigate('/marketing-conteudo');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={`${floatingPopupPositionClass} w-96 bg-background border rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-emerald-50 dark:bg-emerald-900/20 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
            <Megaphone className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">Marketing</h3>
            <p className="text-xs text-muted-foreground">Tarefas agendadas</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <Button variant="ghost" size="icon" onClick={() => navigateDay('prev')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
          </span>
          {isToday(selectedDate) && (
            <Badge variant="secondary" className="text-xs">Hoje</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isToday(selectedDate) && (
            <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs">
              Hoje
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => navigateDay('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tasks List */}
      <ScrollArea className="h-72">
        {tasksForDate.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">
              Nenhuma tarefa pendente para este dia
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {tasksForDate.map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
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
                      {task.hora_agendada && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.hora_agendada.slice(0, 5)}
                        </span>
                      )}
                    </div>
                    
                    <h4 className="font-medium text-sm truncate">{task.titulo}</h4>
                    
                    {task.content_card && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                        <FileText className="h-3 w-3" />
                        <span className="truncate">{task.content_card.titulo}</span>
                      </div>
                    )}

                    {task.destinatario && (
                      <div className="flex items-center gap-2 mt-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={task.destinatario.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {task.destinatario.nome?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                          {task.destinatario.nome}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      completeTask(task.id);
                    }}
                    title="Marcar como concluído"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t">
        <Button 
          variant="outline" 
          className="w-full gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
          onClick={goToMarketingPage}
        >
          <ExternalLink className="h-4 w-4" />
          Ver calendário completo
        </Button>
      </div>
    </div>
  );
}
