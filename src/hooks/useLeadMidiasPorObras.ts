import { useEffect, useMemo, useState } from 'react'
import {
  collectObraLeadIds,
  groupLeadMidiasByLead,
  mapLeadMidiaRows,
} from '@/lib/obra-lead-midias'
import { supabase } from '@/lib/supabase'
import type { LeadMidia, ObraFull } from '@/types'

/**
 * Carrega mídias do lead (CRM) para as obras da agenda.
 * Fotos para todos; PDFs só se o RPC liberar (montador admin / gestores).
 */
export function useLeadMidiasPorObras(
  obras: Pick<ObraFull, 'origem_lead_id'>[],
  enabled = true,
) {
  const [midiasByLead, setMidiasByLead] = useState<Map<string, LeadMidia[]>>(
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
      setMidiasByLead(new Map())
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
        const { data, error: rpcError } = await supabase.rpc('movelaria_lead_midias_por_leads', {
          p_lead_ids: leadIds,
        })
        if (rpcError) throw rpcError
        if (cancelled) return
        setMidiasByLead(groupLeadMidiasByLead(mapLeadMidiaRows(data)))
      } catch (e) {
        if (cancelled) return
        setMidiasByLead(new Map())
        setError(e instanceof Error ? e.message : 'Erro ao carregar fotos do lead.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [enabled, leadIdsKey])

  return { midiasByLead, loading, error }
}
