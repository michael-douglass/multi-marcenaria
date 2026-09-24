import { useEffect, useMemo, useState } from 'react'
import { ErrorState, LoadingState } from '@/components/ui/EmptyState'
import { ResumoPontoAura } from '@/components/ponto/ResumoPontoAura'
import { ResumoPontoBancoDialog } from '@/components/ponto/ResumoPontoBancoDialog'
import { ResumoPontoEmpresaHero } from '@/components/ponto/ResumoPontoEmpresaHero'
import { ResumoPontoFaltaDialog } from '@/components/ponto/ResumoPontoFaltaDialog'
import { ResumoPontoFuncionarioCard } from '@/components/ponto/ResumoPontoFuncionarioCard'
import { useApp } from '@/context/AppContext'
import { useResumoPonto } from '@/hooks/useResumoPonto'
import { pontoDataLocal } from '@/lib/funcionario-ponto'
import { fetchRepConfig } from '@/lib/rep-config'
import type { PontoResumoFuncionarioPeriodo, PontoResumoPeriodo } from '@/types'

/** Primeiro mês em que o ponto da empresa começou a registrar. */
const MES_INICIO_PONTO = '2026-07'

const MODOS: { id: PontoResumoPeriodo; label: string }[] = [
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'ano', label: 'Ano' },
]

function mesAtualLocal(): string {
  return pontoDataLocal().slice(0, 7)
}

