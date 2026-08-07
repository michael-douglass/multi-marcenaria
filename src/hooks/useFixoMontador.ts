import { useCallback, useEffect, useState } from 'react'
import {
  atualizarFixoMontador,
  fetchFixoMontadores,
  fetchMontadoresAtivos,
  mergeMontadoresComFixo,
} from '@/lib/fixo-montador'
import type { MontadorFixoMensal } from '@/types'
import { useAuthReady } from './useAuthReady'

export function useFixoMontador(mes: number, ano: number) {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<MontadorFixoMensal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const montadores = await fetchMontadoresAtivos()
      let fixos: MontadorFixoMensal[] = []
      try {
        fixos = await fetchFixoMontadores(mes, ano)
      } catch {
        fixos = []
      }
      setData(mergeMontadoresComFixo(montadores, fixos))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar montadores.')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [isReady, mes, ano])

  useEffect(() => { void load() }, [load])

  const salvarFixo = useCallback(async (
    montadorId: string,
    valor: number,
    primeiroVencimento?: string | null,
  ) => {
    if (valor > 0 && !primeiroVencimento) {
      const msg = 'Informe a data de pagamento para ativar o fixo.'
      setError(msg)
      throw new Error(msg)
    }
    setSavingId(montadorId)
    setError(null)
    setSuccessMsg(null)
    try {
      await atualizarFixoMontador(montadorId, valor, primeiroVencimento)
      await load()
      setSuccessMsg(
        valor > 0
          ? 'Fixo salvo. Cobranças mensais geradas/atualizadas em Contas a Pagar (12 meses à frente).'
          : 'Fixo removido. Cobranças pendentes foram encerradas.',
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar valor fixo.'
      setError(msg)
      throw err
    } finally {
      setSavingId(null)
    }
  }, [load])

  return { data, loading, error, successMsg, savingId, reload: load, salvarFixo }
}
