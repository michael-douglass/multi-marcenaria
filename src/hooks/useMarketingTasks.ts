import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface MarketingTask {
  id: string;
  titulo: string;
  descricao: string | null;
  content_card_id: string | null;
  destinatario_id: string;
  tipo: 'produzir' | 'postar';
  status: 'pendente' | 'em_andamento' | 'concluido' | 'cancelado';
  data_agendada: string;
  hora_agendada: string | null;
  concluido_em: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  // Joined data
  content_card?: {
    id: string;
    titulo: string;
  } | null;
  destinatario?: {
    id: string;
    nome: string;
    avatar_url: string | null;
  } | null;
}

export function useMarketingTasks() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['marketing-tasks'],
    queryFn: async () => {
      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('crm_multiempresas_marketing_tasks')
        .select('*')
        .order('data_agendada', { ascending: true });
      if (tasksError) throw tasksError;

      // Fetch content cards for joining
      const { data: cardsData } = await supabase
        .from('crm_multiempresas_marketing_content_cards')
        .select('id, titulo');

      // Fetch users for joining
      const { data: usersData } = await supabase
        .from('CRM-multi-empresas>usuarios<')
        .select('id, nome, avatar_url');

      // Join data manually
      const tasksWithJoins = tasksData.map(task => ({
        ...task,
        content_card: task.content_card_id 
          ? cardsData?.find(c => c.id === task.content_card_id) || null 
          : null,
        destinatario: usersData?.find(u => u.id === task.destinatario_id) || null,
      }));

      return tasksWithJoins as MarketingTask[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (task: {
      titulo: string;
      descricao?: string | null;
      content_card_id?: string | null;
      destinatario_id: string;
      tipo: 'produzir' | 'postar';
      data_agendada: string;
      hora_agendada?: string | null;
      criado_por?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_tasks')
        .insert({
          titulo: task.titulo,
          descricao: task.descricao ?? null,
          content_card_id: task.content_card_id ?? null,
          destinatario_id: task.destinatario_id,
          tipo: task.tipo,
          data_agendada: task.data_agendada,
          hora_agendada: task.hora_agendada ?? null,
          criado_por: task.criado_por ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as MarketingTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-tasks'] });
      toast({ title: 'Tarefa criada com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar tarefa', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketingTask> & { id: string }) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_tasks')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-tasks'] });
      toast({ title: 'Tarefa atualizada' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar tarefa', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-tasks'] });
      toast({ title: 'Tarefa removida' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover tarefa', description: error.message, variant: 'destructive' });
    },
  });

  const completeTask = async (id: string) => {
    await updateMutation.mutateAsync({ 
      id, 
      status: 'concluido', 
      concluido_em: new Date().toISOString() 
    });
  };

  return {
    tasks: query.data || [],
    isLoading: query.isLoading,
    createTask: createMutation.mutateAsync,
    updateTask: updateMutation.mutateAsync,
    deleteTask: deleteMutation.mutateAsync,
    completeTask,
  };
}
