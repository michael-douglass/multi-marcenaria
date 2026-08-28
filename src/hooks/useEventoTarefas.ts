import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { getEventosDb, resolveEventosTables } from '@/lib/evento-db'
import { parseEventoTarefa } from '@/lib/evento-parse'
import type { EventoTarefa } from '@/lib/evento-types'

export function useEventoTarefas(eventoId: string | null) {
  const { empresa } = useEmpresa()
  const qc = useQueryClient()
  const schema = empresa?.schema_nome ?? null
  const tables = resolveEventosTables(schema)
  const db = getEventosDb(schema)
  const queryKey = ['evento-tarefas', schema, eventoId] as const

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
  }

  const criar = useMutation({
    mutationFn: async (titulo: string) => {
      if (!eventoId) throw new Error('Pasta não encontrada')
      const nome = titulo.trim()
      if (!nome) throw new Error('Escreva a tarefa')
      const ordem = (query.data ?? []).reduce((acc, t) => Math.max(acc, t.ordem), -1) + 1
      const { error } = await db.from(tables.tarefas).insert({
        evento_id: eventoId,
        titulo: nome,
        concluida: false,
        ordem,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para incluir a tarefa', { description: error.message }),
  })

  const toggle = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await db
        .from(tables.tarefas)
        .update({ concluida, atualizado_em: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error('Não deu para atualizar a tarefa', { description: error.message }),
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => {
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
