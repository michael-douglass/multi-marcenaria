import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase } from '@/integrations/supabase/client'
import { AGENDA_PESSOAL_TABLE, garantirTarefaEventoNaAgenda } from '@/lib/evento-agenda-sync'
import { getEventosDb, resolveEventosTables } from '@/lib/evento-db'
import { parseEventoTarefa } from '@/lib/evento-parse'
import type { EventoTarefa } from '@/lib/evento-types'

interface UseEventoTarefasOptions {
  /** Data do evento (yyyy-MM-dd) — vira o dia da tarefa na Agenda. */
  dataEvento?: string | null
  /** Nome da pasta — entra na descrição da tarefa da Agenda. */
  tituloEvento?: string | null
}

export function useEventoTarefas(eventoId: string | null, options: UseEventoTarefasOptions = {}) {
  const { empresa } = useEmpresa()
  const { user } = useAuth()
  const qc = useQueryClient()
  const schema = empresa?.schema_nome ?? null
  const tables = resolveEventosTables(schema)
  const db = getEventosDb(schema)
  const queryKey = ['evento-tarefas', schema, eventoId] as const
  const dataEvento = options.dataEvento?.slice(0, 10) || null
  const tituloEvento = options.tituloEvento?.trim() || null
  const backfillKeyRef = useRef<string | null>(null)

  const query = useQuery({
    queryKey,
    enabled: Boolean(schema && eventoId),
    queryFn: async (): Promise<EventoTarefa[]> => {
      const { data, error } = await db
        .from(tables.tarefas)
        .select('*')
        .eq('evento_id', eventoId)
        .order('ordem', { ascending: true })
        .order('criado_em', { ascending: true })
      if (error) throw error
      return (data ?? []).map(parseEventoTarefa).filter((t): t is EventoTarefa => t != null)
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['evento-tarefas'] })
    void qc.invalidateQueries({ queryKey: ['controle-eventos'] })
    void qc.invalidateQueries({ queryKey: ['evento-board'] })
    void qc.invalidateQueries({ queryKey: ['agenda-pessoal'] })
  }

  // Tarefas criadas antes do vínculo: ao abrir a pasta, entram na Agenda automaticamente.
  useEffect(() => {
    if (!eventoId || !user?.id || !dataEvento || !query.isSuccess) return
    const orphans = (query.data ?? []).filter((t) => !t.agenda_tarefa_id)
    if (orphans.length === 0) return
    const key = `${eventoId}:${orphans.map((t) => t.id).join(',')}`
    if (backfillKeyRef.current === key) return
    backfillKeyRef.current = key

    void (async () => {
      try {
        for (const tarefa of orphans) {
          await garantirTarefaEventoNaAgenda(db, tables, {
            eventoId,
            eventoTarefaId: tarefa.id,
            titulo: tarefa.titulo,
            concluida: tarefa.concluida,
            dataEvento,
            tituloEvento,
            userId: user.id,
            agendaTarefaIdAtual: tarefa.agenda_tarefa_id,
          })
        }
        invalidate()
      } catch (error) {
        backfillKeyRef.current = null
        console.warn('Não deu para espelhar tarefas antigas na Agenda:', error)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- backfill pontual ao carregar órfãs
  }, [eventoId, user?.id, dataEvento, query.isSuccess, query.data])

  const syncAgendaConcluida = async (eventoTarefaId: string, concluida: boolean, agendaTarefaId?: string | null) => {
    if (agendaTarefaId) {
      const { error } = await supabase
        .from(AGENDA_PESSOAL_TABLE)
        .update({ concluida, atualizado_em: new Date().toISOString() })
        .eq('id', agendaTarefaId)
      if (error) throw error
      return
    }
    const { error } = await supabase
      .from(AGENDA_PESSOAL_TABLE)
      .update({ concluida, atualizado_em: new Date().toISOString() })
      .eq('evento_tarefa_id', eventoTarefaId)
    if (error) throw error
  }

  const syncAgendaExcluir = async (eventoTarefaId: string, agendaTarefaId?: string | null) => {
    if (agendaTarefaId) {
      const { error } = await supabase.from(AGENDA_PESSOAL_TABLE).delete().eq('id', agendaTarefaId)
      if (error) throw error
      return
    }
    const { error } = await supabase.from(AGENDA_PESSOAL_TABLE).delete().eq('evento_tarefa_id', eventoTarefaId)
    if (error) throw error
  }

  const criar = useMutation({
    mutationFn: async (titulo: string) => {
      if (!eventoId) throw new Error('Pasta não encontrada')
      if (!user?.id) throw new Error('Faça login para criar a tarefa na Agenda')
      const nome = titulo.trim()
      if (!nome) throw new Error('Escreva a tarefa')
      if (!dataEvento) throw new Error('Esta pasta precisa de uma data para ir à Agenda')

      const ordem = (query.data ?? []).reduce((acc, t) => Math.max(acc, t.ordem), -1) + 1
      const { data: criada, error } = await db
        .from(tables.tarefas)
        .insert({
          evento_id: eventoId,
          titulo: nome,
          concluida: false,
          ordem,
        })
        .select('*')
        .single()
      if (error) throw error
      const eventoTarefa = parseEventoTarefa(criada)
      if (!eventoTarefa) throw new Error('Não deu para ler a tarefa criada')

      const agendaId = await garantirTarefaEventoNaAgenda(db, tables, {
        eventoId,
        eventoTarefaId: eventoTarefa.id,
        titulo: eventoTarefa.titulo,
        concluida: false,
        dataEvento,
        tituloEvento,
        userId: user.id,
        agendaTarefaIdAtual: null,
      })

      return { ...eventoTarefa, agenda_tarefa_id: agendaId }
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para incluir a tarefa', { description: error.message }),
  })

  const toggle = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const atual = (query.data ?? []).find((t) => t.id === id)
      const { error } = await db
        .from(tables.tarefas)
        .update({ concluida, atualizado_em: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      await syncAgendaConcluida(id, concluida, atual?.agenda_tarefa_id)
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para atualizar a tarefa', { description: error.message }),
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const atual = (query.data ?? []).find((t) => t.id === id)
      await syncAgendaExcluir(id, atual?.agenda_tarefa_id)
      const { error } = await db.from(tables.tarefas).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para apagar a tarefa', { description: error.message }),
  })

  const tarefas = query.data ?? []
  return {
    tarefas,
    pendentes: tarefas.filter((t) => !t.concluida).length,
    loading: query.isLoading,
    criar,
    toggle,
    excluir,
  }
}
