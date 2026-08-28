import { useMemo, useState } from 'react';
import { useMarketingTasks, MarketingTask } from '@/hooks/useMarketingTasks';
import { useUsers } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  CalendarDays, 
  ChevronDown, 
  Plus, 
  Megaphone, 
  Send, 
  CheckCircle2, 
  Clock,
  Trash2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MarketingTaskDialog } from './MarketingTaskDialog';
import { MarketingContentCard } from '@/hooks/useMarketingConteudo';

interface CardTasksSectionProps {
  card: MarketingContentCard;
  allCards: MarketingContentCard[];
}

export function CardTasksSection({ card, allCards }: CardTasksSectionProps) {
  const { tasks, createTask, deleteTask, completeTask } = useMarketingTasks();
  const { users } = useUsers();
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filter tasks related to this card
  const cardTasks = useMemo(() => {
    return tasks.filter(task => task.content_card_id === card.id);
  }, [tasks, card.id]);

  const pendingTasks = cardTasks.filter(t => t.status === 'pendente' || t.status === 'em_andamento');
  const completedTasks = cardTasks.filter(t => t.status === 'concluido');

  const handleSaveTask = async (taskData: any) => {
    await createTask({
      ...taskData,
      content_card_id: card.id,
      data_agendada: taskData.data_agendada || format(new Date(), 'yyyy-MM-dd'),
    });
    setIsDialogOpen(false);
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-between bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800"
          >
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                Agendamentos ({cardTasks.length})
              </span>
              {pendingTasks.length > 0 && (
                <Badge className="bg-emerald-600 text-xs">
                  {pendingTasks.length} pendente{pendingTasks.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <ChevronDown className={`h-4 w-4 text-emerald-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="bg-muted/50 rounded-lg p-4 border space-y-3">
            {/* Add Task Button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full gap-2 border-dashed"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Agendar Tarefa
            </Button>

            {/* Task List */}
            {cardTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum agendamento para este conteúdo
              </p>
            ) : (
              <div className="space-y-2">
                {cardTasks.map(task => (
                  <div 
                    key={task.id} 
                    className="bg-background rounded-lg p-3 border flex items-start justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
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
                        {task.status === 'concluido' ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs py-0">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Concluído
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-xs py-0">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm font-medium truncate">{task.titulo}</p>
                      
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>
                          {format(parseISO(task.data_agendada), "dd/MM/yyyy", { locale: ptBR })}
                          {task.hora_agendada && ` às ${task.hora_agendada.slice(0, 5)}`}
                        </span>
                        
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

                    <div className="flex flex-col gap-1">
                      {task.status !== 'concluido' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-emerald-600"
                          onClick={() => completeTask(task.id)}
                          title="Concluir"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => deleteTask(task.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Task Dialog */}
      <MarketingTaskDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        task={null}
        cards={allCards}
        users={users || []}
        selectedDate={new Date()}
        defaultCardId={card.id}
        onSave={handleSaveTask}
      />
    </>
  );
}
