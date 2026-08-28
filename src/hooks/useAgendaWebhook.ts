import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DispararWebhookParams {
  reuniao_id: string;
  modo: 'manual' | 'automatico';
  template_id?: number; // ID do template a ser usado (opcional, se não fornecido usa o configurado)
}

interface DispararWebhookResponse {
  success: boolean;
  message: string;
  reuniao?: string;
  error?: string;
  webhook_status?: number;
}

export function useAgendaWebhook() {
  const dispararRelatorioAulaExperimental = useMutation({
    mutationFn: async (reuniao_id: string): Promise<DispararWebhookResponse> => {
      const { data, error } = await supabase.functions.invoke('agenda-disparar-relatorio', {
        body: { reuniao_id },
      });

      if (error) throw new Error(error.message || 'Erro ao disparar relatório');
      const result = data as DispararWebhookResponse;
      if (!result.success) throw new Error((result as { error?: string }).error || result.message);
      return result;
    },
    onSuccess: (data) => {
      toast.success('Relatório enviado!', { description: data.message });
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar relatório', { description: error.message });
    },
  });

  const dispararLembrete = useMutation({
    mutationFn: async ({ reuniao_id, modo, template_id }: DispararWebhookParams): Promise<DispararWebhookResponse> => {
      console.log('🔔 Disparando webhook para reunião:', reuniao_id, template_id ? `(template: ${template_id})` : '');
      
      const { data, error } = await supabase.functions.invoke('agenda-disparar-webhook', {
        body: { reuniao_id, modo, template_id }
      });

      if (error) {
        console.error('Erro ao disparar webhook:', error);
        throw new Error(error.message || 'Erro ao disparar webhook');
      }

      return data as DispararWebhookResponse;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Lembrete enviado!', {
          description: data.message,
        });
      } else {
        toast.error('Erro ao enviar lembrete', {
          description: data.error || data.message,
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao disparar webhook', {
        description: error.message,
      });
    },
  });

  return {
    dispararLembrete,
    isDisparando: dispararLembrete.isPending,
    dispararRelatorioAulaExperimental,
    isDisparandoRelatorio: dispararRelatorioAulaExperimental.isPending,
  };
}
