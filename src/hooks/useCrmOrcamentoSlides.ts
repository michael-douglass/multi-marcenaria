import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthReady } from '@/hooks/useAuthReady'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import {
  parseSlide,
  parseSlidesBoot,
  type CrmOrcamentoSlide,
  type CrmSlidesBoot,
} from '@/lib/crm-orcamento-slides'
import type { OrcamentoSlideDados } from '@/types/orcamento-publico'

const EMPTY: CrmSlidesBoot = { slides: [], leads: [] }

export function useCrmOrcamentoSlides() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<CrmSlidesBoot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_slides_boot')
      if (err) throw err
      setData(parseSlidesBoot(raw))
    } catch (err) {
      if (!opts?.silent) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar os slides.')
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(() => { void load({ silent: true }) })

  const salvar = async (input: {
    id: string
    clienteNome: string
    identificador: string
    leadId: number | null
    status: string
    dados: OrcamentoSlideDados
  }) => {
    const { data: raw, error: err } = await supabase.rpc('movelaria_crm_slide_salvar', {
      p_id: input.id,
      p_cliente_nome: input.clienteNome,
      p_identificador: input.identificador,
      p_lead_id: input.leadId,
      p_status: input.status,
      p_dados: input.dados,
    })
    if (err) throw new Error(err.message)
    const saved = parseSlide(raw)
    setData(prev => ({
      ...prev,
      slides: prev.slides.map(item => item.id === saved.id ? { ...item, ...saved } : item),
    }))
    return saved
  }

  const criar = async (clienteNome: string, leadId: number | null): Promise<CrmOrcamentoSlide> => {
    const { data: raw, error: err } = await supabase.rpc('movelaria_crm_slide_criar', {
      p_cliente_nome: clienteNome,
      p_lead_id: leadId,
    })
    if (err) throw new Error(err.message)
    const created = parseSlide(raw)
    await load({ silent: true })
    return created
  }

  return { data, loading, error, reload: load, salvar, criar }
}
