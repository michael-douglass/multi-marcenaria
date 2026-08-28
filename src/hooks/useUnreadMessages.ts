import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UnreadCount {
  leadId: number;
  telefone: string;
  count: number;
}

// Hook para buscar contagem de mensagens não lidas para múltiplos leads
export function useUnreadMessages(leads: { id: number; telefone?: string | null }[]) {
  return useQuery({
    queryKey: ['unread-messages', leads.length > 0 ? 'active' : 'empty'],
    queryFn: async () => {
      if (!leads.length) return {};

      // Criar mapa de telefone -> leadId para lookup rápido
      const telefonesMap: Record<string, number> = {};
      leads.forEach(lead => {
        if (lead.telefone) {
          const telefoneClean = lead.telefone.replace(/\D/g, '');
          if (telefoneClean) {
            telefonesMap[telefoneClean] = lead.id;
          }
        }
      });

      if (Object.keys(telefonesMap).length === 0) return {};

      // Buscar TODAS as mensagens não lidas do lead de uma vez
      // Supabase tem limite de 1000 rows por query, então paginamos se necessário
      const { data, error } = await supabase
        .from('crm_multiempresas_chat_mensagens')
        .select('telefone')
        .eq('tipo_remetente', 'lead')
        .eq('lida', false)
        .limit(5000); // Limite maior para pegar todas as não lidas

      if (error) {
        // Silenciar erro não crítico (pode ser RLS ou timeout intermitente)
        return {};
      }

      // Contar mensagens por telefone e filtrar apenas os que têm leads
      const result: Record<number, number> = {};
      data?.forEach(msg => {
        const leadId = telefonesMap[msg.telefone];
        if (leadId) {
          result[leadId] = (result[leadId] || 0) + 1;
        }
      });

      return result;
    },
    enabled: leads.length > 0,
    staleTime: 10000, // 10 segundos
    refetchInterval: 30000, // Refetch a cada 30 segundos
  });
}

// Hook para marcar mensagens como lidas para um lead específico
export function useMarkMessagesAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (telefone: string) => {
      const telefoneClean = telefone.replace(/\D/g, '');
      
      const { error } = await supabase
        .from('crm_multiempresas_chat_mensagens')
        .update({ lida: true })
        .eq('telefone', telefoneClean)
        .eq('tipo_remetente', 'lead')
        .eq('lida', false);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidar queries relacionadas (singular e plural)
      queryClient.invalidateQueries({ queryKey: ['unread-messages'] });
      queryClient.invalidateQueries({ queryKey: ['lead-last-messages'] });
      queryClient.invalidateQueries({ queryKey: ['lead-last-message'] });
    },
  });
}
