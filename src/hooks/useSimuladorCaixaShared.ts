import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthReady } from '@/hooks/useAuthReady'
import {
  normalizeSimulacaoPayload,
  parseSimulacao,
  type SimulacaoCaixa,
  type SimuladorAjuste,
  type SimuladorMes,
} from '@/lib/simulador-caixa-storage'

interface SimuladorCaixaRow {
  ano: number
  meses: unknown
  previsao_recebimento: number | string
  previsao_despesas: number | string
  ajustes: unknown
  atualizado_em: string
}

function rowToSimulacao(row: SimuladorCaixaRow): SimulacaoCaixa | null {
  return parseSimulacao(
    {
      ano: row.ano,
      meses: row.meses,
      previsaoRecebimento: row.previsao_recebimento,
      previsaoDespesas: row.previsao_despesas,
      ajustes: row.ajustes,
      atualizado_em: row.atualizado_em,
    },
    row.ano,
  )
}

/**
 * Carrega e grava a simulação de caixa no banco (compartilhada).
 * Quem abre o Dashboard vê a mesma simulação; mudanças sincronizam ao vivo.
 */
export function useSimuladorCaixaShared(ano: number) {
  const { isReady, userProfile } = useAuthReady()
  const [simulacao, setSimulacao] = useState<SimulacaoCaixa | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Evita sobrescrever edição local com eco do próprio save via Realtime. */
  const skipRealtimeUntil = useRef(0)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: qError } = await supabase
        .from('movelaria_simulador_caixa')
        .select('ano, meses, previsao_recebimento, previsao_despesas, ajustes, atualizado_em')
        .eq('ano', ano)
        .maybeSingle()

      if (qError) throw qError
      setSimulacao(data ? rowToSimulacao(data as SimuladorCaixaRow) : null)
    } catch (e) {
      setSimulacao(null)
      setError(e instanceof Error ? e.message : 'Erro ao carregar simulação de caixa.')
    } finally {
      setLoading(false)
    }
  }, [ano, isReady])

  useEffect(() => {
    void load()
  }, [load])

  // Outro usuário salvou → atualiza na tela
  useEffect(() => {
    if (!isReady) return

    const channel = supabase
      .channel(`movelaria-simulador-caixa-${ano}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'movelaria_simulador_caixa',
          filter: `ano=eq.${ano}`,
        },
        payload => {
          if (Date.now() < skipRealtimeUntil.current) return

          if (payload.eventType === 'DELETE') {
            setSimulacao(null)
            return
          }

          const row = payload.new as SimuladorCaixaRow
          if (!row?.ano) return
          setSimulacao(rowToSimulacao(row))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [ano, isReady])

  const save = useCallback(
    async (payload: {
      meses: SimuladorMes[]
      previsaoRecebimento: number
      previsaoDespesas: number
      ajustes: SimuladorAjuste[]
    }) => {
      const normalized = normalizeSimulacaoPayload({
        ano,
        meses: payload.meses,
        previsaoRecebimento: payload.previsaoRecebimento,
        previsaoDespesas: payload.previsaoDespesas,
        ajustes: payload.ajustes,
      })

      setSaving(true)
      setError(null)
      skipRealtimeUntil.current = Date.now() + 2500

      try {
        const { data, error: upsertError } = await supabase
          .from('movelaria_simulador_caixa')
          .upsert(
            {
              ano,
              meses: normalized.meses,
              previsao_recebimento: normalized.previsaoRecebimento,
              previsao_despesas: normalized.previsaoDespesas,
              ajustes: normalized.ajustes,
              atualizado_por: userProfile?.id ?? null,
              atualizado_em: normalized.salvoEm,
            },
            { onConflict: 'ano' },
          )
          .select('ano, meses, previsao_recebimento, previsao_despesas, ajustes, atualizado_em')
          .single()

        if (upsertError) throw upsertError

        const saved = data ? rowToSimulacao(data as SimuladorCaixaRow) : normalized
        setSimulacao(saved)
        return saved
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Erro ao salvar simulação de caixa.'
        setError(message)
        throw new Error(message)
      } finally {
        setSaving(false)
      }
    },
    [ano, userProfile?.id],
  )

  const clear = useCallback(async () => {
    setSaving(true)
    setError(null)
    skipRealtimeUntil.current = Date.now() + 2500

    try {
      const { error: delError } = await supabase
        .from('movelaria_simulador_caixa')
        .delete()
        .eq('ano', ano)

      if (delError) throw delError
      setSimulacao(null)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Erro ao limpar simulação de caixa.'
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }, [ano])

  return {
    simulacao,
    loading,
    saving,
    error,
    reload: load,
    save,
    clear,
  }
}
