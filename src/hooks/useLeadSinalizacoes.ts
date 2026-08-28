import { useEffect, useRef, useState, useCallback } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { supabase } from '@/integrations/supabase/client';
import { isSchemaApiExposed, resolveLeadSinalizacoesQueryConfig } from '@/lib/empresa-tables';

export interface LeadSinalizacao {
  id: string;
  lead_id: number;
  lead_nome: string;
  lead_status: string | null;
  destinatario_id: string;
  sinalizado_por_id: string;
  sinalizado_por_nome: string;
  mensagem: string | null;
  enviado_para_todos?: boolean;
  fechado_em: string | null;
  criado_em: string;
}

interface CreateLeadSinalizacaoInput {
  leadId: number;
  leadNome: string;
  leadStatus?: string | null;
  destinatarioIds: string[];
  mensagem?: string | null;
  enviadoParaTodos?: boolean;
}

function getRealtimeConfig(schemaEmpresa: string | null | undefined, sinalizacoesTable: string) {
  const realtimeSchema = isSchemaApiExposed(schemaEmpresa) ? schemaEmpresa! : 'public';
  const realtimeTable = isSchemaApiExposed(schemaEmpresa)
    ? 'lead_sinalizacoes'
    : sinalizacoesTable;
  return { realtimeSchema, realtimeTable };
}

interface UseLeadSinalizacoesOptions {
  /** Preferência salva: painel permanece minimizado até o usuário reabrir (ou chegar sinalização nova). */
  isMinimizedPreference?: boolean;
  /** Evita abrir o painel antes de carregar a preferência do usuário. */
  preferencesReady?: boolean;
  /**
   * Chamado quando uma sinalização nova força a abertura do painel
   * (ex.: limpar preferência de minimizado).
   */
  onNewSinalizacaoOpen?: () => void;
}