function labelMes(yyyyMm: string): string {
  const d = new Date(yyyyMm + '-01T12:00:00')
  const texto = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function tituloPeriodo(periodo: PontoResumoPeriodo, mesRef: string): string {
  if (periodo === 'semana') return 'Esta semana'
  if (periodo === 'ano') return 'Este ano'
  const atual = mesAtualLocal()
  if (mesRef === atual) return 'Este mês'
  return labelMes(mesRef)
}

/** Lista todos os meses do início do ponto até o mês atual (mais recente primeiro). */
function listarMesesAteHoje(): { id: string; label: string }[] {
  const fim = mesAtualLocal()
  const [fy, fm] = MES_INICIO_PONTO.split('-').map(Number)
  const [ty, tm] = fim.split('-').map(Number)
  const itens: { id: string; label: string }[] = []
  let y = fy
  let m = fm
  while (y < ty || (y === ty && m <= tm)) {
    const id = `${y}-${String(m).padStart(2, '0')}`
    itens.push({ id, label: labelMes(id) })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return itens.reverse()
}

function formatIntervalo(inicio?: string, fim?: string): string {
  if (!inicio || !fim) return ''
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
  const a = new Date(inicio + 'T12:00:00').toLocaleDateString('pt-BR', opts)
  const b = new Date(fim + 'T12:00:00').toLocaleDateString('pt-BR', opts)
  return `${a} — ${b}`
}

const CHIP_BASE =
  'resumo-ponto-periodo-chip rounded-lg px-3 py-2 text-sm font-semibold ' +
  'transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ' +
  'active:scale-x-[0.97] active:scale-y-[1.04] sm:px-4'

const CHIP_ON = 'bg-[#f4e4c4] text-[#6b3f12] shadow-sm'
const CHIP_OFF = 'text-[#6b5244] hover:bg-white hover:text-[#1a100c]'

export function ResumoPonto() {
  const { roles } = useApp()
  const {
    periodo,
    setPeriodo,
    mesRef,
    setMesRef,
    resumo,
    loading,
    error,
    reload,
  } = useResumoPonto('mes')
  const [filtroFaltas, setFiltroFaltas] = useState(false)
  const [repCnpj, setRepCnpj] = useState<string | null>(null)
  const [faltaSelecionada, setFaltaSelecionada] = useState<{
    row: PontoResumoFuncionarioPeriodo
    data: string
  } | null>(null)
  const [bancoSelecionado, setBancoSelecionado] = useState<PontoResumoFuncionarioPeriodo | null>(
    null,
  )

  const canEditFalta =
    roles.includes('Administrador') || roles.includes('Financeiro')

  const meses = useMemo(() => listarMesesAteHoje(), [])

  const funcionarios = useMemo(() => {
    const lista = resumo?.funcionarios ?? []
    if (!filtroFaltas) return lista
    return lista.filter(f => f.faltas > 0)
  }, [resumo?.funcionarios, filtroFaltas])

  const intervaloLabel = useMemo(
    () => formatIntervalo(resumo?.inicio, resumo?.fim),
    [resumo?.inicio, resumo?.fim],
  )

  const periodoLabel = useMemo(
    () => tituloPeriodo(periodo, mesRef),
    [periodo, mesRef],
  )

  useEffect(() => {
    let ativo = true
    void fetchRepConfig()
      .then((cfg) => {
        if (ativo) setRepCnpj(cfg?.cnpj ?? null)
      })
      .catch(() => {
        if (ativo) setRepCnpj(null)
      })
    return () => {
      ativo = false
    }
  }, [])

  function trocarModo(proximo: PontoResumoPeriodo) {
    setPeriodo(proximo)
    setFiltroFaltas(false)
  }

  function trocarMes(yyyyMm: string) {
    setMesRef(yyyyMm)
    setFiltroFaltas(false)
  }

  return (
    <div className="resumo-ponto-page relative -mx-2 min-h-[calc(100svh-4.25rem)] px-2 pb-10 sm:-mx-3 sm:px-3 md:px-4">
      <ResumoPontoAura />
      <div className="relative z-[1] mx-auto w-full max-w-[1400px] space-y-6 pt-2 md:pt-4">
        <header className="resumo-ponto-masthead relative overflow-hidden rounded-2xl border border-[rgba(26,16,12,0.12)] bg-[#fffaf4]/95 px-5 py-6 shadow-[0_12px_32px_rgba(42,24,18,0.06)] sm:px-8 sm:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="section-label text-[#6b3f12]">Funcionários</p>
              <h1 className="mt-1 font-display text-3xl tracking-wide text-[#1a100c] sm:text-4xl">
                Resumo de ponto
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4a3428] sm:text-base">
                Chegadas, atrasos, hora extra, faltas e o saldo do período (positivas − negativas) —
                por pessoa e o total da empresa.
              </p>
            </div>

            <div
              className="flex flex-wrap gap-1 rounded-xl border border-[rgba(26,16,12,0.14)] bg-white/90 p-1 shadow-sm"
              role="tablist"
              aria-label="Tipo de período"
            >
              {MODOS.map(p => {
                const ativo = periodo === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={ativo}
                    className={`${CHIP_BASE} ${ativo ? CHIP_ON : CHIP_OFF}`}
                    onClick={() => trocarModo(p.id)}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {periodo === 'mes' && (
            <div
              className="resumo-ponto-meses mt-4 flex gap-1.5 overflow-x-auto overscroll-x-contain rounded-xl border border-[rgba(26,16,12,0.12)] bg-[#f7efe4]/80 p-2"
              role="listbox"
              aria-label="Escolher mês"
            >
              {meses.map((m) => {
                const ativo = mesRef === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    title={m.label}
                    onClick={() => trocarMes(m.id)}
                    className={
                      'resumo-ponto-periodo-chip shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold ' +
                      'transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ' +
                      'active:scale-x-[0.97] active:scale-y-[1.04] ' +
                      (ativo
                        ? 'bg-white text-[#6b3f12] shadow-sm ring-1 ring-[rgba(107,63,18,0.35)]'
                        : 'text-[#6b5244] hover:bg-white/80 hover:text-[#1a100c]')
                    }
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          )}
        </header>

        {loading && <LoadingState message="Carregando resumo do período…" />}
        {!loading && error && <ErrorState message={error} onRetry={() => void reload()} />}

        {!loading && !error && resumo && (
          <>
            <ResumoPontoEmpresaHero
              empresa={resumo.empresa}
              periodoLabel={periodoLabel}
              intervaloLabel={intervaloLabel}
              filtroFaltasAtivo={filtroFaltas}
              onToggleFiltroFaltas={() => setFiltroFaltas(v => !v)}
            />

            {resumo.funcionarios.length === 0 ? (
              <div className="rounded-2xl border border-[rgba(26,16,12,0.12)] bg-[#fffaf4] p-10 text-center text-[#6b5244]">
                Nenhum funcionário de campo cadastrado.
              </div>
            ) : funcionarios.length === 0 ? (
              <div className="rounded-2xl border border-[rgba(26,16,12,0.12)] bg-[#fffaf4] p-10 text-center text-[#6b5244]">
                Ninguém com falta neste período.
                <button
                  type="button"
                  className="mt-3 block w-full text-sm font-semibold text-[#6b3f12] underline-offset-2 hover:underline"
                  onClick={() => setFiltroFaltas(false)}
                >
                  Ver toda a equipe
                </button>
              </div>
            ) : (
              <>
                {filtroFaltas && (
                  <p className="text-sm text-[#6b5244]">
                    Mostrando {funcionarios.length} com falta
                    {' · '}
                    <button
                      type="button"
                      className="font-semibold text-[#6b3f12] underline-offset-2 hover:underline"
                      onClick={() => setFiltroFaltas(false)}
                    >
                      limpar filtro
                    </button>
                  </p>
                )}
                <div className="grid gap-5 xl:grid-cols-2">
                  {funcionarios.map((row, i) => (
                    <ResumoPontoFuncionarioCard
                      key={row.funcionario_id}
                      row={row}
                      index={i}
                      periodoLabel={periodoLabel}
                      intervaloLabel={intervaloLabel}
                      repCnpj={repCnpj}
                      onFaltaClick={(data) => setFaltaSelecionada({ row, data })}
                      onBancoClick={() => setBancoSelecionado(row)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {faltaSelecionada && (
        <ResumoPontoFaltaDialog
          open
          onOpenChange={(open) => {
            if (!open) setFaltaSelecionada(null)
          }}
          row={faltaSelecionada.row}
          data={faltaSelecionada.data}
          canEdit={canEditFalta}
          onSuccess={() => {
            setFaltaSelecionada(null)
            void reload()
          }}
        />
      )}

      {bancoSelecionado && (
        <ResumoPontoBancoDialog
          open
          onOpenChange={(open) => {
            if (!open) setBancoSelecionado(null)
          }}
          funcionarioId={bancoSelecionado.funcionario_id}
          funcionarioNome={bancoSelecionado.nome}
          canEdit={canEditFalta}
          onSuccess={() => {
            setBancoSelecionado(null)
            void reload()
          }}
        />
      )}

      <style>{`
        .resumo-ponto-hero {
          animation: resumoPontoEnter 0.45s cubic-bezier(0, 0, 0.2, 1) both;
        }
        .resumo-ponto-card-wrap {
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
          .resumo-ponto-card-wrap {
            animation: none !important;
          }
          .resumo-ponto-periodo-chip,
          .resumo-ponto-export-btn {
            transition: none !important;
          }
          .resumo-ponto-periodo-chip:active,
          .resumo-ponto-export-btn:active {
            transform: none !important;
          }
        }
      `}</style>
    </div>
  )
}
