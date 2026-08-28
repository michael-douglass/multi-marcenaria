import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWebhooks, Webhook } from './useWebhooks';

export interface MarketingAIWebhookConfig {
  id: string;
  webhook_id: string | null;
  descricao: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export function useMarketingAIWebhookConfig() {
  const queryClient = useQueryClient();
  const { webhooks } = useWebhooks();

  const { data: config, isLoading } = useQuery({
    queryKey: ['marketing-ai-webhook-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_marketing_ai_webhook_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as MarketingAIWebhookConfig | null;
    },
  });

  // Resolve webhook URL from webhook_id
  const selectedWebhook = config?.webhook_id 
    ? webhooks.find(w => w.id === config.webhook_id) 
    : null;

  const saveConfig = useMutation({
    mutationFn: async (webhookId: string) => {
      if (config) {
        // Update existing
        const { data, error } = await supabase
          .from('crm_multiempresas_marketing_ai_webhook_config')
          .update({ 
            webhook_id: webhookId,
            atualizado_em: new Date().toISOString()
          })
          .eq('id', config.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('crm_multiempresas_marketing_ai_webhook_config')
          .insert({ webhook_id: webhookId })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-ai-webhook-config'] });
      toast.success('Configuração do webhook salva com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar configuração', { description: error.message });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (ativo: boolean) => {
      if (!config) return;
      
      const { error } = await supabase
        .from('crm_multiempresas_marketing_ai_webhook_config')
        .update({ 
          ativo,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', config.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-ai-webhook-config'] });
    },
    onError: (error) => {
      toast.error('Erro ao alterar status', { description: error.message });
    },
  });

  return {
    config,
    isLoading,
    saveConfig,
    toggleActive,
    webhooks,
    selectedWebhook,
  };
}

export type AIGenerationType = 'Criar aleatoriamente' | 'Criar com Script' | 'Criar com sugestão';

export interface AIGenerationPayload {
  id: string;
  titulo: string;
  script_copy: string | null;
  column_id: string;
  tipo_geracao: AIGenerationType;
  sugestao?: string;
}

export async function dispatchAIWebhook(
  webhookUrl: string,
  payload: AIGenerationPayload
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook retornou status ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Erro ao disparar webhook de IA:', error);
    throw error;
  }
}
