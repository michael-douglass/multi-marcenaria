import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { MetricaObra, MetricaObraDetalhe, MetricaObraMontador, MetricasObrasResumo } from '../types'
import { useAuthReady } from './useAuthReady'

const RESUMO_VAZIO: MetricasObrasResumo = {
  comissao_a_pagar_mes: 0,
  comissao_em_aberto: 0,
  comissoes_geradas_mes: 0,
  obras_concluidas_mes: 0,
  obras_abertas_comissao: 0,
  mes_referencia: new Date().getMonth() + 1,
  ano_referencia: new Date().getFullYear(),
}

export interface MetricasPeriodo {
  mes: number
  ano: number
}

export function useMetricasObras(periodo: MetricasPeriodo) {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<MetricaObra[]>([])
  const [resumo, setResumo] = useState<MetricasObrasResumo>(RESUMO_VAZIO)
  const [porObra, setPorObra] = useState<MetricaObraDetalhe[]>([])
  const [porMontador, setPorMontador] = useState<MetricaObraMontador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)

    const { mes, ano } = periodo

    try {
      const [tiposRes, resumoRes, obrasRes, montadoresRes] = await Promise.all([
        supabase.rpc('movelaria_metricas_obras', { p_mes: mes, p_ano: ano }),
        supabase.rpc('movelaria_metricas_obras_resumo', { p_mes: mes, p_ano: ano }),
        supabase.rpc('movelaria_metricas_obras_por_obra', { p_mes: mes, p_ano: ano }),
        supabase.rpc('movelaria_metricas_obras_por_montador', { p_mes: mes, p_ano: ano }),
      ])

      if (tiposRes.error) throw tiposRes.error
      if (resumoRes.error) throw resumoRes.error
      if (obrasRes.error) throw obrasRes.error
      if (montadoresRes.error) throw montadoresRes.error

      setData((tiposRes.data ?? []) as MetricaObra[])

      const row = (resumoRes.data as MetricasObrasResumo[] | null)?.[0]
      setResumo(row ? {
        comissao_a_pagar_mes: Number(row.comissao_a_pagar_mes ?? 0),
        comissao_em_aberto: Number(row.comissao_em_aberto ?? 0),
        comissoes_geradas_mes: Number(row.comissoes_geradas_mes ?? 0),
        obras_concluidas_mes: Number(row.obras_concluidas_mes ?? 0),
        obras_abertas_comissao: Number(row.obras_abertas_comissao ?? 0),
        mes_referencia: Number(row.mes_referencia ?? mes),
        ano_referencia: Number(row.ano_referencia ?? ano),
      } : { ...RESUMO_VAZIO, mes_referencia: mes, ano_referencia: ano })

      setPorObra((obrasRes.data ?? []) as MetricaObraDetalhe[])

      setPorMontador(((montadoresRes.data ?? []) as MetricaObraMontador[]).map(row => ({
        montador_id: row.montador_id,
        montador_nome: row.montador_nome,
        comissao_concluida: Number(row.comissao_concluida ?? 0),
        comissao_em_aberto: Number(row.comissao_em_aberto ?? 0),
        comissao_gerada: Number(row.comissao_gerada ?? 0),
        obras_concluidas: Number(row.obras_concluidas ?? 0),
        obras_em_aberto: Number(row.obras_em_aberto ?? 0),
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar métricas.')
    } finally {
      setLoading(false)
    }
  }, [isReady, periodo.mes, periodo.ano])

  useEffect(() => { void load() }, [load])

  return { data, resumo, porObra, porMontador, loading, error, reload: load }
}
