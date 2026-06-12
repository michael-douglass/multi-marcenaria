import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { splitObraInputForSave } from '../lib/obra-montadores'
import { splitComissaoForSave } from '../lib/obra-comissao'
import type { ObraFull, ObraInput } from '../types'
import { useAuthReady } from './useAuthReady'

async function syncObraMontadores(obraId: string, montadorIds: string[]) {
  const { error } = await supabase.rpc('movelaria_sincronizar_obra_montadores', {
    p_obra_id: obraId,
    p_montador_ids: montadorIds,
  })
  if (error) throw new Error(error.message)
}

async function syncObraComissao(obraId: string, input: Pick<ObraInput, 'comissao_habilitada' | 'comissao_itens'>) {
  const { habilitada, prestadorIds, valores } = splitComissaoForSave({
    comissao_habilitada: input.comissao_habilitada ?? false,
    comissao_itens: input.comissao_itens ?? [],
  })
  const { error } = await supabase.rpc('movelaria_sincronizar_obra_comissao', {
    p_obra_id: obraId,
    p_habilitada: habilitada,
    p_prestador_ids: prestadorIds,
    p_valores: valores,
  })
  if (error) throw new Error(error.message)
}

function stripComissaoFromObraPayload<T extends ObraInput>(input: T) {
  const { comissao_habilitada: _h, comissao_itens: _i, ...rest } = input
  return rest
}

export function useObras() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<ObraFull[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase.rpc('movelaria_listar_obras')
      if (err) throw err
      setData((rows ?? []) as ObraFull[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar obras.')
      if (!opts?.silent) setData([])
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!isReady) return

    let reloadTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        void load({ silent: true })
      }, 350)
    }

    const channel = supabase
      .channel(`movelaria-obras-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_obras' },
        scheduleReload,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_obra_responsaveis' },
        scheduleReload,
      )
      .subscribe()

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      void supabase.removeChannel(channel)
    }
  }, [isReady, load])

  const create = async (input: ObraInput): Promise<string> => {
    const { obraFields, montadorIds } = splitObraInputForSave(stripComissaoFromObraPayload(input))
    const { data: row, error: err } = await supabase
      .from('movelaria_obras')
      .insert(obraFields)
      .select('id')
      .single()
    if (err) throw new Error(err.message)
    await syncObraMontadores(row.id, montadorIds)
    if (input.comissao_habilitada || (input.comissao_itens?.length ?? 0) > 0) {
      await syncObraComissao(row.id, input)
    }
    await load()
    return row.id as string
  }

  const update = async (id: string, input: Partial<ObraInput>) => {
    const { montador_ids, comissao_habilitada, comissao_itens, ...rest } = input
    const updatePayload: Partial<ObraInput> = stripComissaoFromObraPayload({ ...rest } as ObraInput)

    if (montador_ids !== undefined) {
      const ids = [...new Set(montador_ids.filter(Boolean))]
      updatePayload.montador_id = ids[0] ?? null
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: err } = await supabase
        .from('movelaria_obras')
        .update(updatePayload)
        .eq('id', id)
      if (err) throw new Error(err.message)
    }

    if (montador_ids !== undefined) {
      await syncObraMontadores(id, [...new Set(montador_ids.filter(Boolean))])
    }

    if (comissao_habilitada !== undefined || comissao_itens !== undefined) {
      await syncObraComissao(id, {
        comissao_habilitada,
        comissao_itens,
      })
    }

    await load({ silent: true })
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('movelaria_obras').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(o => o.id !== id))
  }

  const iniciarObra = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_iniciar_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const finalizarObra = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_finalizar_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  /** Marca a obra como concluída e gera comissões automaticamente no servidor. */
  const concluirObra = async (id: string) => {
    const obra = data.find(o => o.id === id)
    if (obra && (obra.status_kanban === 'concluida' || obra.finalizado_em)) return

    const { error: err } = await supabase.rpc('movelaria_concluir_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const aplicarComissao = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_aplicar_comissao_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  return {
    data, loading, error, create, update, remove,
    iniciarObra, finalizarObra, concluirObra, aplicarComissao, reload: load,
  }
}
