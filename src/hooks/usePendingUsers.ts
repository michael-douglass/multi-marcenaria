import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface PendingUser {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  criado_em: string;
  status_convite: string;
}

export function usePendingUsers() {
  const queryClient = useQueryClient();

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ['pending-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('CRM-multi-empresas>usuarios<')
        .select('id, nome, email, telefone, criado_em, status_convite')
        .eq('status_convite', 'PENDENTE')
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return data as PendingUser[];
    },
    refetchInterval: 30000,
  });

  const approveUser = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'vendedor' | 'nenhum' }) => {
      const { error } = await supabase.rpc('approve_user', {
        _user_id: userId,
        _new_role: role,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: 'Usuário aprovado',
        description: 'O usuário foi aprovado com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao aprovar usuário',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const rejectUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('reject_user', {
        _user_id: userId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      toast({
        title: 'Usuário recusado',
        description: 'O acesso do usuário foi recusado.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao recusar usuário',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    pendingUsers: pendingUsers || [],
    pendingCount: pendingUsers?.length || 0,
    isLoading,
    approveUser,
    rejectUser,
  };
}
