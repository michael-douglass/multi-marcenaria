import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isOverdue, todayISO } from '@/lib/utils'
import type { ContaPagarStatus } from '@/types'
import { useAuthReady } from './useAuthReady'
import { useAutoRefresh } from './useAutoRefresh'
import { showToast } from '@/lib/toast'

export interface ContaPagarNotifTarefa {
  id: string
  fornecedor_nome?: string | null
  descricao?: string | null
  valor_parcela: number
  data_vencimento: string
  status: ContaPagarStatus
  /** Rótulo de UI: pago | vencido | parcialmente_pago | pendente */
  statusUi: string
}

function statusUi(vencimento: string, status: ContaPagarStatus): string {
  if (status === 'pago') return 'pago'
  if (isOverdue(vencimento)) return 'vencido'
  if (status === 'parcialmente_pago') return 'parcialmente_pago'
  return 'pendente'
}

type ContaRow = {
  id: string
  fornecedor_nome?: string | null
  descricao?: string | null
  valor_parcela: number
  data_vencimento: string
  status: ContaPagarStatus
}

/**
 * Notificações:
 * - todas as contas que vencem HOJE (qualquer status)
 * - vencidas do mês atual ainda não pagas
 * Excluir some só no dia (dia_referencia).
 */
export function useContasPagarNotificacoes(enabled: boolean) {
  const { isReady, userProfile } = useAuthReady()
  const [tarefas, setTarefas] = useState<ContaPagarNotifTarefa[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled || !isReady || !userProfile?.id) {
      setTarefas([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const hoje = todayISO()
      const mesInicio = `${hoje.slice(0, 7)}-01`

      // Duas consultas: evita falha do filtro .or() aninhado no PostgREST
      const [hojeRes, vencidasRes, dismissRes] = await Promise.all([
        supabase
          .from('movelaria_contas_pagar')
          .select('id, fornecedor_nome, descricao, valor_parcela, data_vencimento, status')
          .eq('data_vencimento', hoje)
          .order('fornecedor_nome', { ascending: true }),
        supabase
          .from('movelaria_contas_pagar')
          .select('id, fornecedor_nome, descricao, valor_parcela, data_vencimento, status')
          .gte('data_vencimento', mesInicio)
          .lt('data_vencimento', hoje)
          .in('status', ['pendente', 'parcialmente_pago'])
          .order('data_vencimento', { ascending: true }),
        supabase
          .from('movelaria_contas_pagar_notif_dismiss')
          .select('conta_pagar_id')
          .eq('usuario_id', userProfile.id)
          .eq('dia_referencia', hoje),
      ])

      if (hojeRes.error) throw new Error(hojeRes.error.message)
      if (vencidasRes.error) throw new Error(vencidasRes.error.message)
      if (dismissRes.error) throw new Error(dismissRes.error.message)

      const dismissed = new Set(
        (dismissRes.data ?? []).map(r => String(r.conta_pagar_id)),
      )

      const byId = new Map<string, ContaRow>()
      for (const row of [...(hojeRes.data ?? []), ...(vencidasRes.data ?? [])]) {
        byId.set(String(row.id), row as ContaRow)
      }

      const next: ContaPagarNotifTarefa[] = [...byId.values()]
        .filter(c => !dismissed.has(String(c.id)))
        .sort((a, b) => {
          const da = String(a.data_vencimento).slice(0, 10)
          const db = String(b.data_vencimento).slice(0, 10)
          if (da !== db) return da.localeCompare(db)
          return String(a.fornecedor_nome ?? '').localeCompare(String(b.fornecedor_nome ?? ''), 'pt-BR')
        })
        .map(c => {
          const status = c.status as ContaPagarStatus
          const venc = String(c.data_vencimento).slice(0, 10)
          return {
            id: String(c.id),
            fornecedor_nome: c.fornecedor_nome,
            descricao: c.descricao,
            valor_parcela: Number(c.valor_parcela) || 0,
            data_vencimento: venc,
            status,
            statusUi: statusUi(venc, status),
          }
        })

      setTarefas(next)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar notificações.'
      setError(msg)
      console.error('[useContasPagarNotificacoes]', err)
    } finally {
      setLoading(false)
    }
  }, [enabled, isReady, userProfile?.id])

  useEffect(() => {
    void load()
  }, [load])

  const silentReload = useCallback(() => {
    void load()
  }, [load])

  useAutoRefresh(enabled ? silentReload : () => undefined)

  const dismiss = useCallback(
    async (contaId: string) => {
      if (!userProfile?.id) return
      const hoje = todayISO()
      const prev = tarefas
      setTarefas(curr => curr.filter(t => t.id !== contaId))

      const { error: err } = await supabase
        .from('movelaria_contas_pagar_notif_dismiss')
        .upsert(
          {
            usuario_id: userProfile.id,
            conta_pagar_id: contaId,
            dia_referencia: hoje,
            dismissed_at: new Date().toISOString(),
          },
          { onConflict: 'usuario_id,conta_pagar_id,dia_referencia' },
        )

      if (err) {
        setTarefas(prev)
        showToast(err.message || 'Não foi possível excluir a notificação.', 'error')
        return
      }
      showToast('Notificação excluída neste dia.', 'success')
    },
    [tarefas, userProfile?.id],
  )

  const count = useMemo(() => tarefas.length, [tarefas])

  return {
    tarefas,
    count,
    loading,
    error,
    dismiss,
    reload: load,
    diaReferencia: todayISO(),
  }
}
