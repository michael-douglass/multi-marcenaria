import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MessageNotification {
  id: string;
  telefone: string;
  leadId?: number;
  leadName?: string;
  regiao?: string;
  origem?: string;
  content?: string;
  timestamp: Date;
  isFromLead: boolean;
}

interface Lead {
  id: number;
  nome: string;
  telefone: string | null;
  regiao: string | null;
  origem: string | null;
}

// Helper para extrair telefone do session_id
function extractPhoneFromSessionId(sessionId: string): string | null {
  const match = sessionId?.match(/\d{10,15}/);
  return match ? match[0] : null;
}

export function useMessageNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<MessageNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  // Unificando refs para manter número de hooks estável (evita "more/fewer hooks" no HMR)
  const stableRef = useRef({
    leadsCache: new Map<string, Lead>(),
    seenMessageKeys: new Set<string>(),
    lastPolledAtIso: new Date(0).toISOString(),
    initialLoadComplete: false, // Flag para não abrir popup no carregamento inicial
  });

  // Persistência local (evita que notificações “voltem” após atualizar a página)
  const STORAGE_LAST_POLLED_AT = 'crm_multiempresas_msg_notifications_last_polled_at';
  const fetchLeadByPhone = async (telefone: string): Promise<Lead | null> => {
    const normalizedPhone = telefone.replace(/\D/g, '');
    const cached = stableRef.current.leadsCache.get(normalizedPhone);
    if (cached) return cached;

    const variants = [
      normalizedPhone,
      normalizedPhone.startsWith('55') ? normalizedPhone.slice(2) : `55${normalizedPhone}`
    ];

    try {
      const { data } = await supabase
        .from('CRM-multi-empresas>leads<')
        .select('id, nome, telefone, regiao, origem')
        .or(variants.map(v => `telefone.ilike.%${v}%`).join(','))
        .limit(1)
        .maybeSingle();

      if (data) {
        stableRef.current.leadsCache.set(normalizedPhone, data as Lead);
        return data as Lead;
      }
    } catch (error) {
      console.error('Erro ao buscar lead por telefone:', error);
    }

    return null;
  };

  // Limpar notificações - e marcar como vistas para não reaparecerem no próximo poll
  const clearNotifications = useCallback(() => {
    const nowIso = new Date().toISOString();

    // Marcar todas as notificações atuais como vistas para evitar reprocessamento
    setNotifications(prev => {
      prev.forEach(n => {
        // Adicionar ao seenMessageKeys para evitar que voltem no polling
        stableRef.current.seenMessageKeys.add(n.id);
        if (n.telefone) {
          stableRef.current.seenMessageKeys.add(n.telefone);
        }
      });
      return [];
    });

    // Atualizar o timestamp do polling para evitar reprocessar mensagens antigas
    stableRef.current.lastPolledAtIso = nowIso;

    // Persistir para sobreviver a refresh
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_LAST_POLLED_AT, nowIso);
      }
    } catch {
      // ignore
    }

    setIsOpen(false);
  }, []);

  // Remover notificação específica
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Fechar popup
  const closePopup = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Escutar mensagens em tempo real (+ fallback polling)
  useEffect(() => {
    if (!user) return;

    // Restaurar último ponto de corte (evita reprocessar mensagens antigas após refresh)
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(STORAGE_LAST_POLLED_AT);
        if (saved && saved > stableRef.current.lastPolledAtIso) {
          stableRef.current.lastPolledAtIso = saved;
        }
      }
    } catch {
      // ignore
    }

    console.log('🔔 Configurando listener de notificações de mensagens...');

    const markSeen = (key: string) => {
      if (!key) return;
      stableRef.current.seenMessageKeys.add(key);
      // Evitar crescimento infinito
      if (stableRef.current.seenMessageKeys.size > 2000) {
        const arr = Array.from(stableRef.current.seenMessageKeys);
        stableRef.current.seenMessageKeys = new Set(arr.slice(-1000));
      }
    };

    const alreadySeen = (key: string) => {
      return key ? stableRef.current.seenMessageKeys.has(key) : false;
    };

    // Função para adicionar notificação (definida dentro do useEffect para evitar dependências)
    // openPopup: se true, abre o popup; se false, apenas adiciona a notificação sem abrir
    const handleNewMessage = async (telefone: string, content?: string, messageKey?: string, openPopup = true) => {
      const normalizedPhone = telefone.replace(/\D/g, '');
      const key = messageKey ? String(messageKey) : `${normalizedPhone}:${content ?? ''}`;

      if (alreadySeen(key)) return;
      markSeen(key);

      const lead = await fetchLeadByPhone(normalizedPhone);

      const newNotification: MessageNotification = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        telefone: normalizedPhone,
        leadId: lead?.id,
        leadName: lead?.nome || 'Contato Desconhecido',
        regiao: lead?.regiao || 'N/A',
        origem: lead?.origem || 'N/A',
        content: content?.substring(0, 100) || 'Nova mensagem',
        timestamp: new Date(),
        isFromLead: true,
      };

      setNotifications(prev => [newNotification, ...prev].slice(0, 50));
      
      // Só abre o popup se permitido (não abre no carregamento inicial)
      if (openPopup) {
        setIsOpen(true);
      }
    };

    // Canal CRM (tabela unificada)
    const crmChannel = supabase
      .channel('message-notifications-crm')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_multiempresas_chat_mensagens',
        },
        async (payload) => {
          const msg = payload.new as any;
          const sender = String(msg.tipo_remetente ?? '').toLowerCase();
          if (sender === 'lead') {
            await handleNewMessage(msg.telefone, msg.conteudo, msg.id);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Status canal CRM:', status);
      });

    // Canal n8n Betim
    const betimChannel = supabase
      .channel('message-notifications-betim')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'n8n_chat_histories',
        },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.message?.type === 'human') {
            const telefone = extractPhoneFromSessionId(msg.session_id);
            if (telefone) {
              await handleNewMessage(telefone, msg.message?.content, `n8n_betim:${msg.id}`);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Status canal Betim:', status);
      });

    // Canal n8n São Paulo
    const spChannel = supabase
      .channel('message-notifications-sp')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'n8n_chat_histories_proforco_saopaulo',
        },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.message?.type === 'human') {
            const telefone = extractPhoneFromSessionId(msg.session_id);
            if (telefone) {
              await handleNewMessage(telefone, msg.message?.content, `n8n_sp:${msg.id}`);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Status canal SP:', status);
      });

    // Fallback: polling (caso Realtime não dispare por RLS/replication intermitente)
    let isPolling = false;
    const poll = async () => {
      try {
        // Evita gastar recursos quando a aba está em background
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        // Evita polling concorrente
        if (isPolling) return;
        isPolling = true;

        const { data, error } = await supabase
          .from('crm_multiempresas_chat_mensagens')
          .select('id, telefone, conteudo, tipo_remetente, criado_em')
          .eq('tipo_remetente', 'lead')
          .gt('criado_em', stableRef.current.lastPolledAtIso)
          .order('criado_em', { ascending: true })
          .limit(10);

        if (error) throw error;
        
        if (!data || data.length === 0) {
          stableRef.current.initialLoadComplete = true;
          return;
        }

        const shouldOpenPopup = stableRef.current.initialLoadComplete;

        // Filtrar mensagens já vistas ANTES de buscar leads (evita queries desnecessárias)
        const newRows = (data as any[]).filter(row => {
          const key = row.id ? String(row.id) : `${row.telefone}:${row.conteudo ?? ''}`;
          return !alreadySeen(key);
        });

        if (newRows.length > 0) {
          // Batch: buscar todos os leads de uma vez em vez de 1 query por mensagem
          const uniquePhones = [...new Set(newRows.map((r: any) => r.telefone?.replace(/\D/g, '')).filter(Boolean))];
          const uncachedPhones = uniquePhones.filter(p => !stableRef.current.leadsCache.has(p));
          
          if (uncachedPhones.length > 0) {
            try {
              // Buscar todos os leads de uma vez com OR
              const orClauses = uncachedPhones.slice(0, 5).map(p => `telefone.ilike.%${p}%`).join(',');
              const { data: leadsData } = await supabase
                .from('CRM-multi-empresas>leads<')
                .select('id, nome, telefone, regiao, origem')
                .or(orClauses)
                .limit(10);
              
              // Cachear resultados
              if (leadsData) {
                for (const lead of leadsData) {
                  const phone = lead.telefone?.replace(/\D/g, '') || '';
                  if (phone) stableRef.current.leadsCache.set(phone, lead as Lead);
                }
              }
            } catch {
              // Se falhar, continua sem dados do lead
            }
          }

          for (const row of newRows) {
            await handleNewMessage(row.telefone, row.conteudo, row.id, shouldOpenPopup);
          }
        }

        const newest = data[data.length - 1] as any;
        if (newest?.criado_em) {
          stableRef.current.lastPolledAtIso = newest.criado_em;
          try {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(STORAGE_LAST_POLLED_AT, newest.criado_em);
            }
          } catch {
            // ignore
          }
        }
        
        stableRef.current.initialLoadComplete = true;
      } catch (e) {
        console.warn('⚠️ Polling de mensagens falhou (mantendo realtime):', e);
        stableRef.current.initialLoadComplete = true;
      } finally {
        isPolling = false;
      }
    };

    // Primeira checagem ao montar (delay de 10s para não competir com queries críticas de leads/permissões)
    const initialTimeout = window.setTimeout(poll, 10000);
    const intervalId = window.setInterval(poll, 30000);

    return () => {
      console.log('🔕 Removendo listeners de notificações...');
      window.clearTimeout(initialTimeout);
      window.clearInterval(intervalId);
      supabase.removeChannel(crmChannel);
      supabase.removeChannel(betimChannel);
      supabase.removeChannel(spChannel);
    };
  }, [user]);

  return {
    notifications,
    isOpen,
    setIsOpen,
    closePopup,
    clearNotifications,
    removeNotification,
  };
}
