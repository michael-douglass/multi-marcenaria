import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  firstMessageByPhone,
  formatChatMessagePreview,
  normalizePhoneDigits,
  stableLeadPhonesKey,
  type LeadLastMessagePreview,
} from '@/lib/lead-last-message-preview';

export interface LeadLastMessage extends LeadLastMessagePreview {
  leadId: number;
  telefone: string;
}

const LAST_MESSAGES_FETCH_CAP = 1500;

export function useLeadLastMessages(
  leads: Array<{ id: number; telefone?: string | null }>,
) {
  const signature = stableLeadPhonesKey(leads);

  return useQuery({
    queryKey: ['lead-last-messages', signature],
    queryFn: async () => {
      if (!leads.length) return {} as Record<number, LeadLastMessage>;

      const phoneToLeadId = new Map<string, number>();
      const telefones: string[] = [];

      for (const lead of leads) {
        const phone = normalizePhoneDigits(lead.telefone);
        if (!phone) continue;
        telefones.push(phone);
        phoneToLeadId.set(phone, lead.id);
      }

      if (!telefones.length) return {};

      const { data: messages, error: messagesError } = await supabase
        .from('crm_multiempresas_chat_mensagens')
        .select('telefone, conteudo, criado_em, tipo_mensagem, tipo_remetente')
        .in('telefone', telefones)
        .order('criado_em', { ascending: false })
        .limit(LAST_MESSAGES_FETCH_CAP);

      if (messagesError) {
        console.error('Erro ao buscar mensagens:', messagesError);
        return {};
      }

      const lastByPhone = firstMessageByPhone(messages ?? []);
      const result: Record<number, LeadLastMessage> = {};

      for (const lead of leads) {
        const phone = normalizePhoneDigits(lead.telefone);
        if (!phone) continue;
        const lastMsg = lastByPhone.get(phone);
        if (!lastMsg) continue;
        const preview = formatChatMessagePreview(lastMsg);
        result[lead.id] = {
          leadId: lead.id,
          telefone: phone,
          ...preview,
        };
      }

      return result;
    },
    enabled: leads.length > 0,
    staleTime: 30_000,
  });
}
