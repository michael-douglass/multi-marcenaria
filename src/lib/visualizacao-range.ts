import { addDaysISO, todayISO } from '@/lib/obra-chegada-material'
import { fmtDate } from '@/lib/utils'

/** Janela fixa do painel: hoje até +7 dias (8 colunas). */
export const VISUALIZACAO_DIAS_A_FRENTE = 7

export function getVisualizacaoRange(): { start: string; end: string; days: string[] } {
  const start = todayISO()
  const days = Array.from({ length: VISUALIZACAO_DIAS_A_FRENTE + 1 }, (_, i) => addDaysISO(start, i))
  return { start, end: days[days.length - 1]!, days }
}

export function formatVisualizacaoRangeLabel(start: string, end: string): string {
  return `${fmtDate(start)} até ${fmtDate(end)}`
}

export function isoEstaNoRange(iso: string | null | undefined, start: string, end: string): boolean {
  if (!iso) return false
  return iso >= start && iso <= end
}
