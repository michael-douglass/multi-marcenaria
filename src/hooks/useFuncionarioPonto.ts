import { useCallback, useEffect, useState } from 'react'
import {
  fetchJornada,
  fetchMarcacoes,
  fetchOcorrencias,
  fetchRepArquivos,
  fetchRepConfig,
  removerOcorrencia,
  salvarJornada,
  salvarOcorrencia,
} from '@/lib/funcionario-ponto'
import type {
  FuncionarioDocumento,
  FuncionarioJornada,
  PontoMarcacao,
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

  const saveJornada = async (input: Omit<FuncionarioJornada, 'id' | 'funcionario_id' | 'criado_em' | 'atualizado_em'>) => {
    if (!funcionarioId) return
    const saved = await salvarJornada(funcionarioId, input)
    setJornada(saved)
  }

  const addOcorrencia = async (data: string, tipo: PontoOcorrencia['tipo'], observacao?: string) => {
    if (!funcionarioId) return
    const row = await salvarOcorrencia(funcionarioId, data, tipo, observacao)
    setOcorrencias(prev => [row, ...prev.filter(o => !(o.data === data && o.tipo === tipo))])
  }

  const deleteOcorrencia = async (id: string) => {
    await removerOcorrencia(id)
    setOcorrencias(prev => prev.filter(o => o.id !== id))
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
  }
}

export function filterPontoDocumentos(documentos: FuncionarioDocumento[]): FuncionarioDocumento[] {
  return documentos.filter(d => d.categoria === 'ponto')
}
