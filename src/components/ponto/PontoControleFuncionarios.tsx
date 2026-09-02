import { useMemo, useState } from 'react'
import { ErrorState, LoadingState } from '@/components/ui/EmptyState'
import { DateInput } from '@/components/ui/DateInput'
import {
  FUNCIONARIO_TIPO_LABEL,
  PONTO_STATUS_DIA_LABEL,
} from '@/lib/funcionario-constants'
import {
  calcularSaldoJornadaDia,
  formatMinutosSaldo,
  type PontoSaldoDia,
} from '@/lib/funcionario-ponto'
import { PontoDiaEscala } from '@/components/ponto/PontoDiaEscala'
import { useControlePontoDiario } from '@/hooks/useControlePontoDiario'
import type { PontoControleFuncionarioRow, PontoStatusDia } from '@/types'

/** Categorias dos cards de resumo — clique filtra a lista abaixo. */
type ResumoFiltro = 'equipe' | 'presentes' | 'atrasados' | 'faltas' | 'aguardando'

const FILTRO_LABEL: Record<ResumoFiltro, string> = {
  equipe: 'toda a equipe',
  presentes: 'presentes',
  atrasados: 'atrasados',
  faltas: 'faltas',
  aguardando: 'aguardando batida',
}

function classificarResumo(row: PontoControleFuncionarioRow): ResumoFiltro | 'folga' {
  if (row.status_dia === 'falta') return 'faltas'
  if (row.status_dia === 'atraso') return 'atrasados'
  if (row.marcacoes.some(m => m.tipo === 'entrada')) return 'presentes'
  if (row.status_dia === 'folga') return 'folga'
  return 'aguardando'
}

function statusStyle(status: PontoStatusDia): string {
  switch (status) {
    case 'em_dia':
    case 'completo':
      return 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200'
    case 'atraso':
      return 'border-amber-400/50 bg-amber-500/15 text-amber-200'
    case 'falta':
      return 'border-red-400/45 bg-red-500/15 text-red-200'
    case 'folga':
      return 'border-violet-400/45 bg-violet-500/15 text-violet-200'
    default:
      return 'border-[rgba(242,216,146,0.5)] bg-[rgba(242,216,146,0.14)] text-[#f6e4a8] font-semibold'
  }
}

