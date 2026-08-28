import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthReady } from '@/hooks/useAuthReady'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import {
  EMPTY_PORTAL_BOOT,
  parsePortalBoot,
  parsePortalLeadDetalhe,
  type PortalBoot,
  type PortalLeadDetalhe,
  type TipoChavePix,
} from '@/lib/crm-portal'

export function useCrmPortal(enabled = true) {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<PortalBoot>(EMPTY_PORTAL_BOOT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady || !enabled) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_portal_boot')
      if (err) throw err
      setData(parsePortalBoot(raw))
    } catch (err) {
      if (!opts?.silent) {
        setError(err instanceof Error ? err.message : 'Erro ao abrir o portal do parceiro.')
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady, enabled])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(() => { void load({ silent: true }) })

  const salvarPerfil = async (input: { telefone: string; chavePix: string; tipoChavePix: TipoChavePix }) => {
    const { error: err } = await supabase.rpc('movelaria_crm_portal_salvar_perfil', {
      p_telefone: input.telefone,
      p_chave_pix: input.chavePix,
      p_tipo_chave_pix: input.tipoChavePix,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const solicitarSaque = async (input: { valor: number; chavePix: string; tipoChavePix: TipoChavePix }) => {
    const { error: err } = await supabase.rpc('movelaria_crm_portal_solicitar_saque', {
      p_valor: input.valor,
      p_chave_pix: input.chavePix,
      p_tipo_chave_pix: input.tipoChavePix,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const obterLead = async (leadId: number): Promise<PortalLeadDetalhe> => {
    const { data: raw, error: err } = await supabase.rpc('movelaria_crm_portal_lead', {
      p_lead_id: leadId,
    })
    if (err) throw new Error(err.message)
    return parsePortalLeadDetalhe(raw)
  }

  return { data, loading, error, reload: load, salvarPerfil, solicitarSaque, obterLead }
}
