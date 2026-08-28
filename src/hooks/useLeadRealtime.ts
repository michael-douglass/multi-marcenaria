import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LeadRealtimeProps {
  onLeadUpdate: (leadId: number) => void;
  onNewMessage: (telefone: string) => void;
}

export function useLeadRealtime({ onLeadUpdate, onNewMessage }: LeadRealtimeProps) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Canal 1: Monitorar INSERT e UPDATE em leads
    const leadsChannel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'CRM-multi-empresas>leads<'
        },
        (payload) => {
          console.log('Novo lead inserido:', payload.new);
          onLeadUpdate((payload.new as any).id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'CRM-multi-empresas>leads<'
        },
        (payload) => {
          console.log('Lead atualizado:', payload.new);
          onLeadUpdate((payload.new as any).id);
        }
      )
      .subscribe();

    // Canal 2: Monitorar mensagens WhatsApp (Betim)
    const whatsappBetimChannel = supabase
      .channel('whatsapp-betim-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'n8n_chat_histories'
        },
        (payload) => {
          const sessionId = (payload.new as any).session_id;
          const telefone = extractPhoneFromSessionId(sessionId);
          if (telefone) {
            console.log('Nova mensagem WhatsApp (Betim):', telefone);
            onNewMessage(telefone);
          }
        }
      )
      .subscribe();

    // Canal 3: Monitorar mensagens WhatsApp (São Paulo)
    const whatsappSPChannel = supabase
      .channel('whatsapp-sp-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'n8n_chat_histories_proforco_saopaulo'
        },
        (payload) => {
          const sessionId = (payload.new as any).session_id;
          const telefone = extractPhoneFromSessionId(sessionId);
          if (telefone) {
            console.log('Nova mensagem WhatsApp (SP):', telefone);
            onNewMessage(telefone);
          }
        }
      )
      .subscribe();

    // Canal 4: Monitorar mensagens CRM (novas tabelas)
    const crmChatChannel = supabase
      .channel('crm-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_multiempresas_chat_mensagens'
        },
        (payload) => {
          const telefone = (payload.new as any).telefone;
          if (telefone) {
            console.log('Nova mensagem CRM:', telefone);
            onNewMessage(telefone);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(whatsappBetimChannel);
      supabase.removeChannel(whatsappSPChannel);
      supabase.removeChannel(crmChatChannel);
    };
  }, [user, onLeadUpdate, onNewMessage]);
}

// Extrair telefone do session_id (ex: "session_5513996694204")
function extractPhoneFromSessionId(sessionId: string): string | null {
  const match = sessionId.match(/\d{10,15}/);
  return match ? match[0] : null;
}
