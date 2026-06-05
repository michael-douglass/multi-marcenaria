import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { splitObraInputForSave } from '../lib/obra-montadores'
import type { ObraFull, ObraInput } from '../types'
import { useAuthReady } from './useAuthReady'

async function syncObraMontadores(obraId: string, montadorIds: string[]) {
  const { error } = await supabase.rpc('movelaria_sincronizar_obra_montadores', {
    p_obra_id: obraId,
    p_montador_ids: montadorIds,
  })
  if (error) throw new Error(error.message)
}

export function useObras() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<ObraFull[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase.rpc('movelaria_listar_obras')
      if (err) throw err
      setData((rows ?? []) as ObraFull[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar obras.')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])

  const create = async (input: ObraInput) => {
    const { obraFields, montadorIds } = splitObraInputForSave(input)
    const { data: row, error: err } = await supabase
      .from('movelaria_obras')
      .insert(obraFields)
      .select('id')
      .single()
    if (err) throw new Error(err.message)
    await syncObraMontadores(row.id, montadorIds)
    await load()
  }

  const update = async (id: string, input: Partial<ObraInput>) => {
    const { montador_ids, ...rest } = input
    const updatePayload: Partial<ObraInput> = { ...rest }

    if (montador_ids !== undefined) {
      const ids = [...new Set(montador_ids.filter(Boolean))]
      updatePayload.montador_id = ids[0] ?? null
    }

    const { error: err } = await supabase
      .from('movelaria_obras')
      .update(updatePayload)
      .eq('id', id)
    if (err) throw new Error(err.message)

    if (montador_ids !== undefined) {
      await syncObraMontadores(id, [...new Set(montador_ids.filter(Boolean))])
    }

    await load()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('movelaria_obras').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(o => o.id !== id))
  }

  const iniciarObra = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_iniciar_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load()
  }

  const finalizarObra = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_finalizar_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load()
  }

  /** Marca a obra como concluída (Kanban + calendário). Funciona mesmo sem "Iniciar" antes. */
  const concluirObra = async (id: string) => {
    const obra = data.find(o => o.id === id)
    if (!obra || obra.status_kanban === 'concluida' || obra.finalizado_em) return

    if (obra.iniciado_em) {
      await finalizarObra(id)
      return
    }

    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('movelaria_obras')
      .update({
        status_kanban: 'concluida',
        iniciado_em: now,
        finalizado_em: now,
      })
      .eq('id', id)

    if (err) throw new Error(err.message)
    await load()
  }

  return {
    data, loading, error, create, update, remove,
    iniciarObra, finalizarObra, concluirObra, reload: load,
  }
}
