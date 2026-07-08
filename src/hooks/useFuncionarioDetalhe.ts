import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { listFuncionarioDocumentos, getFuncionarioDocSignedUrl } from '@/lib/funcionario-documentos'
import { mapRecibosComContaPagar, RECIBO_SELECT_COM_CONTA_PAGAR } from '@/lib/funcionario-recibos'
import type { ContaPagar, Funcionario, FuncionarioDocumento, FuncionarioRecibo } from '@/types'
import { useAuthReady } from './useAuthReady'

export function useFuncionarioDetalhe(funcionarioId: string | undefined) {
  const { isReady } = useAuthReady()
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null)
  const [documentos, setDocumentos] = useState<FuncionarioDocumento[]>([])
  const [recibos, setRecibos] = useState<FuncionarioRecibo[]>([])
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady || !funcionarioId) return
    setLoading(true)
    setError(null)
    try {
      const { data: funcRow, error: funcErr } = await supabase
        .from('movelaria_funcionarios')
        .select('*')
        .eq('id', funcionarioId)
        .single()
      if (funcErr) throw funcErr

      const func = {
        ...(funcRow as Funcionario),
        admissao_dados: ((funcRow as Funcionario).admissao_dados ?? {}) as Funcionario['admissao_dados'],
      }
      setFuncionario(func)

      const docs = await listFuncionarioDocumentos(funcionarioId)
      const docsWithUrls = await Promise.all(
        docs.map(async d => {
          try {
            const previewPath = d.preview_path ?? d.storage_path
            const previewSignedUrl = await getFuncionarioDocSignedUrl(previewPath)
            return { ...d, previewSignedUrl }
          } catch {
            return d
          }
        }),
      )
      setDocumentos(docsWithUrls)

      const { data: recibosRows, error: recErr } = await supabase
        .from('movelaria_funcionario_recibos')
        .select(RECIBO_SELECT_COM_CONTA_PAGAR)
        .eq('funcionario_id', funcionarioId)
        .order('criado_em', { ascending: false })
      if (recErr) throw recErr
      setRecibos(mapRecibosComContaPagar(recibosRows))

      if (func.usuario_id) {
        const { data: cpRows, error: cpErr } = await supabase
          .from('movelaria_contas_pagar')
          .select('*')
          .eq('prestador_id', func.usuario_id)
          .order('data_vencimento', { ascending: false })
          .limit(50)
        if (cpErr) throw cpErr
        setContasPagar((cpRows ?? []) as ContaPagar[])
      } else {
        setContasPagar([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar funcionário.')
    } finally {
      setLoading(false)
    }
  }, [isReady, funcionarioId])

  useEffect(() => { void load() }, [load])

  return {
    funcionario,
    documentos,
    recibos,
    contasPagar,
    loading,
    error,
    reload: load,
    setFuncionario,
    setDocumentos,
    setRecibos,
  }
}
