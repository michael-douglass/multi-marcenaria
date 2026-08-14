import type { CSSProperties } from 'react'
import type { StatusKanbanObra } from '@/types'

/** Largura fixa das colunas do kanban — texto quebra dentro do card, não estoura a coluna. */
export const KANBAN_COL_CLASS =
  'kanban-col flex w-[280px] min-w-[280px] max-w-[300px] shrink-0 flex-col gap-2 md:h-full md:min-h-0'

/** Lista de cards: no desktop a coluna tem altura da tela e rola por dentro. */
export const KANBAN_COL_LIST_CLASS =
  'kanban-col-list flex min-h-0 flex-1 flex-col gap-2 overflow-y-scroll overscroll-contain rounded-lg'

/** Rótulos curtos no topo da coluna (cabeçalho estreito). */
export const KANBAN_COL_SHORT: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Atraso',
  datas_definidas: 'Definidas',
  em_andamento: 'Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export function kanbanColHeaderClass(isOver: boolean, _cor: string) {
  return [
    'kanban-col-header flex min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2 transition-all',
    isOver ? 'ring-2' : '',
  ].join(' ')
}

export function kanbanColHeaderStyle(isOver: boolean, cor: string): CSSProperties {
  return {
    backgroundColor: isOver ? `${cor}30` : `${cor}18`,
    border: `1px solid ${isOver ? cor : `${cor}33`}`,
    boxShadow: isOver ? `0 0 0 2px ${cor}40` : undefined,
  }
}
