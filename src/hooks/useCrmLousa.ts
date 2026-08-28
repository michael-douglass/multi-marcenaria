import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthReady } from '@/hooks/useAuthReady'
import { parseLousaBoard, parseLousaBoot, type CrmLousaBoard, type CrmLousaLeadResumo } from '@/lib/crm-lousa'

export function useCrmLousaLista() {
  const { isReady } = useAuthReady()
  const [leads, setLeads] = useState<CrmLousaLeadResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_lousa_boot')
      if (err) throw err
      setLeads(parseLousaBoot(raw))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a lousa.')
    } finally {
      setLoading(false)
    }
  }, [isReady])

  useEffect(() => { void load() }, [load])
  return { leads, loading, error, reload: load }
}

export function useCrmLousaBoard(leadId: number | null) {
  const { isReady } = useAuthReady()
  const [board, setBoard] = useState<CrmLousaBoard | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady || !leadId) return
    setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_lousa_obter', { p_lead_id: leadId })
      if (err) throw err
      setBoard(parseLousaBoard(raw))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir a lousa.')
    } finally {
      setLoading(false)
    }
  }, [isReady, leadId])

  useEffect(() => { void load() }, [load])
  return { board, loading, error, reload: load }
}
