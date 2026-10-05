import { useCallback, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase'
import { isSchemaApiExposed } from '@/lib/empresa-tables'

export interface ProjetoChatUnreadThread {
  lead_id: number
  lead_nome: string
  unreadCount: number
  lastPreview: string
  lastAt: string
}

export interface ProjetoChatUnreadResult {
  totalUnread: number
  threads: ProjetoChatUnreadThread[]
  /** last_read_at por lead (ISO), para a UI saber o que já foi aberto. */
  lastReadByLead: Record<number, string>
}

function previewFromNota(mensagem: string | null | undefined, hasImage: boolean): string {
  const msg = (mensagem ?? '').trim()
  if (!msg || msg === '📷 Imagem') return hasImage ? 'Imagem' : 'Sem texto'
  return msg.length > 80 ? `${msg.slice(0, 77)}…` : msg
}

/**
 * Evita corrida: ao abrir a conversa disparamos “marcar lida”; se o usuário
 * clica “não lida” logo em seguida, o “lida” atrasado não pode apagar o rewind.
 * Compartilhado entre instâncias do hook (popup + rádio + dialog).
 */
const suppressAutoReadUntil = new Map<number, number>()
const lastUnreadRewindByLead = new Map<number, string>()

function suppressAutoRead(leadId: number, ms = 12_000) {
  suppressAutoReadUntil.set(leadId, Date.now() + ms)
}

function isAutoReadSuppressed(leadId: number): boolean {
  const until = suppressAutoReadUntil.get(leadId)
  if (until == null) return false
  if (Date.now() > until) {
    suppressAutoReadUntil.delete(leadId)
    return false
  }
  return true
}

function clearAutoReadSuppress(leadId: number) {
  suppressAutoReadUntil.delete(leadId)
  lastUnreadRewindByLead.delete(leadId)
}

/** Libera o bloqueio para a próxima abertura marcar como lida de novo. */
export function allowLeadChatAutoRead(leadId: number) {
  clearAutoReadSuppress(leadId)
}

/**
 * Não lidas do canal do ateliê (estilo WhatsApp).
 * Só leads em que o usuário é titular ou projetista (arquiteto_id),
 * mais leads onde é destinatário explícito.
 * Contagem = msgs de outra pessoa depois do last_read_at.
 * Mensagens sem destinatario_id (legado) contam no fio do participante.
 */
export function useProjetoChatUnread(options?: { realtime?: boolean }) {
  const db = useEmpresaSupabase()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { schemaEmpresa, queriesReady } = useEmpresa()
  const realtime = options?.realtime !== false
  const userId = user?.id ?? null

  const queryKey = useMemo(
    () => ['lead-projeto-chat-unread', schemaEmpresa, userId] as const,
    [schemaEmpresa, userId],
  )

  const query = useQuery({
    queryKey,
    enabled: queriesReady && Boolean(userId),
    // Contagem de não lidas precisa ser fresca: o app desliga refetch no foco da janela.
    staleTime: 0,
    refetchOnMount: 'always',
    // Rede de segurança se o realtime falhar ou atrasar (badge acende em poucos segundos).
    refetchInterval: realtime ? 8_000 : false,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<ProjetoChatUnreadResult> => {
      if (!userId) return { totalUnread: 0, threads: [], lastReadByLead: {} }

      const { data: projetos, error: projetosError } = await db
        .from('lead_projetos')
        .select('lead_id, titular_id, arquiteto_id')
        .or(`titular_id.eq.${userId},arquiteto_id.eq.${userId}`)
      if (projetosError) throw projetosError

      const leadIds: number[] = [
        ...new Set(
          (projetos ?? [])
            .map((p) => Number(p.lead_id))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ]

      // Também inclui leads onde sou destinatário explícito (mesmo sem ser titular/arquiteto).
      const { data: paraMim, error: paraMimError } = await db
        .from('lead_projeto_notas')
        .select('lead_id')
        .eq('destinatario_id', userId)
        .limit(500)
      if (paraMimError) throw paraMimError
      for (const row of paraMim ?? []) {
        const id = Number(row.lead_id)
        if (Number.isFinite(id) && id > 0 && !leadIds.includes(id)) leadIds.push(id)
      }

      if (leadIds.length === 0) return { totalUnread: 0, threads: [], lastReadByLead: {} }

      const [{ data: leituras, error: leiturasError }, { data: notas, error: notasError }, { data: leads, error: leadsError }] =
        await Promise.all([
          db
            .from('lead_projeto_chat_leituras')
            .select('lead_id, last_read_at')
            .eq('user_id', userId)
            .in('lead_id', leadIds),
          db
            .from('lead_projeto_notas')
            .select('lead_id, autor_id, destinatario_id, mensagem, criado_em, imagem_url')
            .in('lead_id', leadIds)
            .neq('autor_id', userId)
            .order('criado_em', { ascending: false })
            .limit(2500),
          db.from('leads').select('id, nome').in('id', leadIds),
        ])

      if (leiturasError) throw leiturasError
      if (notasError) throw notasError
      if (leadsError) throw leadsError

      const lastReadByLead = new Map<number, string>()
      const lastReadRecord: Record<number, string> = {}
      for (const row of leituras ?? []) {
        const leadId = Number(row.lead_id)
        const at = String(row.last_read_at)
        lastReadByLead.set(leadId, at)
        lastReadRecord[leadId] = at
      }

      const leadNome = new Map<number, string>()
      for (const lead of leads ?? []) {
        leadNome.set(Number(lead.id), String(lead.nome ?? `Lead #${lead.id}`))
      }

      const unreadByLead = new Map<
        number,
        { count: number; lastPreview: string; lastAt: string }
      >()

      for (const nota of notas ?? []) {
        const destinatarioId = nota.destinatario_id ? String(nota.destinatario_id) : null
        // Endereçada a mim, ou legado sem destinatário (conta no fio do participante).
        const countsForBadge = destinatarioId == null || destinatarioId === userId
        if (!countsForBadge) continue

        const leadId = Number(nota.lead_id)
        const criadoEm = String(nota.criado_em)
        const lastRead = lastReadByLead.get(leadId)
        if (lastRead && new Date(criadoEm).getTime() <= new Date(lastRead).getTime()) {
          continue
        }

        const existing = unreadByLead.get(leadId)
        if (existing) {
          existing.count += 1
          if (criadoEm > existing.lastAt) {
            existing.lastAt = criadoEm
            existing.lastPreview = previewFromNota(
              nota.mensagem as string | null,
              Boolean(nota.imagem_url),
            )
          }
        } else {
          unreadByLead.set(leadId, {
            count: 1,
            lastAt: criadoEm,
            lastPreview: previewFromNota(
              nota.mensagem as string | null,
              Boolean(nota.imagem_url),
            ),
          })
        }
      }

      const threads: ProjetoChatUnreadThread[] = [...unreadByLead.entries()]
        .map(([lead_id, info]) => ({
          lead_id,
          lead_nome: leadNome.get(lead_id) ?? `Lead #${lead_id}`,
          unreadCount: info.count,
          lastPreview: info.lastPreview,
          lastAt: info.lastAt,
        }))
        .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))

      const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0)
      return { totalUnread, threads, lastReadByLead: lastReadRecord }
    },
  })

  useEffect(() => {
    if (!realtime || !schemaEmpresa || !userId) return

    const schema = isSchemaApiExposed(schemaEmpresa) ? schemaEmpresa : 'public'
    const notasTable = isSchemaApiExposed(schemaEmpresa)
      ? 'lead_projeto_notas'
      : 'CRM-multi-empresas>lead_projeto_notas<'
    const leiturasTable = isSchemaApiExposed(schemaEmpresa)
      ? 'lead_projeto_chat_leituras'
      : 'CRM-multi-empresas>lead_projeto_chat_leituras<'

    // Nome único por montagem: vários componentes chamam este hook e o
    // Supabase reutiliza canal pelo nome — .on() após subscribe() estoura.
    const channelName = `lead-projeto-chat-unread-${schemaEmpresa}-${userId}-${Math.random().toString(36).slice(2, 9)}`

    const refreshUnread = () => {
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.refetchQueries({ queryKey, type: 'active' })
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema, table: notasTable }, refreshUnread)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema,
          table: leiturasTable,
          filter: `user_id=eq.${userId}`,
        },
        refreshUnread,
      )
      .subscribe((status) => {
        // Se o canal cair, força uma leitura fresca para o badge não ficar “apagado”.
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          refreshUnread()
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, queryKey, realtime, schemaEmpresa, userId])

  const markLeadChatRead = useMutation({
    mutationFn: async (leadId: number) => {
      if (!userId) throw new Error('Faça login para marcar como lida.')
      // “Não lida” manual ganha de um marcar-lida em voo (abrir conversa).
      if (isAutoReadSuppressed(leadId)) return

      const { error } = await db.from('lead_projeto_chat_leituras').upsert(
        {
          user_id: userId,
          lead_id: leadId,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,lead_id' },
      )
      if (error) throw error

      // Se “não lida” venceu no meio do caminho, restaura o rewind.
      if (isAutoReadSuppressed(leadId)) {
        const rewind = lastUnreadRewindByLead.get(leadId)
        if (rewind) {
          const { error: restoreError } = await db.from('lead_projeto_chat_leituras').upsert(
            {
              user_id: userId,
              lead_id: leadId,
              last_read_at: rewind,
            },
            { onConflict: 'user_id,lead_id' },
          )
          if (restoreError) throw restoreError
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lead-projeto-chat-unread'] })
    },
  })

  /** Volta a conversa para não lida (a partir de uma mensagem ou da última recebida). */
  const markLeadChatUnread = useMutation({
    mutationFn: async (input: { leadId: number; beforeIso?: string }) => {
      if (!userId) throw new Error('Faça login para marcar como não lida.')

      // Bloqueia auto-lida imediatamente (antes do await).
      suppressAutoRead(input.leadId)

      let beforeIso = input.beforeIso
      if (!beforeIso) {
        // 1) Preferência: mensagem endereçada a mim (ou legado sem destinatário).
        const { data: forMe, error: forMeError } = await db
          .from('lead_projeto_notas')
          .select('criado_em')
          .eq('lead_id', input.leadId)
          .neq('autor_id', userId)
          .or(`destinatario_id.eq.${userId},destinatario_id.is.null`)
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (forMeError) throw forMeError

        if (forMe?.criado_em) {
          beforeIso = String(forMe.criado_em)
        } else {
          // 2) Fallback: qualquer mensagem de outra pessoa no fio
          // (admin/projetista vendo o canal ainda consegue marcar não lida).
          const { data: anyOther, error: anyError } = await db
            .from('lead_projeto_notas')
            .select('criado_em')
            .eq('lead_id', input.leadId)
            .neq('autor_id', userId)
            .order('criado_em', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (anyError) throw anyError
          if (!anyOther?.criado_em) {
            throw new Error('Não há mensagem recebida neste canal para marcar.')
          }
          beforeIso = String(anyOther.criado_em)
        }
      }

      const rewind = new Date(new Date(beforeIso).getTime() - 1).toISOString()
      lastUnreadRewindByLead.set(input.leadId, rewind)

      const { error } = await db.from('lead_projeto_chat_leituras').upsert(
        {
          user_id: userId,
          lead_id: input.leadId,
          last_read_at: rewind,
        },
        { onConflict: 'user_id,lead_id' },
      )
      if (error) throw error
      return { leadId: input.leadId, rewind }
    },
    onSuccess: (result) => {
      // Atualiza o cache na hora para o badge acender sem esperar o refetch.
      queryClient.setQueriesData<ProjetoChatUnreadResult>(
        { queryKey: ['lead-projeto-chat-unread'] },
        (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            lastReadByLead: {
              ...prev.lastReadByLead,
              [result.leadId]: result.rewind,
            },
          }
        },
      )
      void queryClient.invalidateQueries({ queryKey: ['lead-projeto-chat-unread'] })
      toast.success('Marcada como não lida')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Não foi possível marcar como não lida')
    },
  })

  const markRead = useCallback(
    (leadId: number) => {
      if (!userId || !leadId) return
      // Ainda na janela pós-“não lida”: não remarcar como lida.
      if (isAutoReadSuppressed(leadId)) return
      clearAutoReadSuppress(leadId)
      markLeadChatRead.mutate(leadId)
    },
    // mutate é estável no React Query v5
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markLeadChatRead.mutate, userId],
  )

  const markUnread = useCallback(
    (leadId: number, beforeIso?: string) => {
      if (!userId || !leadId) return
      suppressAutoRead(leadId)
      markLeadChatUnread.mutate({ leadId, beforeIso })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markLeadChatUnread.mutate, userId],
  )

  const unreadLeadIds = new Set((query.data?.threads ?? []).map((t) => t.lead_id))

  return {
    totalUnread: query.data?.totalUnread ?? 0,
    threads: query.data?.threads ?? [],
    lastReadByLead: query.data?.lastReadByLead ?? {},
    unreadLeadIds,
    isLoading: query.isLoading,
    markLeadChatRead: markRead,
    markLeadChatReadAsync: markLeadChatRead.mutateAsync,
    isMarkingRead: markLeadChatRead.isPending,
    markLeadChatUnread: markUnread,
    isMarkingUnread: markLeadChatUnread.isPending,
  }
}

/** Atalho para telas que só marcam lida/não lida (sem realtime do badge). */
export function useMarkLeadProjetoChatRead() {
  return useProjetoChatUnread({ realtime: false })
}
