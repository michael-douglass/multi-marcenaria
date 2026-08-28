import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthReady } from '@/hooks/useAuthReady'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { parsePipelineBoot, type CrmPipelineBoot } from '@/lib/crm-pipeline'

const EMPTY: CrmPipelineBoot = { etapas: [], quadros: [], leads: [] }

export function useCrmPipeline() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<CrmPipelineBoot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_pipeline_boot')
      if (err) throw err
      setData(parsePipelineBoot(raw))
    } catch (err) {
      if (!opts?.silent) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar o pipeline.')
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(() => { void load({ silent: true }) })

  const mover = async (leadId: number, status: string) => {
    const { error: err } = await supabase.rpc('movelaria_crm_mover_lead', {
      p_lead_id: leadId,
      p_status: status,
    })
    if (err) throw new Error(err.message)
    setData(prev => ({
      ...prev,
      leads: prev.leads.map(lead => lead.id === leadId ? { ...lead, status } : lead),
    }))
  }

  const salvar = async (input: {
    id: number
    nome: string
    telefone: string
    email: string
    origem: string
    observacoes: string
    valorNegocio: number
    status: string
  }) => {
    const { error: err } = await supabase.rpc('movelaria_crm_salvar_lead', {
      p_lead_id: input.id,
      p_nome: input.nome,
      p_telefone: input.telefone,
      p_email: input.email,
      p_origem: input.origem,
      p_observacoes: input.observacoes,
      p_valor_negocio: input.valorNegocio,
      p_status: input.status,
    })
    if (err) throw new Error(err.message)
    setData(prev => ({
      ...prev,
      leads: prev.leads.map(lead => lead.id === input.id ? {
        ...lead,
        nome: input.nome.trim(),
        telefone: input.telefone.trim() || null,
        email: input.email.trim() || null,
        origem: input.origem.trim() || null,
        observacoes: input.observacoes.trim() || null,
        valorNegocio: input.valorNegocio,
        status: input.status,
      } : lead),
    }))
  }

  const criar = async (input: { nome: string; telefone: string; origem: string }) => {
    const { data: id, error: err } = await supabase.rpc('movelaria_crm_criar_lead', {
      p_nome: input.nome,
      p_telefone: input.telefone,
      p_origem: input.origem,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
    return Number(id)
  }

  return { data, loading, error, reload: load, mover, salvar, criar }
}
