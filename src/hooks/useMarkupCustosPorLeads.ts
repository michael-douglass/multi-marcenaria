import { useEffect, useMemo, useState } from 'react'
import { collectObraLeadIds, mapMarkupCustosRows } from '@/lib/obra-markup-custos'
import { supabase } from '@/lib/supabase'
import type { MarkupOrcamentoCustos, ObraFull } from '@/types'

/**
 * Carrega totais do markup (emp_garbo) por lead das obras.
 * Só faz a chamada quando enabled (Administrador).
 */
export function useMarkupCustosPorLeads(
  obras: Pick<ObraFull, 'origem_lead_id'>[],
  enabled: boolean,
) {
  const [custosByLead, setCustosByLead] = useState<Map<string, MarkupOrcamentoCustos>>(
    () => new Map(),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const leadIdsKey = useMemo(() => {
    if (!enabled) return ''
    return collectObraLeadIds(obras).sort().join(',')
  }, [obras, enabled])

  useEffect(() => {
    if (!enabled || !leadIdsKey) {
      setCustosByLead(new Map())
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    const leadIds = leadIdsKey.split(',')

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: rpcError } = await supabase.rpc('movelaria_markup_custos_por_leads', {
          p_lead_ids: leadIds,
        })
        if (rpcError) throw rpcError
        if (cancelled) return
        setCustosByLead(mapMarkupCustosRows(data))
      } catch (e) {
        if (cancelled) return
        setCustosByLead(new Map())
        setError(e instanceof Error ? e.message : 'Erro ao carregar custos do markup.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [enabled, leadIdsKey])

  return { custosByLead, loading, error }
}
