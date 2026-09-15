import { useCallback, useEffect, useState } from 'react'
import {
  ajustarMarcacao,
  fetchJornada,
  fetchMarcacoes,
  fetchOcorrencias,
  fetchRepArquivos,
  fetchRepConfig,
  registrarPontoManual,
  removerOcorrencia,
  salvarJornada,
  salvarOcorrencia,
} from '@/lib/funcionario-ponto'
import type {
  FuncionarioDocumento,
  FuncionarioJornada,
  PontoMarcacao,
  PontoMarcacaoTipo,
  PontoOcorrencia,
  RepArquivo,
  RepConfig,
} from '@/types'
import { useAuthReady } from './useAuthReady'

export function useFuncionarioPonto(funcionarioId: string | undefined) {
  const { isReady } = useAuthReady()
  const [jornada, setJornada] = useState<FuncionarioJornada | null>(null)
  const [marcacoes, setMarcacoes] = useState<PontoMarcacao[]>([])
  const [ocorrencias, setOcorrencias] = useState<PontoOcorrencia[]>([])
  const [repConfig, setRepConfig] = useState<RepConfig | null>(null)
  const [repArquivos, setRepArquivos] = useState<RepArquivo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isReady || !funcionarioId) return
    setLoading(true)
    setError(null)
    try {
      const [j, m, o, rc, ra] = await Promise.all([
        fetchJornada(funcionarioId),
        fetchMarcacoes(funcionarioId),
        fetchOcorrencias(funcionarioId),
        fetchRepConfig().catch(() => null),
        fetchRepArquivos(funcionarioId).catch(() => []),
      ])
      setJornada(j)
      setMarcacoes(m)
      setOcorrencias(o)
      setRepConfig(rc)
      setRepArquivos(ra)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados de ponto.')
    } finally {
      setLoading(false)
    }
  }, [isReady, funcionarioId])

  useEffect(() => { void load() }, [load])

  const saveJornada = useCallback(async (
    input: Omit<FuncionarioJornada, 'id' | 'funcionario_id' | 'criado_em' | 'atualizado_em'> & {
      horarios_dias_ativos?: string[] | null
    },
  ) => {
    if (!funcionarioId) return
    const saved = await salvarJornada(funcionarioId, input)
    setJornada(saved)
  }, [funcionarioId])

  const addOcorrencia = async (data: string, tipo: PontoOcorrencia['tipo'], observacao?: string) => {
    if (!funcionarioId) return
    const row = await salvarOcorrencia(funcionarioId, data, tipo, observacao)
    setOcorrencias(prev => [row, ...prev.filter(o => !(o.data === data && o.tipo === tipo))])
  }

  const deleteOcorrencia = async (id: string) => {
    await removerOcorrencia(id)
    setOcorrencias(prev => prev.filter(o => o.id !== id))
  }

  const adjustMarcacao = async (marcacaoId: string, hora: string, motivo: string) => {
    const row = await ajustarMarcacao(marcacaoId, hora, motivo)
    setMarcacoes(prev => prev.map(m => (m.id === marcacaoId ? { ...m, ...row } : m)))
    return row
  }

  const addMarcacaoManual = async (
    data: string,
    tipo: PontoMarcacaoTipo,
    hora: string,
    motivo: string,
  ) => {
    if (!funcionarioId) return
    const row = await registrarPontoManual({
      funcionarioId,
      data,
      tipo,
      hora,
      motivo,
    })
    setMarcacoes(prev => [row, ...prev.filter(m => m.id !== row.id)])
    // Falta automática do dia some no banco; sincroniza a lista local
    setOcorrencias(prev => prev.filter(o => !(o.data === data && o.tipo === 'falta' && o.automatica)))
    return row
  }

  return {
    jornada,
    marcacoes,
    ocorrencias,
    repConfig,
    repArquivos,
    loading,
    error,
    reload: load,
    saveJornada,
    addOcorrencia,
    deleteOcorrencia,
    adjustMarcacao,
    addMarcacaoManual,
  }
}

export function filterPontoDocumentos(documentos: FuncionarioDocumento[]): FuncionarioDocumento[] {
  return documentos.filter(d => d.categoria === 'ponto')
}
