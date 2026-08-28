// v2 - Realtime support added
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  appendCrmMessageToHistory,
  phoneMatchesVariants,
  type WhatsAppHistoryCache,
} from '@/lib/whatsapp-history-cache';

interface WhatsAppMessage {
  id: number | string;
  type: 'human' | 'ai';
  content: string;
  empresa: string;
  origem?: 'n8n' | 'crm' | 'webhook';
  criado_em?: string;
  tipo_mensagem?: string;
  url_midia?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  _sortOrder?: number; // Usado para ordenação de mensagens n8n
}

export function useLeadWhatsAppHistory(telefone?: string, enabled = true) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['lead-whatsapp-history', telefone],
    queryFn: async () => {
      if (!telefone) return { messages: [] };

      const telefoneNormalizado = telefone.replace(/\D/g, '');
      console.log('Buscando histórico para:', telefone);

      // Buscar histórico n8n via Edge Function
      const { data: n8nData, error: n8nError } = await supabase.functions.invoke('get-lead-whatsapp-history', {
        body: { telefone }
      });

      if (n8nError) {
        console.error('Erro ao buscar histórico n8n:', n8nError);
      }

      // Buscar histórico CRM local
      const { data: crmData, error: crmError } = await supabase
        .from('crm_multiempresas_chat_mensagens')
        .select('*')
        .eq('telefone', telefoneNormalizado)
        .order('criado_em', { ascending: true });

      if (crmError) {
        console.error('Erro ao buscar histórico CRM:', crmError);
      }

      // Combinar mensagens de ambas as fontes
      // Mensagens n8n não têm criado_em, então vamos adicionar um campo para ordenação
      const n8nMessages: WhatsAppMessage[] = (n8nData?.messages || []).map((msg: any, index: number) => ({
        ...msg,
        origem: 'n8n' as const,
        // Usar um timestamp baseado na ordem do array (que já vem ordenado por ID)
        // Mapeamos para uma data antiga para garantir que fiquem antes das mensagens CRM
        _sortOrder: msg.id || index,
        // Criar um criado_em fictício para exibição
        criado_em: msg.criado_em || undefined
      }));

      console.log(`📊 Mensagens n8n recebidas: ${n8nMessages.length}`);

      const crmMessages: WhatsAppMessage[] = (crmData || []).map((msg: any) => ({
        id: msg.id,
        type: msg.tipo_remetente === 'lead' ? 'human' : 'ai',
        content: msg.conteudo || (msg.url_midia ? `[${msg.tipo_mensagem}]` : ''),
        empresa: msg.tipo_remetente === 'lead' ? 'Lead' : 'CRM',
        origem: msg.origem as 'crm' | 'webhook',
        criado_em: msg.criado_em,
        tipo_mensagem: msg.tipo_mensagem || 'texto',
        url_midia: msg.url_midia || null,
        file_name: msg.file_name || null,
        mime_type: msg.mime_type || null,
        _sortOrder: undefined // CRM messages usam criado_em para ordenação
      }));

      console.log(`📊 Mensagens CRM recebidas: ${crmMessages.length}`);

      // Ordenar mensagens: primeiro n8n (por ID), depois CRM (por timestamp)
      // Separar mensagens por origem
      const n8nMsgs = [...n8nMessages];
      const crmMsgs = [...crmMessages];
      
      // n8n já vem ordenado por ID do servidor
      // Ordenar CRM por criado_em
      crmMsgs.sort((a, b) => {
        const dateA = new Date(a.criado_em || 0).getTime();
        const dateB = new Date(b.criado_em || 0).getTime();
        return dateA - dateB;
      });
      
      // Combinar: primeiro todas as mensagens n8n (já ordenadas por ID), depois CRM
      const allMessages = [...n8nMsgs, ...crmMsgs];

      // Remover duplicatas - IMPORTANTE: mensagens n8n não têm criado_em confiável
      // Então deduplicamos por (origem + id) para n8n, e por (tipo + timestamp) para CRM
      const seenN8nIds = new Set<string>();
      const seenMediaKeys = new Set<string>(); // Para deduplicar mídias por timestamp+tipo
      
      const uniqueMessages = allMessages.reduce((acc: WhatsAppMessage[], msg) => {
        // Para mensagens n8n: deduplicar por ID único (origem + id)
        if (msg.origem === 'n8n') {
          const key = `n8n-${msg.id}`;
          if (seenN8nIds.has(key)) return acc;
          seenN8nIds.add(key);
          acc.push(msg);
          return acc;
        }
        
        // Para mensagens de mídia (áudio, imagem, PDF, vídeo): deduplicar por tipo + timestamp + remetente
        // Isso funciona porque CRM e Webhook salvam quase simultaneamente (diferença < 2 segundos)
        const isMediaMessage = msg.tipo_mensagem && ['audio', 'imagem', 'image', 'pdf', 'document', 'video'].includes(msg.tipo_mensagem);
        
        if (isMediaMessage && msg.criado_em) {
          // Arredondar timestamp para janela de 2 segundos para capturar duplicatas CRM/Webhook
          const timestamp = new Date(msg.criado_em).getTime();
          const roundedTimestamp = Math.floor(timestamp / 2000) * 2000; // Arredonda para 2 segundos
          const mediaKey = `${msg.tipo_mensagem}-${msg.type}-${roundedTimestamp}`;
          
          if (seenMediaKeys.has(mediaKey)) {
            console.log('🔄 Mídia duplicada detectada e removida:', msg.tipo_mensagem, 'em', new Date(msg.criado_em).toLocaleTimeString());
            return acc;
          }
          seenMediaKeys.add(mediaKey);
          acc.push(msg);
          return acc;
        }
        
        // Para mensagens de texto CRM/webhook: verificar se já existe mensagem similar (mesmo conteúdo em ±5 segundos)
        const isDuplicate = acc.some(existing => {
          if (existing.content !== msg.content) return false;
          // Se a existente for n8n (sem criado_em confiável), não considerar duplicata
          if (existing.origem === 'n8n' && !existing.criado_em) return false;
          if (!msg.criado_em) return false;
          
          const timeDiff = Math.abs(
            new Date(existing.criado_em || 0).getTime() - 
            new Date(msg.criado_em).getTime()
          );
          return timeDiff < 5000; // 5 segundos
        });
        
        if (!isDuplicate) {
          acc.push(msg);
        }
        return acc;
      }, []);

      console.log(`📊 Histórico combinado: ${n8nMessages.length} n8n + ${crmMessages.length} CRM = ${uniqueMessages.length} únicas`);
      console.log(`📊 Primeira msg: ${uniqueMessages[0]?.criado_em}, Última msg: ${uniqueMessages[uniqueMessages.length-1]?.criado_em}`);
      
      return { messages: uniqueMessages };
    },
    enabled: !!telefone && enabled,
    staleTime: 30_000,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });

  // Subscription Realtime para novas mensagens
  useEffect(() => {
    if (!telefone || !enabled) return;

    const telefoneNormalizado = telefone.replace(/\D/g, '');
    const variantesTelefone = Array.from(
      new Set([
        telefoneNormalizado,
        telefoneNormalizado.startsWith('55') ? telefoneNormalizado.slice(2) : `55${telefoneNormalizado}`,
      ])
    ).filter(Boolean);

    console.log('🔔 Configurando Realtime para histórico WhatsApp:', variantesTelefone);

    // Canal para mensagens CRM
    const crmChannel = supabase
      .channel(`whatsapp-history-crm-${variantesTelefone[0]}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_multiempresas_chat_mensagens',
        },
        (payload) => {
          const telefoneNovo = String((payload.new as { telefone?: string } | null)?.telefone || '').replace(/\D/g, '');
          if (!telefoneNovo) return;
          if (!phoneMatchesVariants(telefoneNovo, variantesTelefone)) return;

          console.log('📩 Nova mensagem CRM recebida via Realtime:', payload);
          queryClient.setQueryData<WhatsAppHistoryCache>(
            ['lead-whatsapp-history', telefone],
            (current) =>
              appendCrmMessageToHistory(
                current,
                (payload.new ?? {}) as Parameters<typeof appendCrmMessageToHistory>[1],
              ),
          );
          queryClient.invalidateQueries({ queryKey: ['lead-last-messages'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Status Realtime CRM:', status);
      });

    // Canal para mensagens n8n (Betim)
    const n8nBetimChannel = supabase
      .channel(`whatsapp-history-n8n-betim-${variantesTelefone[0]}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'n8n_chat_histories',
        },
        (payload) => {
          const sessionId = String((payload.new as any)?.session_id || '');
          // Verificar se o session_id contém alguma variante do telefone
          const matchesTelefone = variantesTelefone.some(v => sessionId.includes(v));
          if (!matchesTelefone) return;

          console.log('📩 Nova mensagem n8n Betim recebida via Realtime:', payload);
          queryClient.invalidateQueries({ queryKey: ['lead-whatsapp-history', telefone] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Status Realtime n8n Betim:', status);
      });

    // Canal para mensagens n8n (São Paulo)
    const n8nSPChannel = supabase
      .channel(`whatsapp-history-n8n-sp-${variantesTelefone[0]}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'n8n_chat_histories_proforco_saopaulo',
        },
        (payload) => {
          const sessionId = String((payload.new as any)?.session_id || '');
          // Verificar se o session_id contém alguma variante do telefone
          const matchesTelefone = variantesTelefone.some(v => sessionId.includes(v));
          if (!matchesTelefone) return;

          console.log('📩 Nova mensagem n8n SP recebida via Realtime:', payload);
          queryClient.invalidateQueries({ queryKey: ['lead-whatsapp-history', telefone] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Status Realtime n8n SP:', status);
      });

    return () => {
      console.log('🔕 Removendo subscriptions Realtime do histórico...');
      supabase.removeChannel(crmChannel);
      supabase.removeChannel(n8nBetimChannel);
      supabase.removeChannel(n8nSPChannel);
    };
  }, [telefone, queryClient, enabled]);

  const refreshHistory = async () => {
    if (telefone) {
      console.log('🔄 Forçando atualização do histórico WhatsApp...');
      
      // Invalidar cache primeiro
      await queryClient.invalidateQueries({ 
        queryKey: ['lead-whatsapp-history', telefone] 
      });
      
      // Também invalidar mensagens CRM
      await queryClient.invalidateQueries({ 
        queryKey: ['crm-chat-messages', telefone] 
      });
      
      // Forçar refetch imediato
      return query.refetch();
    }
  };

  return {
    ...query,
    refreshHistory,
  };
}
