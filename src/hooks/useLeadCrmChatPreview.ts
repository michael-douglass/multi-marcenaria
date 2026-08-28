import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CrmChatPreviewRow {
  id: number;
  conteudo: string | null;
  criado_em: string;
  tipo_mensagem: string | null;
  tipo_remetente: string | null;
  url_midia: string | null;
  file_name: string | null;
  mime_type: string | null;
}

/**
 * Pré-visualização leve do histórico: apenas tabela CRM, limite fixo, sem Edge Function.
 * Para histórico completo (incl. n8n) use useLeadWhatsAppHistory no pipeline/modal completo.
 */
export function useLeadCrmChatPreview(telefone: string | null | undefined, enabled: boolean) {
  const telefoneClean = telefone?.replace(/\D/g, '').trim() || '';

  return useQuery({
    queryKey: ['lead-crm-chat-preview', telefoneClean],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_multiempresas_chat_mensagens')
        .select('id, conteudo, criado_em, tipo_mensagem, tipo_remetente, url_midia, file_name, mime_type')
        .eq('telefone', telefoneClean)
        .order('criado_em', { ascending: false })
        .limit(120);

      if (error) throw error;
      const rows = (data || []) as CrmChatPreviewRow[];
      return rows.slice().reverse();
    },
    enabled: enabled && telefoneClean.length >= 8,
    staleTime: 30_000,
  });
}
