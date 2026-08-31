import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

export interface MarketingApprovalNotification {
  id: string;
  card_id: string;
  card_titulo: string;
  enviado_por: string | null;
  lida: boolean;
  criado_em: string;
}

export function useMarketingApprovalNotifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['marketing-approval-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_approval_notifications')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data as MarketingApprovalNotification[];
    },
  });

  // Realtime subscription para novas notificações
  useEffect(() => {
    const channelName = `marketing-approval-notifications-changes-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_multiempresas_marketing_approval_notifications',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['marketing-approval-notifications'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createNotification = useMutation({
    mutationFn: async ({ cardId, cardTitulo, enviadoPor }: { 
      cardId: string; 
      cardTitulo: string; 
      enviadoPor?: string;
    }) => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_approval_notifications')
        .insert({
          card_id: cardId,
          card_titulo: cardTitulo,
          enviado_por: enviadoPor || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-approval-notifications'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar notificação',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_approval_notifications')
        .update({ lida: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-approval-notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_approval_notifications')
        .update({ lida: true })
        .eq('lida', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-approval-notifications'] });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_approval_notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-approval-notifications'] });
    },
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('crm_multiempresas_marketing_approval_notifications')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-approval-notifications'] });
    },
  });

  const unreadCount = (query.data ?? []).filter(n => !n.lida).length;

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    unreadCount,
    createNotification: createNotification.mutateAsync,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    deleteNotification: deleteNotification.mutate,
    clearAll: clearAll.mutate,
  };
}
