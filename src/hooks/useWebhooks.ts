import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Webhook {
  id: string;
  nome: string;
  tipo: string;
  tabela_origem: string | null;
  url: string;
  descricao: string | null;
  ativo: boolean | null;
  criado_em: string | null;
  atualizado_em: string | null;
}

export type WebhookInsert = Omit<Webhook, 'id' | 'criado_em' | 'atualizado_em'>;

// Mapeamento de região amigável para tabela de chat n8n (usada no webhook)
// Estes nomes devem corresponder aos "nome_amigavel" da tabela "CRM-multi-empresas>tabela_origem_config<"
export const REGIAO_TABELA_CHAT_MAP: Record<string, string> = {
  'Minas Gerais': 'n8n_chat_histories',
  'São Paulo': 'n8n_chat_histories_proforco_saopaulo',
};

// Mapeamento inverso: tabela de chat n8n para região amigável
export const TABELA_CHAT_REGIAO_MAP: Record<string, string> = {
  'n8n_chat_histories': 'Minas Gerais',
  'n8n_chat_histories_proforco_saopaulo': 'São Paulo',
};

// Lista de regiões disponíveis (nomes amigáveis)
export const REGIOES_DISPONIVEIS = ['Minas Gerais', 'São Paulo'] as const;

// Aliases para compatibilidade (deprecated - usar os novos nomes)
export const REGIAO_TABELA_MAP = REGIAO_TABELA_CHAT_MAP;
export const TABELA_REGIAO_MAP = TABELA_CHAT_REGIAO_MAP;

export function useWebhooks() {
  const queryClient = useQueryClient();

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('CRM-multi-empresas>webhooks_api<')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return data as Webhook[];
    },
  });

  const createWebhook = useMutation({
    mutationFn: async (newWebhook: WebhookInsert) => {
      const { data, error } = await supabase
        .from('CRM-multi-empresas>webhooks_api<')
        .insert(newWebhook)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar webhook', { description: error.message });
    },
  });

  const updateWebhook = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Webhook> }) => {
      const { data, error } = await supabase
        .from('CRM-multi-empresas>webhooks_api<')
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar webhook', { description: error.message });
    },
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('CRM-multi-empresas>webhooks_api<')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir webhook', { description: error.message });
    },
  });

  return {
    webhooks,
    isLoading,
    createWebhook,
    updateWebhook,
    deleteWebhook,
  };
}
