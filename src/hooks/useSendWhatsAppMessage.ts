import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendMessageParams {
  telefone: string;
  mensagem?: string;
  tipo?: 'texto' | 'audio' | 'pdf' | 'imagem';
  arquivo?: string; // base64
}

/** Extrai mensagem de erro do corpo da resposta da Edge Function (4xx/5xx). */
async function getEdgeFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback = 'Erro ao enviar mensagem';
  const ctx = error && typeof error === 'object' && 'context' in error ? (error as { context?: Response }).context : null;
  if (!ctx || typeof (ctx as Response).json !== 'function') return fallback;
  try {
    const body = await (ctx as Response).json();
    if (body && typeof body.error === 'string' && body.error.trim()) return body.error.trim();
  } catch {
    // ignorar falha de parse
  }
  return fallback;
}

export function useSendWhatsAppMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ telefone, mensagem, tipo = 'texto', arquivo }: SendMessageParams) => {
      console.log('📤 Enviando mensagem WhatsApp...', { telefone, tipo });

      const { data, error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: { telefone, mensagem, tipo, arquivo }
      });

      if (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        const message = await getEdgeFunctionErrorMessage(error);
        throw new Error(message);
      }

      console.log('✅ Mensagem enviada:', data);
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success('Mensagem enviada com sucesso!');
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ['lead-whatsapp-history', variables.telefone]
        });
      }, 300);
    },
    onError: (error: unknown) => {
      console.error('❌ Erro ao enviar:', error);
      const message = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
      toast.error(message);
    }
  });
}
