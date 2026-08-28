import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthReady } from '@/hooks/useAuthReady'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { parseContrato, parseContratosBoot, type CrmContrato, type CrmContratosBoot } from '@/lib/crm-contratos'

const EMPTY: CrmContratosBoot = { contratos: [], modelos: [], variaveis: [], leads: [] }

export function useCrmContratos() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<CrmContratosBoot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_contratos_boot')
      if (err) throw err
      setData(parseContratosBoot(raw))
    } catch (err) {
      if (!opts?.silent) setError(err instanceof Error ? err.message : 'Erro ao carregar contratos.')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(() => { void load({ silent: true }) })

  const salvar = async (input: {
    id: string
    identificador: string
    clienteNome: string
    status: string
    leadId: number | null
    campos: Record<string, string>
    conteudo: string
  }) => {
    const { data: raw, error: err } = await supabase.rpc('movelaria_crm_contrato_salvar', {
      p_id: input.id,
      p_identificador: input.identificador,
      p_cliente_nome: input.clienteNome,
      p_status: input.status,
      p_lead_id: input.leadId,
      p_campos: input.campos,
      p_conteudo: input.conteudo,
    })
    if (err) throw new Error(err.message)
    const saved = parseContrato(raw)
    setData(prev => ({
      ...prev,
      contratos: prev.contratos.map(c => c.id === saved.id ? { ...c, ...saved } : c),
    }))
    return saved
  }

  const criar = async (input: {
    identificador: string
    clienteNome: string
    leadId: number | null
    campos: Record<string, string>
    conteudo: string
  }): Promise<CrmContrato> => {
    const { data: raw, error: err } = await supabase.rpc('movelaria_crm_contrato_criar', {
      p_identificador: input.identificador,
      p_cliente_nome: input.clienteNome,
      p_lead_id: input.leadId,
      p_campos: input.campos,
      p_conteudo: input.conteudo,
    })
    if (err) throw new Error(err.message)
    const created = parseContrato(raw)
    await load({ silent: true })
    return created
  }

  return { data, loading, error, reload: load, salvar, criar }
}
