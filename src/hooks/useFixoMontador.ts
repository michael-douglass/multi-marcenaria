import { useCallback, useEffect, useState } from 'react'
import {
  atualizarFixoMontador,
  fetchFixoMontadores,
  fetchMontadoresAtivos,
  mergeMontadoresComFixo,
  resetExpandirFixoMontadoresSessao,
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
      // Fonte principal: RPC de fixo (já traz todos os montadores + valores).
      try {
        const fixos = await fetchFixoMontadores(mes, ano)
        setData(fixos)
        return
      } catch (fixoErr) {
        // Fallback: lista montadores e mescla (valores podem vir zerados).
        const montadores = await fetchMontadoresAtivos()
        setData(mergeMontadoresComFixo(montadores, []))
        setError(
          fixoErr instanceof Error
            ? `Não foi possível carregar os fixos: ${fixoErr.message}`
            : 'Não foi possível carregar os fixos dos montadores.',
        )
      }
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
      // Libera Contas a Pagar para reexpandir/recarregar as novas cobranças.
      resetExpandirFixoMontadoresSessao()
      await load()
      setSuccessMsg(
        valor > 0
          ? (
              primeiroVencimento
                ? `Fixo salvo. Cobranças geradas em Contas a Pagar a partir de ${primeiroVencimento.slice(8, 10)}/${primeiroVencimento.slice(5, 7)}/${primeiroVencimento.slice(0, 4)} (até 12 meses à frente).`
                : 'Fixo salvo. Cobranças mensais geradas/atualizadas em Contas a Pagar (12 meses à frente).'
            )
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
