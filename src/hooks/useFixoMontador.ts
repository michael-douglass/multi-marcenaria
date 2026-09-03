import { useCallback, useEffect, useState } from 'react'
import {
  atualizarFixoFuncionario,
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
      try {
        const fixos = await fetchFixoMontadores(mes, ano)
        setData(fixos)
        return
      } catch (fixoErr) {
        const montadores = await fetchMontadoresAtivos()
        setData(mergeMontadoresComFixo(montadores, []))
        setError(
          fixoErr instanceof Error
            ? `Não foi possível carregar os fixos: ${fixoErr.message}`
            : 'Não foi possível carregar os fixos da equipe.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar funcionários.')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [isReady, mes, ano])

  useEffect(() => { void load() }, [load])

  const salvarFixo = useCallback(async (
    funcionarioId: string,
    valor: number,
    primeiroVencimento?: string | null,
  ) => {
    if (!funcionarioId) {
      const msg = 'Funcionário inválido para salvar o fixo.'
      setError(msg)
      throw new Error(msg)
    }
    if (valor > 0 && !primeiroVencimento) {
      const msg = 'Informe a data de pagamento para ativar o fixo.'
      setError(msg)
      throw new Error(msg)
    }
    setSavingId(funcionarioId)
    setError(null)
    setSuccessMsg(null)
    try {
      await atualizarFixoFuncionario(funcionarioId, valor, primeiroVencimento)
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
