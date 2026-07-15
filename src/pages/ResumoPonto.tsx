import { useMemo, useState } from 'react'
import { ErrorState, LoadingState } from '@/components/ui/EmptyState'
import { ResumoPontoEmpresaHero } from '@/components/ponto/ResumoPontoEmpresaHero'
import { ResumoPontoFuncionarioCard } from '@/components/ponto/ResumoPontoFuncionarioCard'
import { useResumoPonto } from '@/hooks/useResumoPonto'
import type { PontoResumoPeriodo } from '@/types'

const PERIODOS: { id: PontoResumoPeriodo; label: string }[] = [
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'ano', label: 'Ano' },
]

const PERIODO_TITULO: Record<PontoResumoPeriodo, string> = {
  semana: 'Esta semana',
  mes: 'Este mês',
  ano: 'Este ano',
}

function formatIntervalo(inicio?: string, fim?: string): string {
  if (!inicio || !fim) return ''
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
  const a = new Date(inicio + 'T12:00:00').toLocaleDateString('pt-BR', opts)
  const b = new Date(fim + 'T12:00:00').toLocaleDateString('pt-BR', opts)
  return `${a} — ${b}`
}

export function ResumoPonto() {
  const { periodo, setPeriodo, resumo, loading, error, reload } = useResumoPonto('mes')
  const [filtroFaltas, setFiltroFaltas] = useState(false)

  const funcionarios = useMemo(() => {
    const lista = resumo?.funcionarios ?? []
    if (!filtroFaltas) return lista
    return lista.filter(f => f.faltas > 0)
  }, [resumo?.funcionarios, filtroFaltas])

  function trocarPeriodo(proximo: PontoResumoPeriodo) {
    setPeriodo(proximo)
    setFiltroFaltas(false)
  }

  return (
    <div className="resumo-ponto-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label">Funcionários</p>
          <h1 className="font-display text-3xl tracking-wide text-[#f2d892]">Resumo de ponto</h1>
          <p className="mt-1 max-w-xl text-sm text-[#b8957f]">
            Chegadas, hora extra (após o horário de saída) e faltas — por pessoa e o total da empresa.
          </p>
        </div>

        <div
          className="flex gap-1 rounded-xl border border-[rgba(212,168,83,0.25)] bg-[rgba(36,16,8,0.65)] p-1"
          role="tablist"
          aria-label="Período do resumo"
        >
          {PERIODOS.map(p => {
            const ativo = periodo === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={ativo}
                className={`resumo-ponto-periodo-chip rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-x-[0.97] active:scale-y-[1.04] ${
                  ativo
                    ? 'bg-[rgba(201,160,69,0.22)] text-[#f2d892] shadow-sm'
                    : 'text-[#b8957f] hover:text-[#edd9c4]'
                }`}
                onClick={() => trocarPeriodo(p.id)}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </header>

      {loading && <LoadingState message="Carregando resumo do período…" />}
      {!loading && error && <ErrorState message={error} onRetry={() => void reload()} />}

      {!loading && !error && resumo && (
        <>
          <ResumoPontoEmpresaHero
            empresa={resumo.empresa}
            periodoLabel={PERIODO_TITULO[resumo.periodo]}
            intervaloLabel={formatIntervalo(resumo.inicio, resumo.fim)}
            filtroFaltasAtivo={filtroFaltas}
            onToggleFiltroFaltas={() => setFiltroFaltas(v => !v)}
          />

          {resumo.funcionarios.length === 0 ? (
            <div className="glass-card p-10 text-center text-[#b8957f]">
              Nenhum funcionário de campo cadastrado.
            </div>
          ) : funcionarios.length === 0 ? (
            <div className="glass-card p-10 text-center text-[#b8957f]">
              Ninguém com falta neste período.
              <button
                type="button"
                className="mt-3 block w-full text-sm text-[#f2d892] underline-offset-2 hover:underline"
                onClick={() => setFiltroFaltas(false)}
              >
                Ver toda a equipe
              </button>
            </div>
          ) : (
            <>
              {filtroFaltas && (
                <p className="text-sm text-[#b8957f]">
                  Mostrando {funcionarios.length} com falta
                  {' · '}
                  <button
                    type="button"
                    className="text-[#f2d892] underline-offset-2 hover:underline"
                    onClick={() => setFiltroFaltas(false)}
                  >
                    limpar filtro
                  </button>
                </p>
              )}
              <div className="grid gap-5 xl:grid-cols-2">
                {funcionarios.map((row, i) => (
                  <ResumoPontoFuncionarioCard key={row.funcionario_id} row={row} index={i} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        .resumo-ponto-hero {
          animation: resumoPontoEnter 0.45s cubic-bezier(0, 0, 0.2, 1) both;
        }
        .resumo-ponto-card {
          animation: resumoPontoEnter 0.4s cubic-bezier(0, 0, 0.2, 1) both;
        }
        @keyframes resumoPontoEnter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .resumo-ponto-hero,
          .resumo-ponto-card {
            animation: none !important;
          }
          .resumo-ponto-periodo-chip {
            transition: none !important;
          }
          .resumo-ponto-periodo-chip:active {
            transform: none !important;
          }
        }
      `}</style>
    </div>
  )
}
