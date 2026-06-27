import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { splitObraInputForSave } from '../lib/obra-montadores'
import { splitComissaoForSave } from '../lib/obra-comissao'
import { createId } from '../lib/utils'
import type { ObraFull, ObraInput } from '../types'
import { useAuthReady } from './useAuthReady'
import { useAutoRefresh } from './useAutoRefresh'

const OBRAS_REALTIME_CHANNEL = 'movelaria-obras-sync'

async function syncObraMontadores(obraId: string, montadorIds: string[]) {
  const { error } = await supabase.rpc('movelaria_sincronizar_obra_montadores', {
    p_obra_id: obraId,
    p_montador_ids: montadorIds,
  })
  if (error) throw new Error(error.message)
}

async function syncObraComissao(obraId: string, input: Pick<ObraInput, 'comissao_habilitada' | 'comissao_itens'>) {
  const { habilitada, prestadorIds, valores, ocultos } = splitComissaoForSave({
    comissao_habilitada: input.comissao_habilitada ?? false,
    comissao_itens: input.comissao_itens ?? [],
  })
  const { error } = await supabase.rpc('movelaria_sincronizar_obra_comissao', {
    p_obra_id: obraId,
    p_habilitada: habilitada,
    p_prestador_ids: prestadorIds,
    p_valores: valores,
    p_ocultos: ocultos,
  })
  if (error) throw new Error(error.message)
}

function stripComissaoFromObraPayload<T extends ObraInput>(input: T) {
  const { comissao_habilitada: _h, comissao_itens: _i, ...rest } = input
  return rest
}

export interface ObraUpdateOptions {
  /** Sincroniza comissão apenas quando o usuário tem permissão (evita falha em edições parciais). */
  syncComissao?: boolean
}

export interface ObrasStore {
  data: ObraFull[]
  loading: boolean
  error: string | null
  create: (input: ObraInput) => Promise<string>
  update: (id: string, input: Partial<ObraInput>, options?: ObraUpdateOptions) => Promise<void>
  remove: (id: string) => Promise<void>
  iniciarObra: (id: string) => Promise<void>
  finalizarObra: (id: string) => Promise<void>
  concluirObra: (id: string) => Promise<void>
  aplicarComissao: (id: string) => Promise<void>
  reload: (opts?: { silent?: boolean }) => Promise<void>
}

/** Estado compartilhado de obras — usado pelo ObrasProvider (uma única fonte para todo o app). */
export function useObrasState(): ObrasStore {
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

  const silentReload = useCallback(() => {
    void load({ silent: true })
  }, [load])

  useEffect(() => { void load() }, [load])

  useAutoRefresh(silentReload)

  useEffect(() => {
    if (!isReady) return

    const channel = supabase
      .channel(OBRAS_REALTIME_CHANNEL)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_obras' },
        silentReload,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_obra_responsaveis' },
        silentReload,
      )
      .on('broadcast', { event: 'obras:changed' }, silentReload)
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isReady, silentReload])

  const notifyObrasChanged = useCallback(() => {
    void supabase.channel(OBRAS_REALTIME_CHANNEL).send({
      type: 'broadcast',
      event: 'obras:changed',
      payload: {},
    })
  }, [])

  const create = async (input: ObraInput): Promise<string> => {
    let payload = stripComissaoFromObraPayload(input)
    if (!payload.montador_admin_id) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        const { data: profile } = await supabase
          .from('movelaria_usuarios')
          .select('perfil')
          .eq('id', user.id)
          .maybeSingle()
        if (profile?.perfil === 'montador_admin') {
          payload = { ...payload, montador_admin_id: user.id }
        }
      }
    }
    const obraId = createId()
    const { obraFields, montadorIds } = splitObraInputForSave(payload)
    const { error: err } = await supabase
      .from('movelaria_obras')
      .insert({ ...obraFields, id: obraId })
    if (err) throw new Error(err.message)
    await syncObraMontadores(obraId, montadorIds)
    if (input.comissao_habilitada || (input.comissao_itens?.length ?? 0) > 0) {
      await syncObraComissao(obraId, input)
    }
    await load({ silent: true })
    notifyObrasChanged()
    return obraId
  }

  const update = async (id: string, input: Partial<ObraInput>, options?: ObraUpdateOptions) => {
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

    if (
      options?.syncComissao
      && (comissao_habilitada !== undefined || comissao_itens !== undefined)
    ) {
      await syncObraComissao(id, {
        comissao_habilitada,
        comissao_itens,
      })
    }

    await load({ silent: true })
    notifyObrasChanged()
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('movelaria_obras').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(o => o.id !== id))
    notifyObrasChanged()
  }

  const iniciarObra = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_iniciar_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true })
    notifyObrasChanged()
  }

  const finalizarObra = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_finalizar_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true })
    notifyObrasChanged()
  }

  const concluirObra = async (id: string) => {
    const obra = data.find(o => o.id === id)
    if (obra && (obra.status_kanban === 'concluida' || obra.finalizado_em)) return

    const { error: err } = await supabase.rpc('movelaria_concluir_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true })
    notifyObrasChanged()
  }

  const aplicarComissao = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_aplicar_comissao_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true })
    notifyObrasChanged()
  }

  return {
    data, loading, error, create, update, remove,
    iniciarObra, finalizarObra, concluirObra, aplicarComissao, reload: load,
  }
}
