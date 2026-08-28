import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthReady } from '@/hooks/useAuthReady'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { parseAgendaBoot, parseReuniao, type CrmAgendaBoot, type CrmReuniao } from '@/lib/crm-agenda'

const EMPTY: CrmAgendaBoot = {
  config: { nome_agenda: 'Agenda comercial', slug: '', duracao_minutos: 30, ativo: true },
  reunioes: [],
  leads: [],
}

export function useCrmAgenda(enabled = true) {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<CrmAgendaBoot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady || !enabled) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_agenda_boot')
      if (err) throw err
      setData(parseAgendaBoot(raw))
    } catch (err) {
      if (!opts?.silent) setError(err instanceof Error ? err.message : 'Erro ao carregar a agenda comercial.')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady, enabled])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void load()
  }, [load, enabled])
  useAutoRefresh(() => { if (enabled) void load({ silent: true }) })

  const salvar = async (input: {
    id: string
    titulo: string
    inicio: string
    fim: string
    convidado: string
    whatsapp: string
    status: string
    leadId: number | null
    observacoes: string
  }) => {
    const { data: raw, error: err } = await supabase.rpc('movelaria_crm_agenda_salvar', {
      p_id: input.id,
      p_titulo: input.titulo,
      p_inicio: input.inicio,
      p_fim: input.fim,
      p_convidado: input.convidado,
      p_whatsapp: input.whatsapp,
      p_status: input.status,
      p_lead_id: input.leadId,
      p_observacoes: input.observacoes,
    })
    if (err) throw new Error(err.message)
    const saved = parseReuniao(raw)
    setData(prev => ({
      ...prev,
      reunioes: prev.reunioes.map(r => r.id === saved.id ? { ...r, ...saved } : r),
    }))
    return saved
  }

  const criar = async (input: {
    titulo: string
    inicio: string
    fim: string
    convidado: string
    whatsapp: string
    leadId: number | null
  }): Promise<CrmReuniao> => {
    const { data: raw, error: err } = await supabase.rpc('movelaria_crm_agenda_criar', {
      p_titulo: input.titulo,
      p_inicio: input.inicio,
      p_fim: input.fim,
      p_convidado: input.convidado,
      p_whatsapp: input.whatsapp,
      p_lead_id: input.leadId,
    })
    if (err) throw new Error(err.message)
    const created = parseReuniao(raw)
    await load({ silent: true })
    return created
  }

  return { data, loading, error, reload: load, salvar, criar }
}
