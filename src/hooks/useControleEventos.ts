import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { supabase } from '@/integrations/supabase/client'
import { garantirTarefaEventoNaAgenda } from '@/lib/evento-agenda-sync'
import { EVENTO_STORAGE_BUCKET, getEventosDb, resolveEventosTables } from '@/lib/evento-db'
import {
  ordenarPastasEvento,
  proximaOrdemPin,
  totalLinhaItem,
} from '@/lib/evento-helpers'
import { parseEventoItem, parseEventoPasta, parseEventoTarefa } from '@/lib/evento-parse'
import { EVENTO_CADERNOS_PADRAO } from '@/lib/evento-types'
import type { EventoPastaCard, EventoTipo } from '@/lib/evento-types'

export interface EventoPastaInput {
  titulo: string
  data_evento: string
  tipo: EventoTipo
  tipo_custom?: string | null
  observacoes?: string | null
}

export function useControleEventos() {
  const { empresa } = useEmpresa()
  const { user } = useAuth()
  const qc = useQueryClient()
  const schema = empresa?.schema_nome ?? null
  const tables = resolveEventosTables(schema)
  const db = getEventosDb(schema)
  const queryKey = ['controle-eventos', schema] as const
  const backfillKeyRef = useRef<string | null>(null)

  const query = useQuery({
    queryKey,
    enabled: Boolean(schema),
    queryFn: async (): Promise<EventoPastaCard[]> => {
      const { data: eventosRaw, error } = await db.from(tables.eventos).select('*')
      if (error) throw error
      const pastas = (eventosRaw ?? []).map(parseEventoPasta).filter((p): p is NonNullable<typeof p> => p != null)

      const ids = pastas.map((p) => p.id)
      if (ids.length === 0) return []

      const [{ data: participantes }, { data: itensRaw }, { data: tarefasRaw }] = await Promise.all([
        db.from(tables.participantes).select('id, evento_id').in('evento_id', ids),
        db.from(tables.itens).select('id, evento_id, quantidade, preco_unitario').in('evento_id', ids),
        db
          .from(tables.tarefas)
          .select('id, evento_id, titulo, concluida, agenda_tarefa_id')
          .in('evento_id', ids),
      ])

      const pessoasBy = new Map<string, number>()
      for (const row of participantes ?? []) {
        const eventoId = String((row as { evento_id?: string }).evento_id ?? '')
        pessoasBy.set(eventoId, (pessoasBy.get(eventoId) ?? 0) + 1)
      }

      const itensBy = new Map<string, { qtd: number; valor: number }>()
      for (const raw of itensRaw ?? []) {
        const item = parseEventoItem({ ...raw, midias: [] })
        if (!item) continue
        const prev = itensBy.get(item.evento_id) ?? { qtd: 0, valor: 0 }
        itensBy.set(item.evento_id, {
          qtd: prev.qtd + 1,
          valor: prev.valor + totalLinhaItem(item),
        })
      }

      const pendentesBy = new Map<string, number>()
      for (const raw of tarefasRaw ?? []) {
        const tarefa = parseEventoTarefa(raw)
        if (!tarefa || tarefa.concluida) continue
        pendentesBy.set(tarefa.evento_id, (pendentesBy.get(tarefa.evento_id) ?? 0) + 1)
      }

      return ordenarPastasEvento(
        pastas.map((pasta) => ({
          ...pasta,
          pessoas: pessoasBy.get(pasta.id) ?? 0,
          itens: itensBy.get(pasta.id)?.qtd ?? 0,
          valor_estimado: itensBy.get(pasta.id)?.valor ?? 0,
          tarefas_pendentes: pendentesBy.get(pasta.id) ?? 0,
        })),
      )
    },
  })

  // Tarefas antigas sem espelho: ao abrir a lista, entram na Agenda.
  useEffect(() => {
    if (!user?.id || !schema || !query.isSuccess || !query.data?.length) return
    const pastas = query.data
    const key = `${schema}:${pastas.map((p) => `${p.id}:${p.tarefas_pendentes}`).join('|')}:${query.dataUpdatedAt}`
    if (backfillKeyRef.current === key) return
    backfillKeyRef.current = key

    void (async () => {
      try {
        const ids = pastas.map((p) => p.id)
        const { data: tarefasRaw, error } = await db
          .from(tables.tarefas)
          .select('id, evento_id, titulo, concluida, agenda_tarefa_id')
          .in('evento_id', ids)
          .is('agenda_tarefa_id', null)
        if (error) throw error
        const orphans = (tarefasRaw ?? [])
          .map(parseEventoTarefa)
          .filter((t): t is NonNullable<typeof t> => t != null && !t.agenda_tarefa_id)
        if (orphans.length === 0) return

        const pastaById = new Map(pastas.map((p) => [p.id, p]))
        for (const tarefa of orphans) {
          const pasta = pastaById.get(tarefa.evento_id)
          if (!pasta?.data_evento) continue
          await garantirTarefaEventoNaAgenda(db, tables, {
            eventoId: pasta.id,
            eventoTarefaId: tarefa.id,
            titulo: tarefa.titulo,
            concluida: tarefa.concluida,
            dataEvento: pasta.data_evento,
            tituloEvento: pasta.titulo,
            userId: user.id,
            agendaTarefaIdAtual: tarefa.agenda_tarefa_id,
          })
        }
        void qc.invalidateQueries({ queryKey: ['agenda-pessoal'] })
        void qc.invalidateQueries({ queryKey: ['evento-tarefas'] })
      } catch (error) {
        backfillKeyRef.current = null
        console.warn('Não deu para espelhar tarefas de eventos na Agenda:', error)
      }
    })()
  }, [user?.id, schema, query.isSuccess, query.data, query.dataUpdatedAt, db, tables, qc])

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey })
    void qc.invalidateQueries({ queryKey: ['evento-board'] })
    void qc.invalidateQueries({ queryKey: ['evento-tarefas'] })
    void qc.invalidateQueries({ queryKey: ['agenda-pessoal'] })
  }

  const criar = useMutation({
    mutationFn: async (input: EventoPastaInput) => {
      const titulo = input.titulo.trim()
      if (!titulo) throw new Error('Dê um nome à pasta')
      const { data, error } = await db
        .from(tables.eventos)
        .insert({
          titulo,
          data_evento: input.data_evento,
          tipo: input.tipo,
          tipo_custom: input.tipo === 'outro' ? (input.tipo_custom?.trim() || null) : null,
          observacoes: input.observacoes?.trim() || null,
          criado_por: user?.id ?? null,
        })
        .select('*')
        .single()
      if (error) throw error
      const pasta = parseEventoPasta(data)
      if (!pasta) throw new Error('Não foi possível criar a pasta')

      const { data: cadernosRaw, error: cadernosError } = await db
        .from(tables.cadernos)
        .insert(
          EVENTO_CADERNOS_PADRAO.map((c, ordem) => ({
            evento_id: pasta.id,
            titulo: c.titulo,
            dica: c.dica,
            ordem,
          })),
        )
        .select('*')
      if (cadernosError) throw cadernosError

      const cadernos = [...(cadernosRaw ?? [])].sort(
        (a, b) => Number((a as { ordem?: number }).ordem ?? 0) - Number((b as { ordem?: number }).ordem ?? 0),
      )
      if (cadernos.length === 0) throw new Error('Não foi possível criar os cadernos')

      const { error: paginasError } = await db.from(tables.paginas).insert(
        cadernos.map((row, i) => {
          const padrao = EVENTO_CADERNOS_PADRAO[i] ?? EVENTO_CADERNOS_PADRAO[0]
          return {
            evento_id: pasta.id,
            caderno_id: String((row as { id: string }).id),
            secao: padrao.secao,
            titulo: '',
            corpo: '',
            ordem: 0,
          }
        }),
      )
      if (paginasError) throw paginasError
      return pasta
    },
    onSuccess: () => {
      invalidate()
      toast.success('Pasta criada')
    },
    onError: (error: Error) => toast.error('Não deu para criar', { description: error.message }),
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, ...input }: EventoPastaInput & { id: string }) => {
      const { error } = await db
        .from(tables.eventos)
        .update({
          titulo: input.titulo.trim(),
          data_evento: input.data_evento,
          tipo: input.tipo,
          tipo_custom: input.tipo === 'outro' ? (input.tipo_custom?.trim() || null) : null,
          observacoes: input.observacoes?.trim() || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success('Pasta atualizada')
    },
    onError: (error: Error) => toast.error('Não deu para salvar', { description: error.message }),
  })

  const atualizarData = useMutation({
    mutationFn: async ({ id, data_evento }: { id: string; data_evento: string }) => {
      const { error } = await db
        .from(tables.eventos)
        .update({ data_evento, atualizado_em: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error('Não deu para mudar a data', { description: error.message }),
  })

  const fixar = useMutation({
    mutationFn: async ({ id, fixado }: { id: string; fixado: boolean }) => {
      const ordem = fixado ? proximaOrdemPin(query.data ?? []) : null
      const { error } = await db
        .from(tables.eventos)
        .update({ fixado, ordem_topo: ordem, atualizado_em: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error('Não deu para fixar', { description: error.message }),
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const [{ data: participantes }, { data: itens }, { data: galeria }] = await Promise.all([
        db.from(tables.participantes).select('id').eq('evento_id', id),
        db.from(tables.itens).select('id').eq('evento_id', id),
        db.from(tables.eventoMidias).select('storage_path').eq('evento_id', id),
      ])
      const partIds = (participantes ?? []).map((row) => String((row as { id: string }).id))
      const itemIds = (itens ?? []).map((row) => String((row as { id: string }).id))
      const midiaQueries = [
        partIds.length > 0
          ? db.from(tables.participanteMidias).select('storage_path').in('participante_id', partIds)
          : Promise.resolve({ data: [] as { storage_path?: string | null }[] }),
        itemIds.length > 0
          ? db.from(tables.itemMidias).select('storage_path').in('item_id', itemIds)
          : Promise.resolve({ data: [] as { storage_path?: string | null }[] }),
      ] as const
      const [partMidias, itemMidias] = await Promise.all(midiaQueries)

      const paths = [
        ...(partMidias.data ?? []),
        ...(itemMidias.data ?? []),
        ...(galeria ?? []),
      ]
        .map((row) => (row as { storage_path?: string | null }).storage_path)
        .filter((path): path is string => Boolean(path))

      const { error } = await db.from(tables.eventos).delete().eq('id', id)
      if (error) throw error

      if (paths.length > 0) {
        await supabase.storage.from(EVENTO_STORAGE_BUCKET).remove(paths)
      }
    },
    onSuccess: () => {
      invalidate()
      toast.success('Pasta excluída')
    },
    onError: (error: Error) => toast.error('Não deu para excluir', { description: error.message }),
  })

  return {
    pastas: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    criar,
    atualizar,
    atualizarData,
    fixar,
    excluir,
  }
}
