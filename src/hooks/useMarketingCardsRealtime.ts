import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para sincronização em tempo real dos cards de marketing.
 * Quando qualquer card for criado, atualizado ou deletado,
 * todos os usuários conectados verão a mudança instantaneamente.
 */
export function useMarketingCardsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscription para mudanças nos cards de conteúdo
    const cardsChannel = supabase
      .channel('marketing-content-cards-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'crm_multiempresas_marketing_content_cards',
        },
        (payload) => {
          console.log('[Realtime] Card change detected:', payload.eventType);
          // Invalidar a query para refetch dos dados
          queryClient.invalidateQueries({ queryKey: ['marketing-content-cards'] });
        }
      )
      .subscribe();

    // Subscription para mudanças nas colunas (caso alguém crie/edite colunas)
    const columnsChannel = supabase
      .channel('marketing-columns-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_multiempresas_marketing_columns',
        },
        (payload) => {
          console.log('[Realtime] Column change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['marketing-columns'] });
        }
      )
      .subscribe();

    // Cleanup: remover subscriptions ao desmontar
    return () => {
      supabase.removeChannel(cardsChannel);
      supabase.removeChannel(columnsChannel);
    };
  }, [queryClient]);
}