function ResumoChip({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string
  value: number
  tone: 'gold' | 'green' | 'amber' | 'red' | 'muted'
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Filtrar por ${label}: ${value}`}
      data-tone={tone}
      className="ponto-resumo-chip rounded-xl px-4 py-3 text-left transition-all duration-200 hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b3f12]/45"
    >
      <p className="ponto-resumo-chip__label">{label}</p>
      <p className="font-display mt-1 text-2xl tabular-nums">{value}</p>
    </button>
  )
}

function saldoBadgeClass(saldo: PontoSaldoDia): string {
  if (saldo.status === 'credito') {
    return 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200'
  }
  if (saldo.status === 'devendo') {
    return 'border-red-400/45 bg-red-500/15 text-red-200'
  }
  return 'border-[rgba(242,216,146,0.4)] bg-[rgba(242,216,146,0.12)] text-[#f6e4a8]'
}

function saldoLabel(saldo: PontoSaldoDia): string {
  const qtd = formatMinutosSaldo(saldo.saldo_minutos)
  if (saldo.status === 'credito') return `Crédito ${qtd}`
  if (saldo.status === 'devendo') return `Devendo ${qtd}`
  return 'Em dia'
}

function FuncionarioPontoCard({ row }: { row: PontoControleFuncionarioRow }) {
  const saldo = calcularSaldoJornadaDia(row.marcacoes, row.jornada)

  return (
    <article
      className="ponto-dark-island group relative overflow-hidden rounded-2xl transition-all duration-300 hover:border-[rgba(242,216,146,0.5)]"
      style={{ animation: 'fadeIn 0.45s ease-out both' }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-70"
        style={{
          background: 'linear-gradient(to right, transparent, #f2d892, transparent)',
        }}
      />

      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(242,216,146,0.18)] px-5 py-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl tracking-wide text-[#f2d892]">{row.nome}</h3>
          <p className="section-label mt-0.5">{FUNCIONARIO_TIPO_LABEL[row.tipo]}</p>
          {saldo && (
            <p
              className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium tabular-nums tracking-wide ${saldoBadgeClass(saldo)}`}
              title={
                'Trabalhou ' +
                formatMinutosSaldo(saldo.minutos_trabalhados) +
                ' de ' +
                formatMinutosSaldo(saldo.minutos_previstos) +
                ' previstos'
              }
            >
              {saldoLabel(saldo)}
            </p>
          )}
          {!saldo && row.marcacoes.some(m => m.tipo === 'entrada') && (
            <p className="mt-2 text-xs text-[#b8957f]">
              Saldo do dia: aguardando saída
            </p>
          )}
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider ${statusStyle(row.status_dia)}`}>
          {PONTO_STATUS_DIA_LABEL[row.status_dia] ?? row.status_dia}
        </span>
      </header>

      <div className="p-5">
        {row.ocorrencia && (row.status_dia === 'folga' || row.status_dia === 'falta') && (
          <p className="mb-4 rounded-lg border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-sm text-violet-200">
            Ocorrência registrada: <strong>{row.ocorrencia}</strong>
          </p>
        )}
        <PontoDiaEscala marcacoes={row.marcacoes} jornada={row.jornada} />
      </div>
    </article>
  )
}

export function PontoControleFuncionarios() {
  const { data, setData, rows, loading, error, reload } = useControlePontoDiario()
  const [filtro, setFiltro] = useState<ResumoFiltro>('equipe')

  const resumo = useMemo(() => {
    let presentes = 0
    let atrasados = 0
    let faltas = 0
    let pendentes = 0
    for (const r of rows) {
      const cat = classificarResumo(r)
      if (cat === 'faltas') faltas++
      else if (cat === 'atrasados') atrasados++
      else if (cat === 'presentes') presentes++
      else if (cat === 'aguardando') pendentes++
    }
    return { presentes, atrasados, faltas, pendentes, total: rows.length }
  }, [rows])

  const rowsFiltradas = useMemo(() => {
    if (filtro === 'equipe') return rows
    return rows.filter(r => classificarResumo(r) === filtro)
  }, [rows, filtro])

  const dataFormatada = useMemo(() => {
    const d = new Date(data + 'T12:00:00')
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }, [data])

  function selecionarFiltro(proximo: ResumoFiltro) {
    // Clicar de novo no mesmo card (exceto Equipe) volta para toda a equipe
    if (proximo !== 'equipe' && filtro === proximo) {
      setFiltro('equipe')
      return
    }
    setFiltro(proximo)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-label capitalize">{dataFormatada}</p>
          <h2 className="font-display text-2xl text-[#f2d892]">Resumo diário da equipe</h2>
          <p className="mt-1 text-sm text-[#b8957f]">
            Toque em um card para filtrar a lista
          </p>
        </div>
        <label className="flex flex-col gap-1.5 sm:items-end">
          <span className="text-[0.65rem] font-medium uppercase tracking-wider text-[#b8957f]">
            Data (dia / mês / ano)
          </span>
          <DateInput
            className="min-w-[11rem]"
            value={data}
            onChange={iso => {
              if (iso) {
                setData(iso)
                setFiltro('equipe')
              }
            }}
            aria-label="Selecionar data do controle de ponto"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ResumoChip
          label="Equipe"
          value={resumo.total}
          tone="gold"
          active={filtro === 'equipe'}
          onClick={() => selecionarFiltro('equipe')}
        />
        <ResumoChip
          label="Presentes"
          value={resumo.presentes}
          tone="green"
          active={filtro === 'presentes'}
          onClick={() => selecionarFiltro('presentes')}
        />
        <ResumoChip
          label="Atrasados"
          value={resumo.atrasados}
          tone="amber"
          active={filtro === 'atrasados'}
          onClick={() => selecionarFiltro('atrasados')}
        />
        <ResumoChip
          label="Faltas"
          value={resumo.faltas}
          tone="red"
          active={filtro === 'faltas'}
          onClick={() => selecionarFiltro('faltas')}
        />
        <ResumoChip
          label="Aguardando"
          value={resumo.pendentes}
          tone="muted"
          active={filtro === 'aguardando'}
          onClick={() => selecionarFiltro('aguardando')}
        />
      </div>

      {loading && <LoadingState message="Carregando batidas do dia…" />}
      {!loading && error && <ErrorState message={error} onRetry={() => void reload()} />}

      {!loading && !error && rows.length === 0 && (
        <div className="glass-card p-10 text-center text-[#b8957f]">
          Nenhum funcionário de campo cadastrado.
        </div>
      )}

      {!loading && !error && rows.length > 0 && rowsFiltradas.length === 0 && (
        <div className="glass-card p-10 text-center text-[#b8957f]">
          Ninguém em “{FILTRO_LABEL[filtro]}” nesta data.
          <button
            type="button"
            className="mt-3 block w-full text-sm text-[#f2d892] underline-offset-2 hover:underline"
            onClick={() => setFiltro('equipe')}
          >
            Ver toda a equipe
          </button>
        </div>
      )}

      {!loading && !error && rowsFiltradas.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-2">
          {rowsFiltradas.map((row, i) => (
            <div key={row.funcionario_id} style={{ animationDelay: `${i * 60}ms` }}>
              <FuncionarioPontoCard row={row} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
