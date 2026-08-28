import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CRMChatMessage {
  id: string;
  tipo_remetente: 'lead' | 'atendente' | 'ia';
  tipo_mensagem: 'texto' | 'audio' | 'imagem' | 'pdf';
  conteudo: string | null;
  url_midia: string | null;
  origem: 'crm' | 'webhook' | 'n8n';
  criado_em: string;
  lida: boolean;
}

export function useCRMChatMessages(telefone?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['crm-chat-messages', telefone],
    queryFn: async () => {
      if (!telefone) return [];

      const telefoneNormalizado = telefone.replace(/\D/g, '');
      console.log('📨 Buscando mensagens CRM para:', telefoneNormalizado);

      const { data, error } = await supabase
        .from('crm_multiempresas_chat_mensagens')
        .select('*')
        .eq('telefone', telefoneNormalizado)
        .order('criado_em', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens CRM:', error);
        throw error;
      }

      console.log(`📬 ${data?.length || 0} mensagens CRM encontradas`);
      return data as CRMChatMessage[];
    },
    enabled: !!telefone,
    staleTime: 30_000,
  });

  // Subscription para Realtime
  useEffect(() => {
    if (!telefone) return;

    const telefoneNormalizado = telefone.replace(/\D/g, '');
    
    console.log('🔔 Configurando Realtime para mensagens CRM...');

    const channel = supabase
      .channel(`crm-chat-${telefoneNormalizado}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_multiempresas_chat_mensagens',
          filter: `telefone=eq.${telefoneNormalizado}`
        },
        (payload) => {
          console.log('📩 Nova mensagem CRM recebida via Realtime:', payload);
          queryClient.setQueryData(['crm-chat-messages', telefone], (current: unknown) => {
            const list = Array.isArray(current) ? current : [];
            const row = payload.new as { id?: string };
            if (row?.id && list.some((m: { id?: string }) => m.id === row.id)) return list;
            return [...list, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 Removendo subscription Realtime...');
      supabase.removeChannel(channel);
    };
  }, [telefone, queryClient]);

  const refreshMessages = async () => {
    if (telefone) {
      await queryClient.invalidateQueries({ queryKey: ['crm-chat-messages', telefone] });
      return query.refetch();
    }
  };

  return {
    ...query,
    refreshMessages,
  };
}