export function useLeadSinalizacoes(options: UseLeadSinalizacoesOptions = {}) {
  const { user } = useAuth();
  const { users } = useUsers();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const queryClient = useQueryClient();
  const config = resolveLeadSinalizacoesQueryConfig(schemaEmpresa);
  const queryKey = ['lead-sinalizacoes', user?.id, schemaEmpresa ?? 'master'] as const;

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [realtimeAvailable, setRealtimeAvailable] = useState(true);
  const realtimeWarnedRef = useRef(false);
  const knownIdsRef = useRef(new Set<string>());
  const hasInitializedRef = useRef(false);
  const userIdRef = useRef(user?.id);
  /** Usuário da sessão de sinalizações (detecta troca sem alterar o ref usado no Realtime). */
  const sessionUserIdRef = useRef(user?.id);
  const isMinimizedRef = useRef(options.isMinimizedPreference ?? false);
  const preferencesReadyRef = useRef(options.preferencesReady ?? true);
  const onNewSinalizacaoOpenRef = useRef(options.onNewSinalizacaoOpen);
  userIdRef.current = user?.id;
  isMinimizedRef.current = options.isMinimizedPreference ?? false;
  preferencesReadyRef.current = options.preferencesReady ?? true;
  onNewSinalizacaoOpenRef.current = options.onNewSinalizacaoOpen;

  const forceOpenForNewSinalizacao = () => {
    setIsPopupOpen(true);
    onNewSinalizacaoOpenRef.current?.();
  };

  const { data: pendentes = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<LeadSinalizacao[]> => {
      if (!user?.id) return [];

      const { data, error } = await db
        .from(config.sinalizacoesTable)
        .select('*')
        .eq('destinatario_id', user.id)
        .is('fechado_em', null)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      return ((data || []) as LeadSinalizacao[]).filter(
        (s) => s.destinatario_id === user.id,
      );
    },
    enabled: !!user?.id && queriesReady,
    staleTime: 5_000,
    // Polling de segurança: Realtime pode falhar silenciosamente (schema emp_* / filtros).
    refetchInterval: realtimeAvailable ? 12_000 : 8_000,
    refetchOnWindowFocus: true,
  });

  /**
   * Painel pode ficar oculto (minimizado), mas sinalização nova sempre aparece
   * para o destinatário. Itens já fechados (fechado_em) não entram em `pendentes`
   * e portanto não voltam a aparecer.
   */
  useEffect(() => {
    const currentUserId = user?.id;
    if (sessionUserIdRef.current !== currentUserId) {
      // Troca de usuário = nova sessão de sinalizações.
      knownIdsRef.current.clear();
      hasInitializedRef.current = false;
      setIsPopupOpen(false);
      sessionUserIdRef.current = currentUserId;
    }

    if (pendentes.length === 0) {
      setIsPopupOpen(false);
      // Mantém hasInitialized: após zerar a lista, a próxima chegada conta como "nova"
      // e força a abertura (não como carga inicial com painel oculto).
      return;
    }

    if (!preferencesReadyRef.current) return;

    const minimized = isMinimizedRef.current;

    if (!hasInitializedRef.current) {
      // Carga inicial da sessão: respeita painel oculto; ícone flutuante segue disponível.
      if (!minimized) setIsPopupOpen(true);
      pendentes.forEach((p) => knownIdsRef.current.add(p.id));
      hasInitializedRef.current = true;
      return;
    }

    const newItems = pendentes.filter((p) => !knownIdsRef.current.has(p.id));
    if (newItems.length > 0) {
      // Sinalização disparada agora: sempre abre para o responsável.
      forceOpenForNewSinalizacao();
    }

    pendentes.forEach((p) => knownIdsRef.current.add(p.id));
  }, [pendentes, user?.id, options.isMinimizedPreference, options.preferencesReady]);

  const applyRealtimePayload = useCallback(
    (payload: { eventType: string; new: Record<string, unknown> | null; old: Record<string, unknown> | null }) => {
      const uid = userIdRef.current;
      if (!uid) return;

      const { eventType, new: rowNew, old: rowOld } = payload;

      if (eventType === 'INSERT' && rowNew) {
        const dest = String(rowNew.destinatario_id ?? '');
        if (dest !== uid) return;
        if (rowNew.fechado_em) return;

        const incoming = rowNew as unknown as LeadSinalizacao;
        const fromOther = String(rowNew.sinalizado_por_id ?? '') !== uid;

        queryClient.setQueryData<LeadSinalizacao[]>(queryKey, (current) => {
          const list = current ?? [];
          if (list.some((s) => s.id === incoming.id)) return list;
          return [incoming, ...list];
        });

        // Sempre exibe para o destinatário até ele fechar a sinalização.
        setIsPopupOpen(true);
        onNewSinalizacaoOpenRef.current?.();
        if (fromOther) {
          const msg = String(rowNew.mensagem ?? '').trim();
          toast.info(`Lead sinalizado: ${String(rowNew.lead_nome ?? 'Lead')}`, {
            description: msg
              ? `${String(rowNew.sinalizado_por_nome ?? 'outro usuário')}: ${msg}`
              : `Por ${String(rowNew.sinalizado_por_nome ?? 'outro usuário')}`,
            duration: 8000,
          });
        }
        return;
      }

      if (eventType === 'UPDATE' && rowNew) {
        const dest = String(rowNew.destinatario_id ?? '');
        if (dest !== uid) return;

        if (rowNew.fechado_em) {
          queryClient.setQueryData<LeadSinalizacao[]>(queryKey, (current) =>
            (current ?? []).filter((s) => s.id !== String(rowNew.id)),
          );
        } else {
          const updated = rowNew as unknown as LeadSinalizacao;
          queryClient.setQueryData<LeadSinalizacao[]>(queryKey, (current) => {
            const list = current ?? [];
            const idx = list.findIndex((s) => s.id === updated.id);
            if (idx >= 0) {
              const next = [...list];
              next[idx] = updated;
              return next;
            }
            return [updated, ...list];
          });
        }
        return;
      }

      if (eventType === 'DELETE' && rowOld) {
        if (String(rowOld.destinatario_id ?? '') !== uid) return;
        queryClient.setQueryData<LeadSinalizacao[]>(queryKey, (current) =>
          (current ?? []).filter((s) => s.id !== String(rowOld.id)),
        );
      }
    },
    [queryClient, queryKey],
  );

  useEffect(() => {
    if (!user?.id || !queriesReady) return;

    setRealtimeAvailable(true);
    realtimeWarnedRef.current = false;

    const { realtimeSchema, realtimeTable } = getRealtimeConfig(
      schemaEmpresa,
      config.sinalizacoesTable,
    );
    const channelName = `lead-sinalizacoes-${schemaEmpresa ?? 'master'}-${user.id}-${Math.random().toString(36).slice(2, 10)}`

    // Sem filtro no canal: RLS (destinatario_id = auth.uid()) já limita os eventos.
    // Filtros em schemas emp_* costumam falhar e impedir o popup em tempo real.
    // Nome único evita reusar canal já inscrito (React StrictMode remonta o efeito).
    let channel
    try {
      channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: realtimeSchema,
          table: realtimeTable,
        },
        (payload) => {
          applyRealtimePayload({
            eventType: payload.eventType,
            new: (payload.new as Record<string, unknown>) ?? null,
            old: (payload.old as Record<string, unknown>) ?? null,
          });
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: realtimeSchema,
          table: realtimeTable,
        },
        (payload) => {
          applyRealtimePayload({
            eventType: payload.eventType,
            new: (payload.new as Record<string, unknown>) ?? null,
            old: (payload.old as Record<string, unknown>) ?? null,
          });
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: realtimeSchema,
          table: realtimeTable,
        },
        (payload) => {
          applyRealtimePayload({
            eventType: payload.eventType,
            new: (payload.new as Record<string, unknown>) ?? null,
            old: (payload.old as Record<string, unknown>) ?? null,
          });
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeAvailable(true)
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeAvailable(false)
          if (!realtimeWarnedRef.current) {
            realtimeWarnedRef.current = true
            if (import.meta.env.DEV) {
              console.debug(
                '[lead-sinalizacoes] Realtime indisponível; lista atualiza a cada 8s.',
              )
            }
          }
        }
      })
    } catch (error) {
      console.warn('[lead-sinalizacoes] Falha ao abrir canal em tempo real.', error)
      setRealtimeAvailable(false)
      return
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    user?.id,
    queriesReady,
    schemaEmpresa,
    config.sinalizacoesTable,
    applyRealtimePayload,
    queryClient,
    queryKey,
  ]);

  const createSinalizacao = useMutation({
    mutationFn: async (input: CreateLeadSinalizacaoInput) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const uniqueIds = [...new Set(input.destinatarioIds)].filter(Boolean);
      if (!uniqueIds.length) throw new Error('Selecione ao menos um colaborador');

      const senderName =
        users?.find((u) => u.id === user.id)?.nome ||
        user.user_metadata?.nome ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'Usuário';

      const mensagemTrimmed = input.mensagem?.trim() || null;

      const enviadoParaTodos = Boolean(input.enviadoParaTodos);

      const rows = uniqueIds.map((destinatarioId) => ({
        lead_id: input.leadId,
        lead_nome: input.leadNome,
        lead_status: input.leadStatus ?? null,
        destinatario_id: destinatarioId,
        sinalizado_por_id: user.id,
        sinalizado_por_nome: String(senderName),
        mensagem: mensagemTrimmed,
        enviado_para_todos: enviadoParaTodos,
      }));

      const { error } = await db.from(config.sinalizacoesTable).insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      void queryClient.refetchQueries({ queryKey, type: 'active' });
      toast.success(
        count === 1
          ? 'Lead sinalizado para 1 colaborador'
          : `Lead sinalizado para ${count} colaboradores`,
      );
    },
    onError: (error: Error) => {
      toast.error('Erro ao sinalizar lead', { description: error.message });
    },
  });

  const fecharSinalizacao = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { error } = await db
        .from(config.sinalizacoesTable)
        .update({ fechado_em: new Date().toISOString() })
        .eq('id', id)
        .eq('destinatario_id', user.id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LeadSinalizacao[]>(queryKey);
      queryClient.setQueryData<LeadSinalizacao[]>(queryKey, (current) =>
        (current ?? []).filter((s) => s.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });

  const fecharTodas = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await db
        .from(config.sinalizacoesTable)
        .update({ fechado_em: new Date().toISOString() })
        .eq('destinatario_id', user.id)
        .is('fechado_em', null);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LeadSinalizacao[]>(queryKey);
      queryClient.setQueryData<LeadSinalizacao[]>(queryKey, []);
      return { previous };
    },
    onSuccess: () => {
      setIsPopupOpen(false);
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });

  const openPopup = useCallback(() => {
    setIsPopupOpen(true);
  }, []);

  const closePopup = useCallback(() => {
    setIsPopupOpen(false);
  }, []);

  return {
    pendentes,
    isLoading,
    isPopupOpen,
    openPopup,
    closePopup,
    setIsPopupOpen,
    createSinalizacao,
    fecharSinalizacao,
    fecharTodas,
    unreadCount: pendentes.length,
  };
}
