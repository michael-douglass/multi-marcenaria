import type { ObraFull } from '@/types'

export const OBRA_WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const
export const OBRA_WEEKDAYS_LONG = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const

export function hasObraDiasHorarios(
  obra: Pick<ObraFull, 'dias_trabalho' | 'horario_inicio' | 'horario_fim'>,
): boolean {
  return (
    (obra.dias_trabalho?.length ?? 0) > 0
    || !!obra.horario_inicio?.trim()
    || !!obra.horario_fim?.trim()
  )
}

/** Nomes completos dos dias configurados, na ordem Dom→Sáb. */
export function getObraDiasTrabalhoLongLabels(dias: number[] | null | undefined): string[] {
  if (!dias?.length) return []
  return [...dias]
    .filter(d => d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map(d => OBRA_WEEKDAYS_LONG[d])
}

/** Ex.: "08:00 às 17:00" ou só um dos horários quando o outro falta. */
export function formatObraHorarioRange(
  inicio: string | null | undefined,
  fim: string | null | undefined,
): string | null {
  const i = inicio?.trim()
  const f = fim?.trim()
  if (i && f) return `${i} às ${f}`
  if (i) return `a partir das ${i}`
  if (f) return `até ${f}`
  return null
}
