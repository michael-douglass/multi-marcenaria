import { fmtDate } from './utils'
import type { ObraFull, StatusKanbanObra } from '../types'

export type ObraProgressoVariant =
  | 'no-dates'
  | 'scheduled'
  | 'running'
  | 'overdue'
  | 'done'
  | 'cancelled'

export interface ObraProgressoInfo {
  variant: ObraProgressoVariant
  percentElapsed: number
  label: string
  sublabel?: string
  barColor: string
}

const MS_PER_DAY = 86_400_000

function parseDay(iso: string): number {
  return new Date(`${iso}T12:00:00`).getTime()
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseDay(toIso) - parseDay(fromIso)) / MS_PER_DAY)
}

export function calcObraProgresso(
  obra: ObraFull,
  refDate: Date = new Date(),
): ObraProgressoInfo {
  const today = refDate.toISOString().slice(0, 10)

  if (obra.status_kanban === 'cancelada') {
    return {
      variant: 'cancelled',
      percentElapsed: 0,
      label: 'Cancelada',
      barColor: '#9ca3af',
    }
  }

  if (obra.status_kanban === 'concluida' || obra.finalizado_em) {
    return {
      variant: 'done',
      percentElapsed: 100,
      label: 'Concluída',
      barColor: '#10b981',
    }
  }

  const fim = obra.data_prevista_fim
  if (!fim) {
    return {
      variant: 'no-dates',
      percentElapsed: 0,
      label: 'Sem prazo definido',
      barColor: '#6b7280',
    }
  }

  const inicio = obra.data_prevista_inicio ?? fim
  const totalDays = Math.max(daysBetween(inicio, fim), 1)
  const elapsedDays = Math.max(0, daysBetween(inicio, today))
  const percentElapsed = Math.min(100, Math.round((elapsedDays / totalDays) * 100))
  const daysRemaining = daysBetween(today, fim)

  if (daysRemaining < 0) {
    const atraso = Math.abs(daysRemaining)
    return {
      variant: 'overdue',
      percentElapsed: 100,
      label: `${atraso} dia${atraso !== 1 ? 's' : ''} de atraso`,
      sublabel: `previsto até ${fmtDate(fim)}`,
      barColor: '#ef4444',
    }
  }

  if (daysRemaining === 0) {
    return {
      variant: 'running',
      percentElapsed,
      label: 'Termina hoje',
      sublabel: fmtDate(fim),
      barColor: '#f59e0b',
    }
  }

  const urgente = daysRemaining <= 2 || percentElapsed >= 75
  const barColor = urgente ? '#f59e0b' : '#d4a853'

  return {
    variant: obra.status_kanban === 'em_andamento' ? 'running' : 'scheduled',
    percentElapsed,
    label: `Faltam ${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''}`,
    sublabel: `até ${fmtDate(fim)}`,
    barColor,
  }
}

export interface ObraFiltrosCalendario {
  busca: string
  etapa: StatusKanbanObra | ''
  data: string
}

export function filtrarObrasCalendario(
  obras: ObraFull[],
  filtros: ObraFiltrosCalendario,
): ObraFull[] {
  const q = filtros.busca.trim().toLowerCase()

  return obras.filter(obra => {
    const ocultaDoCalendario =
      obra.status_kanban === 'concluida' ||
      obra.status_kanban === 'cancelada'

    if (ocultaDoCalendario && filtros.etapa !== obra.status_kanban) return false

    if (q) {
      const haystack = [
        obra.cliente_nome,
        obra.lousa,
        obra.endereco_obra,
        obra.tipo_obra_nome,
        obra.grupo_obra_nome,
        obra.montador_nome,
        obra.montador_admin_nome,
        STATUS_LABEL_BUSCA[obra.status_kanban],
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (!haystack.includes(q)) return false
    }

    if (filtros.etapa && obra.status_kanban !== filtros.etapa) return false

    if (filtros.data) {
      if (!obra.data_prevista_inicio || !obra.data_prevista_fim) return false
      if (
        filtros.data < obra.data_prevista_inicio ||
        filtros.data > obra.data_prevista_fim
      ) {
        return false
      }
    }

    return true
  })
}

const STATUS_LABEL_BUSCA: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'em aberto datas em aberto',
  datas_em_atraso: 'em atraso atrasada',
  datas_definidas: 'agendada datas definidas',
  em_andamento: 'em andamento',
  concluida: 'concluida concluída',
  cancelada: 'cancelada',
}
