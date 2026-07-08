import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ErrorState, LoadingState } from '@/components/ui/EmptyState'
import {
  FUNCIONARIO_TIPO_LABEL,
  PONTO_STATUS_DIA_LABEL,
} from '@/lib/funcionario-constants'
import { formatHoraPonto } from '@/lib/funcionario-ponto'
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
    else if (r.entrada) presentes++
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

      <ul className="viz-list">
        {rows.map(row => {
          const entrada = row.entrada
          const chegada = formatHoraPonto(entrada?.registrado_em)
          const previsto = formatHoraPonto(row.hora_prevista)
          const statusLabel = PONTO_STATUS_DIA_LABEL[row.status_dia] ?? row.status_dia

          return (
            <li
              key={row.funcionario_id}
              className={`viz-list-item ${statusListClass(row.status_dia)}`}
            >
              <div className="min-w-0 flex-1">
                <p className="viz-list-item__title">{row.nome}</p>
                <p className="viz-list-item__meta">
                  {FUNCIONARIO_TIPO_LABEL[row.tipo]}
                  {entrada ? ` · chegada ${chegada}` : ` · previsto ${previsto}`}
                  {entrada?.status === 'atraso' && entrada.atraso_minutos != null && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-amber-300">
                      <AlertTriangle size={11} />
                      +{entrada.atraso_minutos} min
                    </span>
                  )}
                </p>
              </div>
              <p className="viz-list-item__value shrink-0 text-sm">{statusLabel}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
