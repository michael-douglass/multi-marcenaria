import { useMemo } from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { ErrorState, LoadingState } from '@/components/ui/EmptyState'
import { PontoDiaEscala } from '@/components/ponto/PontoDiaEscala'
import {
  FUNCIONARIO_TIPO_LABEL,
  PONTO_STATUS_DIA_LABEL,
} from '@/lib/funcionario-constants'
import { formatAtrasoMinutos, formatHoraPonto } from '@/lib/funcionario-ponto'
import type { PontoControleFuncionarioRow, PontoStatusDia } from '@/types'

function statusListClass(status: PontoStatusDia): string {
  switch (status) {
    case 'em_dia':
    case 'completo':
      return 'viz-list-item--ok'
    case 'atraso':
      return 'viz-list-item--warn'
    case 'falta':
      return 'viz-list-item--alert'
    default:
      return ''
  }
}

function resumoPonto(rows: PontoControleFuncionarioRow[]) {
  let presentes = 0
  let atrasados = 0
  let faltas = 0
  let pendentes = 0
  for (const r of rows) {
    if (r.status_dia === 'falta') faltas++
    else if (r.status_dia === 'atraso') atrasados++
    else if (r.marcacoes.some(m => m.tipo === 'entrada')) presentes++
    else if (r.status_dia === 'folga') { /* folga */ }
    else pendentes++
  }
  return { presentes, atrasados, faltas, pendentes, total: rows.length }
}

interface VisualizacaoPontoDiarioProps {
  rows: PontoControleFuncionarioRow[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

export function VisualizacaoPontoDiario({
  rows,
  loading,
  error,
  onRetry,
}: VisualizacaoPontoDiarioProps) {
  const resumo = useMemo(() => resumoPonto(rows), [rows])

  if (loading && rows.length === 0) {
    return <LoadingState message="Carregando ponto do dia…" />
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />
  }

  if (rows.length === 0) {
    return (
      <p className="viz-empty viz-empty--center">
        Nenhum funcionário de campo cadastrado.
      </p>
    )
  }

  return (
    <div className="viz-ponto">
      <div className="viz-ponto__resumo">
        <span className="viz-ponto__chip viz-ponto__chip--gold">
          Equipe <strong>{resumo.total}</strong>
        </span>
        <span className="viz-ponto__chip viz-ponto__chip--green">
          Presentes <strong>{resumo.presentes}</strong>
        </span>
        <span className="viz-ponto__chip viz-ponto__chip--amber">
          Atrasados <strong>{resumo.atrasados}</strong>
        </span>
        <span className="viz-ponto__chip viz-ponto__chip--red">
          Faltas <strong>{resumo.faltas}</strong>
        </span>
        <span className="viz-ponto__chip">
          Aguardando <strong>{resumo.pendentes}</strong>
        </span>
      </div>

      <ul className="viz-ponto__lista space-y-2">
        {rows.map(row => {
          const entrada = row.marcacoes.find(m => m.tipo === 'entrada') ?? row.entrada
          const chegada = formatHoraPonto(entrada?.registrado_em)
          const previsto = formatHoraPonto(row.jornada?.hora_entrada ?? row.hora_prevista)
          const statusLabel = PONTO_STATUS_DIA_LABEL[row.status_dia] ?? row.status_dia
          const batidasFeitas = row.marcacoes.length

          return (
            <li key={row.funcionario_id} className="viz-ponto__card">
              <details className={`viz-ponto__details ${statusListClass(row.status_dia)}`}>
                <summary className="viz-ponto__summary">
                  <div className="min-w-0 flex-1">
                    <p className="viz-list-item__title">{row.nome}</p>
                    <p className="viz-list-item__meta">
                      {FUNCIONARIO_TIPO_LABEL[row.tipo]}
                      {entrada ? ` · chegada ${chegada}` : ` · previsto ${previsto}`}
                      {entrada?.status === 'atraso' && entrada.atraso_minutos != null && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-amber-300">
                          <AlertTriangle size={11} />
                          +{formatAtrasoMinutos(entrada.atraso_minutos)}
                        </span>
                      )}
                      {batidasFeitas > 0 && (
                        <span className="ml-1 text-[#f2d892]">
                          · {batidasFeitas}/4 batidas
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="viz-list-item__value text-sm">{statusLabel}</span>
                    <ChevronDown size={16} className="viz-ponto__chevron text-[#b8957f]" />
                  </div>
                </summary>
                <div className="viz-ponto__escala">
                  <PontoDiaEscala
                    marcacoes={row.marcacoes}
                    jornada={row.jornada}
                    compact
                  />
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
