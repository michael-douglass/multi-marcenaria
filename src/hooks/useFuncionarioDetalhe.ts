import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { listFuncionarioDocumentos, withFuncionarioDocPreviewUrls } from '@/lib/funcionario-documentos'
import { mapRecibosComContaPagar, RECIBO_SELECT_COM_CONTA_PAGAR } from '@/lib/funcionario-recibos'
import { fetchFixoMontadores } from '@/lib/fixo-montador'
import { isPastaPontoRegistrosRestrita } from '@/lib/role-access'
import type { ContaPagar, Funcionario, FuncionarioDocumento, FuncionarioInput, FuncionarioRecibo } from '@/types'
import { useApp } from '@/context/AppContext'
import { useAuthReady } from './useAuthReady'

const FUNCIONARIO_PONTO_PASTA_SELECT =
  'id, nome, tipo, usuario_id, ativo, cpf, email, telefone, admissao_status, dispensado_em'

export function useFuncionarioDetalhe(funcionarioId: string | undefined) {
  const { isReady } = useAuthReady()
  const { roles } = useApp()
  const pastaLeve = isPastaPontoRegistrosRestrita(roles)
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null)
  const [documentos, setDocumentos] = useState<FuncionarioDocumento[]>([])
  const [recibos, setRecibos] = useState<FuncionarioRecibo[]>([])
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([])
  /** Fixo mensal do usuário vinculado (montador/prestador), se houver. */
  const [valorFixoMensal, setValorFixoMensal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady || !funcionarioId) return
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const { data: funcRow, error: funcErr } = await supabase
        .from('movelaria_funcionarios')
        .select(pastaLeve ? FUNCIONARIO_PONTO_PASTA_SELECT : '*')
        .eq('id', funcionarioId)
        .single()
      if (funcErr) throw funcErr

      const func = {
        ...(funcRow as Funcionario),
        admissao_dados: ((funcRow as Funcionario).admissao_dados ?? {}) as Funcionario['admissao_dados'],
      }
      setFuncionario(func)

      if (pastaLeve) {
        setDocumentos([])
        setRecibos([])
        setContasPagar([])
        setValorFixoMensal(null)
        return
      }

      const docs = await listFuncionarioDocumentos(funcionarioId)
      const docsWithUrls = await Promise.all(docs.map(d => withFuncionarioDocPreviewUrls(d)))
      setDocumentos(docsWithUrls)

      const { data: recibosRows, error: recErr } = await supabase
        .from('movelaria_funcionario_recibos')
        .select(RECIBO_SELECT_COM_CONTA_PAGAR)
        .eq('funcionario_id', funcionarioId)
        .order('criado_em', { ascending: false })
      if (recErr) throw recErr
      setRecibos(mapRecibosComContaPagar(recibosRows))

      if (func.usuario_id) {
        const now = new Date()
        const [{ data: cpRows, error: cpErr }, fixos] = await Promise.all([
          supabase
            .from('movelaria_contas_pagar')
            .select('*')
            .eq('prestador_id', func.usuario_id)
            .order('data_vencimento', { ascending: false })
            .limit(50),
          // RLS em movelaria_usuarios só permite ler o próprio usuário;
          // o fixo mensal vem pela RPC de métricas (mesmo valor das contas a pagar).
          fetchFixoMontadores(now.getMonth() + 1, now.getFullYear()).catch(() => []),
        ])
        if (cpErr) throw cpErr
        setContasPagar((cpRows ?? []) as ContaPagar[])

        const fixoRow = fixos.find(f => f.montador_id === func.usuario_id)
        const fixo = Number(fixoRow?.valor_fixo_mensal) || 0
        setValorFixoMensal(fixo > 0 ? fixo : null)
      } else {
        setContasPagar([])
        setValorFixoMensal(null)
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar funcionário.')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [isReady, funcionarioId, pastaLeve])

  useEffect(() => { void load() }, [load])

  /** Atualiza o funcionário na tela sem recarregar a página. */
  const applyLocalPatch = useCallback((input: Partial<FuncionarioInput>) => {
    setFuncionario(prev => {
      if (!prev) return prev
      return {
        ...prev,
        ...(input.nome !== undefined ? { nome: input.nome } : {}),
        ...(input.tipo !== undefined ? { tipo: input.tipo } : {}),
        ...(input.cpf !== undefined ? { cpf: input.cpf } : {}),
        ...(input.telefone !== undefined ? { telefone: input.telefone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.usuario_id !== undefined ? { usuario_id: input.usuario_id } : {}),
        ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
        ...(input.admissao_status !== undefined ? { admissao_status: input.admissao_status } : {}),
        ...(input.admissao_dados !== undefined
          ? { admissao_dados: input.admissao_dados as Funcionario['admissao_dados'] }
          : {}),
      }
    })
  }, [])

  return {
    funcionario,
    documentos,
    recibos,
    contasPagar,
    valorFixoMensal,
    loading,
    error,
    reload: load,
    applyLocalPatch,
    setFuncionario,
    setDocumentos,
    setRecibos,
  }
}
