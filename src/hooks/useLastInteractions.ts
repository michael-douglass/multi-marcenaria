import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { hasN8nHistoryForPhone } from '@/lib/n8n-chat-histories';

export function useLastInteractions(leadIds: number[], leads: any[]) {
  return useQuery({
      queryKey: ['last-interactions', [...leadIds].sort((a, b) => a - b).join(',')],
    queryFn: async () => {
      if (!leadIds.length || !leads.length) return {};

      // Criar mapa de telefone para lead id (com normalizações)
      const phoneToLeadId: Record<string, number> = {};
      const allPhoneVariations: string[] = [];
      const leadsWithPhone: { id: number; telefone: string }[] = [];

      leads.forEach(lead => {
        if (lead.telefone) {
          const cleanPhone = lead.telefone.replace(/\D/g, '');
          leadsWithPhone.push({ id: lead.id, telefone: cleanPhone });
          
          // Adicionar variações do telefone
          allPhoneVariations.push(cleanPhone);
          phoneToLeadId[cleanPhone] = lead.id;
          
          if (cleanPhone.startsWith('55') && cleanPhone.length > 11) {
            const withoutCountry = cleanPhone.slice(2);
            allPhoneVariations.push(withoutCountry);
            phoneToLeadId[withoutCountry] = lead.id;
          } else if (!cleanPhone.startsWith('55')) {
            const withCountry = '55' + cleanPhone;
            allPhoneVariations.push(withCountry);
            phoneToLeadId[withCountry] = lead.id;
          }
        }
      });

      if (!allPhoneVariations.length) return {};

      // Construir mapa de última interação por lead
      const lastInteractionMap: Record<number, number> = {};
      const processedLeads = new Set<number>();

      // Fazer uma única query para buscar todas as mensagens mais recentes
      // Supabase limita a 1000 itens em IN, então fazer em batches se necessário
      const batchSize = 500;
      const batches: string[][] = [];
      
      for (let i = 0; i < allPhoneVariations.length; i += batchSize) {
        batches.push(allPhoneVariations.slice(i, i + batchSize));
      }

      // Buscar todas as mensagens para todos os telefones
      const allMessages: { telefone: string; criado_em: string }[] = [];
      
      for (const batch of batches) {
        const { data: messages, error } = await supabase
          .from('crm_multiempresas_chat_mensagens')
          .select('telefone, criado_em')
          .in('telefone', batch)
          .order('criado_em', { ascending: false })
          .limit(1500);

        if (!error && messages) {
          allMessages.push(...messages);
        }
      }

      // Processar mensagens - para cada telefone, pegar apenas a mais recente
      // Como ordenamos por criado_em DESC, a primeira ocorrência de cada telefone é a mais recente
      allMessages.forEach(msg => {
        const cleanPhone = msg.telefone.replace(/\D/g, '');
        const leadId = phoneToLeadId[cleanPhone];

        if (leadId && !processedLeads.has(leadId)) {
          lastInteractionMap[leadId] = new Date(msg.criado_em).getTime();
          processedLeads.add(leadId);
        }
      });

      // Para leads sem mensagens no CRM, tentar buscar nas tabelas n8n (em batches)
      const leadsWithoutMessages = leadsWithPhone.filter(l => !processedLeads.has(l.id));
      
      if (leadsWithoutMessages.length > 0 && leadsWithoutMessages.length < 50) {
        // Só fazer queries n8n se houver poucos leads sem mensagens
        for (const lead of leadsWithoutMessages) {
          const foundN8n = await hasN8nHistoryForPhone(supabase, lead.telefone);
          if (foundN8n) {
            const leadData = leads.find((l) => l.id === lead.id);
            if (leadData) {
              lastInteractionMap[lead.id] = new Date(
                leadData.atualizado_em || leadData.criado_em
              ).getTime();
              processedLeads.add(lead.id);
            }
          }
        }
      }

      // Para leads ainda sem mensagens, usar data de chegada do lead
      leadIds.forEach(id => {
        if (!lastInteractionMap[id]) {
          const lead = leads.find(l => l.id === id);
          if (lead) {
            lastInteractionMap[id] = new Date(lead.data_chegada || lead.criado_em).getTime();
          }
        }
      });

      return lastInteractionMap;
    },
    enabled: leadIds.length > 0 && leads.length > 0,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
