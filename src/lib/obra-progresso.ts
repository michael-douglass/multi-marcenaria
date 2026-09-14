import { fmtDate } from './utils'
import { normalizeObraDate } from './date-br'
import { obraVisivelNoDiaCalendario } from './obra-dias-trabalho'
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
  const fimOriginal = normalizeObraDate(obra.data_prevista_fim_original) ?? fim

  if (daysRemaining < 0 || obra.atraso_permanente) {
    const atrasoRef = daysRemaining < 0 ? fim : fimOriginal
    const atraso = Math.max(1, Math.abs(daysBetween(today, atrasoRef)))
    return {
      variant: 'overdue',
      percentElapsed: 100,
      label: `${atraso} dia${atraso !== 1 ? 's' : ''} de atraso`,
      sublabel: obra.atraso_permanente && daysRemaining >= 0
        ? `reagendada até ${fmtDate(fim)} · original ${fmtDate(fimOriginal)}`
        : `previsto até ${fmtDate(fim)}`,
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
  const barColor = urgente ? '#f59e0b' : '#f2d892'

  return {
    variant: obra.status_kanban === 'em_andamento' ? 'running' : 'scheduled',
    percentElapsed,
    label: `Faltam ${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''}`,
    sublabel: `até ${fmtDate(fim)}`,
    barColor,
  }
}

/** Retorna o status efetivo da obra: atraso permanente ou prazo vencido (se aberta). */
export function getStatusEfetivo(obra: ObraFull, refDate: Date = new Date()): StatusKanbanObra {
  if (obra.status_kanban === 'concluida' || obra.status_kanban === 'cancelada') {
    return obra.status_kanban
  }
  if (obra.atraso_permanente) {
    return 'datas_em_atraso'
  }
  const fim = normalizeObraDate(obra.data_prevista_fim)
  const hoje = refDate.toISOString().slice(0, 10)
  if (fim && fim < hoje) {
    return 'datas_em_atraso'
  }
  return obra.status_kanban
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
    const statusEfetivo = getStatusEfetivo(obra)
    const ocultaDoCalendario =
      statusEfetivo === 'concluida' ||
      statusEfetivo === 'cancelada'

    if (ocultaDoCalendario && filtros.etapa !== statusEfetivo) return false

    if (q) {
      const haystack = [
        obra.cliente_nome,
        obra.lousa,
        obra.endereco_obra,
        obra.tipo_obra_nome,
        obra.grupo_obra_nome,
        obra.montador_nome,
        obra.montador_admin_nome,
        STATUS_LABEL_BUSCA[statusEfetivo],
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (!haystack.includes(q)) return false
    }

    if (filtros.etapa && statusEfetivo !== filtros.etapa) return false

    if (filtros.data) {
      if (!obraVisivelNoDiaCalendario(obra, filtros.data, [0, 1, 2, 3, 4, 5, 6])) return false
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

/** Data principal usada para ordenar cards no kanban da agenda. */
export function obraAgendaKanbanSortDate(
  obra: ObraFull,
  col: StatusKanbanObra,
): string | null {
  switch (col) {
    case 'datas_em_aberto':
      return obra.data_prevista_inicio ?? obra.data_prevista_fim ?? null
    case 'datas_em_atraso':
    case 'em_andamento':
      return obra.data_prevista_fim ?? obra.data_prevista_inicio ?? null
    case 'datas_definidas':
      return obra.data_prevista_inicio ?? obra.data_prevista_fim ?? null
    case 'concluida':
      return (
        obra.finalizado_em?.slice(0, 10) ??
        obra.data_prevista_fim ??
        obra.data_prevista_inicio ??
        null
      )
    case 'cancelada':
      return obra.data_prevista_fim ?? obra.data_prevista_inicio ?? null
  }
}

export function compareObrasAgendaKanban(
  a: ObraFull,
  b: ObraFull,
  col: StatusKanbanObra,
): number {
  const da = obraAgendaKanbanSortDate(a, col)
  const db = obraAgendaKanbanSortDate(b, col)

  if (!da && !db) {
    return a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR')
  }
  if (!da) return 1
  if (!db) return -1

  const dateCmp = da.localeCompare(db)
  if (dateCmp !== 0) {
    // Concluídas: data mais recente (mais próxima de hoje) primeiro.
    if (col === 'concluida') return -dateCmp
    // Demais colunas: data mais próxima / urgente primeiro.
    return dateCmp
  }

  const fimA = a.data_prevista_fim ?? ''
  const fimB = b.data_prevista_fim ?? ''
  if (fimA !== fimB) return fimA.localeCompare(fimB)

  return a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR')
}

export function sortObrasAgendaKanban(
  obras: ObraFull[],
  col: StatusKanbanObra,
): ObraFull[] {
  return [...obras].sort((a, b) => compareObrasAgendaKanban(a, b, col))
}

export function groupObrasAgendaKanban(obras: ObraFull[]): Record<StatusKanbanObra, ObraFull[]> {
  const map: Record<StatusKanbanObra, ObraFull[]> = {
    datas_em_aberto: [],
    datas_em_atraso: [],
    datas_definidas: [],
    em_andamento: [],
    concluida: [],
    cancelada: [],
  }

  for (const obra of obras) {
    map[getStatusEfetivo(obra)].push(obra)
  }

  for (const col of Object.keys(map) as StatusKanbanObra[]) {
    map[col] = sortObrasAgendaKanban(map[col], col)
  }

  return map
}
