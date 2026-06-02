import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ContratoCRM, ContratoCRMDetalhe } from '../types'
import { useAuthReady } from './useAuthReady'

export function useContratos() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<ContratoCRM[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    const { data: rows, error: err } = await supabase.rpc('movelaria_listar_contratos')
    if (err) setError(err.message)
    else setData((rows ?? []) as ContratoCRM[])
    setLoading(false)
  }, [isReady])

  useEffect(() => { load() }, [load])

  const buscarDetalhe = async (id: string): Promise<ContratoCRMDetalhe> => {
    const { data: row, error: err } = await supabase.rpc('movelaria_buscar_contrato', { p_id: id })
    if (err) throw new Error(err.message)
    if (!row) throw new Error('Contrato não encontrado.')
    return row as ContratoCRMDetalhe
  }

  const atualizar = async (
    id: string,
    clienteNome: string,
    identificador: string,
    camposValores: Record<string, string>,
    status?: ContratoCRM['status'],
  ) => {
    const { error: err } = await supabase.rpc('movelaria_atualizar_contrato', {
      p_id: id,
      p_cliente_nome: clienteNome,
      p_identificador: identificador,
      p_campos_valores: camposValores,
      p_status: status ?? null,
    })
    if (err) throw new Error(err.message)
    await load()
  }

  return { data, loading, error, buscarDetalhe, atualizar, reload: load }
}
