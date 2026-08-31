import { useCallback, useEffect, useMemo, useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import { DateInput } from '@/components/ui/DateInput'
import { PontoHistoricoDia } from '@/components/ponto/PontoHistoricoDia'
import { ErrorState, LoadingState } from '@/components/ui/EmptyState'
import { useMeuFuncionario } from '@/hooks/useMeuFuncionario'
import {
  fetchJornada,
  fetchMarcacoes,
  periodoMesCorrente,
  PONTO_TIMEZONE,
} from '@/lib/funcionario-ponto'
import { podeBaterPontoPorTipo } from '@/lib/funcionario-constants'
import type { FuncionarioJornada, PontoMarcacao } from '@/types'

export function HistoricoPonto() {
  const { data: funcionario, loading: loadingFunc, error: errorFunc, reload } = useMeuFuncionario()
  const mes = periodoMesCorrente()
  const [periodoInicio, setPeriodoInicio] = useState(mes.de)
  const [periodoFim, setPeriodoFim] = useState(mes.ate)
  const [marcacoes, setMarcacoes] = useState<PontoMarcacao[]>([])
  const [jornada, setJornada] = useState<FuncionarioJornada | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!funcionario?.id) return
    setLoading(true)
    setError(null)
    try {
      const [m, j] = await Promise.all([
        fetchMarcacoes(funcionario.id, periodoInicio, periodoFim),
        fetchJornada(funcionario.id),
      ])
      setMarcacoes(m)
      setJornada(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar histórico.')
      setMarcacoes([])
    } finally {
      setLoading(false)
    }
  }, [funcionario?.id, periodoInicio, periodoFim])

  useEffect(() => {
    void load()
  }, [load])

  const marcacoesPorDia = useMemo(() => {
    const map = new Map<string, PontoMarcacao[]>()
    for (const m of marcacoes) {
      const dia = new Date(m.registrado_em).toLocaleDateString('pt-BR', { timeZone: PONTO_TIMEZONE })
      if (!map.has(dia)) map.set(dia, [])
      map.get(dia)!.push(m)
    }
    return [...map.entries()]
  }, [marcacoes])

  const habilitado = Boolean(funcionario && podeBaterPontoPorTipo(funcionario.tipo))

  return (
    <div className="fade-in obra-page-shell mx-auto flex max-w-2xl flex-col gap-6 p-1 pb-10">
      <div>
        <h1 className="font-display flex items-center gap-2 text-[2rem] tracking-wide text-[#f2d892]">
          <History size={28} />
          Histórico de ponto
        </h1>
        <p className="section-label mt-1">
          Veja suas batidas por período — entrada, almoço e saída
        </p>
      </div>

      {loadingFunc && <LoadingState message="Carregando seu cadastro…" />}

      {!loadingFunc && errorFunc && (
        <ErrorState message={errorFunc} onRetry={() => void reload()} />
      )}

      {!loadingFunc && !errorFunc && !funcionario && (
        <ErrorState
          message="Só funcionários cadastrados pela empresa podem ver o ponto. Peça ao RH para vincular sua pasta."
          onRetry={() => void reload()}
        />
      )}

      {!loadingFunc && funcionario && !habilitado && (
        <div className="glass-card p-6 text-center text-[#edd9c4]">
          Seu perfil não utiliza bater ponto.
        </div>
      )}

      {!loadingFunc && habilitado && (
        <>
          <div className="glass-card grid gap-3 p-4 sm:grid-cols-3 sm:items-end">
            <label className="block text-xs text-[#b8957f]">
              De
              <DateInput
                className="glass-input mt-1"
                value={periodoInicio}
                onChange={v => { if (v) setPeriodoInicio(v) }}
              />
            </label>
            <label className="block text-xs text-[#b8957f]">
              Até
              <DateInput
                className="glass-input mt-1"
                value={periodoFim}
                onChange={v => { if (v) setPeriodoFim(v) }}
              />
            </label>
            <button
              type="button"
              className="btn btn-gold"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Atualizar
            </button>
          </div>

          {loading && <LoadingState message="Carregando batidas…" />}

          {!loading && error && (
            <ErrorState message={error} onRetry={() => void load()} />
          )}

          {!loading && !error && marcacoesPorDia.length === 0 && (
            <p className="text-center text-sm text-[#b8957f]">
              Nenhuma batida neste período.
            </p>
          )}

          {!loading && !error && marcacoesPorDia.map(([dia, items]) => (
            <div key={dia} className="glass-card p-4">
              <h2 className="mb-3 font-display text-lg text-[#f2d892]">{dia}</h2>
              <PontoHistoricoDia
                marcacoes={items}
                jornada={jornada}
                variant="detailed"
              />
            </div>
          ))}
        </>
      )}
    </div>
  )
}
