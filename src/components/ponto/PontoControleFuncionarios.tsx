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
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
    case 'atraso':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    case 'falta':
      return 'border-red-500/35 bg-red-500/10 text-red-300'
    case 'folga':
      return 'border-violet-500/35 bg-violet-500/10 text-violet-200'
    default:
      return 'border-[rgba(212,168,83,0.25)] bg-[rgba(36,16,8,0.5)] text-[#b8957f]'
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
  const tones = {
    gold: 'from-[rgba(201,160,69,0.18)] border-[rgba(212,168,83,0.35)] text-[#f2d892]',
    green: 'from-emerald-500/15 border-emerald-500/30 text-emerald-300',
    amber: 'from-amber-500/15 border-amber-500/30 text-amber-300',
    red: 'from-red-500/15 border-red-500/30 text-red-300',
    muted: 'from-[rgba(36,16,8,0.6)] border-[rgba(212,168,83,0.2)] text-[#edd9c4]',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Filtrar por ${label}: ${value}`}
      className={`rounded-xl border bg-gradient-to-br to-transparent px-4 py-3 text-left transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a853]/60 ${tones[tone]} ${
        active
          ? 'ring-2 ring-[#d4a853]/70 shadow-mogno scale-[1.02]'
          : 'opacity-90 hover:opacity-100'
      }`}
    >
      <p className="text-[0.65rem] uppercase tracking-widest opacity-80">{label}</p>
      <p className="font-display mt-1 text-2xl tabular-nums">{value}</p>
    </button>
  )
}

function saldoBadgeClass(saldo: PontoSaldoDia): string {
  if (saldo.status === 'credito') {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  }
  if (saldo.status === 'devendo') {
    return 'border-red-500/40 bg-red-500/10 text-red-300'
  }
  return 'border-[rgba(212,168,83,0.3)] bg-[rgba(212,168,83,0.08)] text-[#f2d892]'
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
      className="group relative overflow-hidden rounded-2xl border border-[rgba(212,168,83,0.22)] bg-[rgba(36,16,8,0.72)] shadow-mogno transition-all duration-300 hover:border-[rgba(212,168,83,0.45)] hover:shadow-mogno-lg"
      style={{ animation: 'fadeIn 0.45s ease-out both' }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-60"
        style={{
          background: 'linear-gradient(to right, transparent, #f2d892, transparent)',
        }}
      />

      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(212,168,83,0.12)] px-5 py-4">
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
