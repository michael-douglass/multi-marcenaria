import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { uploadReciboAssinado, getFuncionarioDocSignedUrl } from '@/lib/funcionario-documentos'
import { renderReciboAssinadoBlob } from '@/lib/funcionario-recibo-print'
import {
  mapRecibosComContaPagar,
  reciboPendenteAssinatura,
  RECIBO_SELECT_COM_CONTA_PAGAR,
} from '@/lib/funcionario-recibos'
import type { FuncionarioRecibo } from '@/types'
import { useAuthReady } from './useAuthReady'

export function usePrestadorRecibos() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<FuncionarioRecibo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('movelaria_funcionario_recibos')
        .select(RECIBO_SELECT_COM_CONTA_PAGAR)
        .order('criado_em', { ascending: false })
      if (err) throw err
      setData(mapRecibosComContaPagar(rows))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar recibos.')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])

  const enviarAssinatura = async (reciboId: string) => {
    const { error } = await supabase.rpc('movelaria_funcionario_recibo_enviar_assinatura', {
      p_recibo_id: reciboId,
    })
    if (error) throw new Error(error.message)
    await load()
  }

  const assinar = async (
    recibo: FuncionarioRecibo,
    funcionarioId: string,
    assinaturaDataUrl: string,
  ) => {
    const blob = await renderReciboAssinadoBlob(recibo, assinaturaDataUrl)
    const path = await uploadReciboAssinado(funcionarioId, recibo.id, blob)
    const { error } = await supabase.rpc('movelaria_funcionario_recibo_assinar', {
      p_recibo_id: recibo.id,
      p_assinatura_path: path,
    })
    if (error) throw new Error(error.message)
    await load()
  }

  const getAssinadoUrl = async (path: string) => getFuncionarioDocSignedUrl(path)

  const pendentes = data.filter(reciboPendenteAssinatura)

  return {
    data,
    pendentes,
    loading,
    error,
    reload: load,
    enviarAssinatura,
    assinar,
    getAssinadoUrl,
  }
}
