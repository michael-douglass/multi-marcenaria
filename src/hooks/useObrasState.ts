import { useState, useEffect, useCallback, useId, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { splitObraInputForSave } from '../lib/obra-montadores'
import { splitComissaoForSave } from '../lib/obra-comissao'
import { createId } from '../lib/utils'
import {
  invalidateCache,
  isCacheKeyFresh,
  OBRAS_CACHE_KEY,
  readCache,
  writeCache,
} from '../lib/data-cache'
import type { ObraFull, ObraInput } from '../types'
import { useAuthReady } from './useAuthReady'
import { useAutoRefresh } from './useAutoRefresh'

const OBRAS_REALTIME_CHANNEL = 'movelaria-obras-sync'
/** Junta vários eventos do realtime num único GET (evita tempestade na Agenda). */
const SILENT_RELOAD_DEBOUNCE_MS = 800

function readCachedObras(): ObraFull[] {
  return readCache<ObraFull[]>(OBRAS_CACHE_KEY)?.value ?? []
}

/** Assinatura leve: se nada mudou, não redesenha o Kanban. */
function obrasFingerprint(rows: ObraFull[]): string {
  return rows
    .map(o =>
      [
        o.id,
        o.status_kanban,
        o.atualizado_em ?? '',
        o.cliente_nome ?? '',
        o.lousa ?? '',
        o.iniciado_em ?? '',
        o.finalizado_em ?? '',
        o.data_prevista_inicio ?? '',
        o.data_prevista_fim ?? '',
        o.pedido_material_feito ? '1' : '0',
        o.data_entrega_pedido ?? '',
        o.numero_pedido_cort_claud ?? '',
        o.montador_id ?? '',
        (o.montador_ids ?? []).join(','),
        o.comissao_habilitada ? '1' : '0',
        o.comissao_total ?? 0,
        (o.comissao_valores ?? []).join(','),
      ].join(':'),
    )
    .join('|')
}

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
  const realtimeChannelId = useId().replace(/:/g, '')
  const fingerprintRef = useRef('')
  const [data, setData] = useState<ObraFull[]>(() => {
    const cached = readCachedObras()
    if (cached.length > 0) fingerprintRef.current = obrasFingerprint(cached)
    return cached
  })
  const [loading, setLoading] = useState(() => readCache(OBRAS_CACHE_KEY) == null)
  const [error, setError] = useState<string | null>(null)
  const loadInFlightRef = useRef(false)
  const pendingReloadRef = useRef<{ silent: boolean; force: boolean } | null>(null)
  const silentReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hadRealtimeRef = useRef(false)

  const load = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    if (!isReady) return

    const silent = Boolean(opts?.silent)
    const force = Boolean(opts?.force)

    if (loadInFlightRef.current) {
      const pending = pendingReloadRef.current
      pendingReloadRef.current = {
        silent: pending ? pending.silent && silent : silent,
        force: pending ? pending.force || force : force,
      }
      return
    }

    if (!force && isCacheKeyFresh(OBRAS_CACHE_KEY)) return

    loadInFlightRef.current = true
    if (!silent && fingerprintRef.current === '') setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase.rpc('movelaria_listar_obras')
      if (err) throw err
      const next = (rows ?? []) as ObraFull[]
      writeCache(OBRAS_CACHE_KEY, next)
      const nextFp = obrasFingerprint(next)
      if (nextFp !== fingerprintRef.current) {
        fingerprintRef.current = nextFp
        setData(next)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar obras.')
      if (!silent && fingerprintRef.current === '') {
        fingerprintRef.current = ''
        setData([])
        invalidateCache(OBRAS_CACHE_KEY)
      }
    } finally {
      loadInFlightRef.current = false
      if (!silent) setLoading(false)
      const pending = pendingReloadRef.current
      pendingReloadRef.current = null
      if (pending) void load(pending)
    }
  }, [isReady])

  const silentReload = useCallback((force = false) => {
    if (silentReloadTimerRef.current) clearTimeout(silentReloadTimerRef.current)
    silentReloadTimerRef.current = setTimeout(() => {
      silentReloadTimerRef.current = null
      void load({ silent: true, force })
    }, SILENT_RELOAD_DEBOUNCE_MS)
  }, [load])

  const silentReloadCached = useCallback(() => {
    silentReload(false)
  }, [silentReload])

  const silentReloadLive = useCallback(() => {
    invalidateCache(OBRAS_CACHE_KEY)
    silentReload(true)
  }, [silentReload])

  useEffect(() => {
    void load({ silent: fingerprintRef.current !== '' })
  }, [load])

  // Realtime já cobre mudanças ao vivo; poll só como rede de segurança.
  useAutoRefresh(silentReloadCached)

  useEffect(() => {
    if (!isReady) return

    const channel = supabase
      .channel(`${OBRAS_REALTIME_CHANNEL}-${realtimeChannelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_obras' },
        silentReloadLive,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movelaria_obra_responsaveis' },
        silentReloadLive,
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (hadRealtimeRef.current) {
          // Reconexão (iPhone volta do segundo plano): só busca se o cache já envelheceu.
          silentReload(false)
          return
        }
        hadRealtimeRef.current = true
      })

    return () => {
      if (silentReloadTimerRef.current) {
        clearTimeout(silentReloadTimerRef.current)
        silentReloadTimerRef.current = null
      }
      void supabase.removeChannel(channel)
    }
  }, [isReady, silentReload, silentReloadLive, realtimeChannelId])

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
    await load({ silent: true, force: true })
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

    await load({ silent: true, force: true })
  }

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('movelaria_obras').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => {
      const next = prev.filter(o => o.id !== id)
      fingerprintRef.current = obrasFingerprint(next)
      writeCache(OBRAS_CACHE_KEY, next)
      return next
    })
  }

  const iniciarObra = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_iniciar_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true, force: true })
  }

  const finalizarObra = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_finalizar_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true, force: true })
  }

  const concluirObra = async (id: string) => {
    const obra = data.find(o => o.id === id)
    if (obra && (obra.status_kanban === 'concluida' || obra.finalizado_em)) return

    const { error: err } = await supabase.rpc('movelaria_concluir_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true, force: true })
  }

  const aplicarComissao = async (id: string) => {
    const { error: err } = await supabase.rpc('movelaria_aplicar_comissao_obra', { p_obra_id: id })
    if (err) throw new Error(err.message)
    await load({ silent: true, force: true })
  }

  const reload = useCallback(
    (opts?: { silent?: boolean }) => load({ silent: opts?.silent, force: true }),
    [load],
  )

  return {
    data, loading, error, create, update, remove,
    iniciarObra, finalizarObra, concluirObra, aplicarComissao, reload,
  }
}
