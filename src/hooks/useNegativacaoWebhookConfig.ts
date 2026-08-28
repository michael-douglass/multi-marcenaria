import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface NegativacaoWebhookConfig {
  id: string;
  webhook_id: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export function useNegativacaoWebhookConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['negativacao-webhook-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_negativacao_webhook_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as NegativacaoWebhookConfig | null;
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<Pick<NegativacaoWebhookConfig, 'webhook_id' | 'ativo'>>) => {
      if (!config?.id) {
        // Criar novo registro se não existir
        const { data, error } = await supabase
          .from('crm_multiempresas_negativacao_webhook_config')
          .insert({ ...updates })
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('crm_multiempresas_negativacao_webhook_config')
        .update(updates)
        .eq('id', config.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negativacao-webhook-config'] });
      toast.success('Configuração salva!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar configuração', { description: error.message });
    },
  });

  return {
    config,
    isLoading,
    updateConfig,
  };
}
