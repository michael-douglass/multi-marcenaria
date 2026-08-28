import { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMarketingTasks, MarketingTask } from '@/hooks/useMarketingTasks';
import { useMarketingContentCards } from '@/hooks/useMarketingConteudo';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { format, isSameDay, parseISO, isToday, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Megaphone, Send, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { MarketingTaskDialog } from './MarketingTaskDialog';
import { MarketingTaskCard } from './MarketingTaskCard';

export function MarketingCalendarTab() {
  const { tasks, isLoading, createTask, updateTask, deleteTask, completeTask } = useMarketingTasks();
  const { cards } = useMarketingContentCards();
  const { users } = useUsers();
  const { userRole, user } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MarketingTask | null>(null);

  // Filtrar usuários para perfil marketing (apenas marketing users ou o próprio)
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (userRole === 'marketing') {
      // Marketing user vê apenas usuários marketing ou a si mesmo
      return users.filter(u => u.role === 'marketing' || u.id === user?.id);
    }
    return users;
  }, [users, userRole, user?.id]);

  // Filter tasks for selected date
  const tasksForDate = useMemo(() => {
    return tasks.filter(task => {
      const taskDate = parseISO(task.data_agendada);
      return isSameDay(taskDate, selectedDate);
    });
  }, [tasks, selectedDate]);

  // Get dates that have tasks for calendar highlighting
  const datesWithTasks = useMemo(() => {
    const dates: Date[] = [];
    tasks.forEach(task => {
      dates.push(parseISO(task.data_agendada));
    });
    return dates;
  }, [tasks]);

  const handleCreateTask = () => {
    setEditingTask(null);
    setIsDialogOpen(true);
  };

  const handleEditTask = (task: MarketingTask) => {
    setEditingTask(task);
    setIsDialogOpen(true);
  };

  const handleSaveTask = async (taskData: any) => {
    if (editingTask) {
      await updateTask({ id: editingTask.id, ...taskData });
    } else {
      await createTask({
        ...taskData,
        data_agendada: taskData.data_agendada || format(selectedDate, 'yyyy-MM-dd'),
      });
    }
    setIsDialogOpen(false);
    setEditingTask(null);
  };

  const getTaskStats = () => {
    const pending = tasks.filter(t => t.status === 'pendente').length;
    const inProgress = tasks.filter(t => t.status === 'em_andamento').length;
    const completed = tasks.filter(t => t.status === 'concluido').length;
    return { pending, inProgress, completed };
  };

  const stats = getTaskStats();

  return (
    <div className="p-4 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Megaphone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-sm text-muted-foreground">Em Andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Concluídas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Calendário</CardTitle>
            <CardDescription>Selecione uma data para ver as tarefas</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={ptBR}
              modifiers={{
                hasTasks: datesWithTasks,
              }}
              modifiersStyles={{
                hasTasks: {
                  backgroundColor: 'hsl(var(--primary) / 0.1)',
                  fontWeight: 'bold',
                },
              }}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Tasks for Selected Date */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Tarefas de {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                {isToday(selectedDate) && (
                  <Badge variant="secondary">Hoje</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {tasksForDate.length} tarefa{tasksForDate.length !== 1 ? 's' : ''} agendada{tasksForDate.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button onClick={handleCreateTask} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Nova Tarefa
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : tasksForDate.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma tarefa para esta data</p>
                <p className="text-sm">Clique em "Nova Tarefa" para agendar</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {tasksForDate.map((task) => (
                    <MarketingTaskCard
                      key={task.id}
                      task={task}
                      onEdit={() => handleEditTask(task)}
                      onComplete={() => completeTask(task.id)}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task Dialog */}
      <MarketingTaskDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        task={editingTask}
        cards={cards}
        users={filteredUsers || []}
        selectedDate={selectedDate}
        onSave={handleSaveTask}
      />
    </div>
  );
}
