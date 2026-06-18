import type { ObraFull } from '@/types'
import { normalizeObraDate } from '@/lib/date-br'

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

function dayOfWeekFromIso(iso: string): number {
  return new Date(`${iso}T12:00:00`).getDay()
}

/** Verifica se a obra está ativa em um dia (intervalo de datas + dias da semana). */
export function obraAtivaNoDia(
  obra: Pick<ObraFull, 'data_prevista_inicio' | 'data_prevista_fim' | 'dias_trabalho'>,
  iso: string,
  diasPadraoAtivos: number[],
): boolean {
  const inicio = normalizeObraDate(obra.data_prevista_inicio)
  const fim = normalizeObraDate(obra.data_prevista_fim)
  if (!inicio || !fim) return false
  if (iso < inicio || iso > fim) return false

  // Sempre exibir no dia de início e no dia de término (mesmo fora dos dias_trabalho).
  if (iso === inicio || iso === fim) return true

  const dow = dayOfWeekFromIso(iso)

  if (obra.dias_trabalho && obra.dias_trabalho.length > 0) {
    return obra.dias_trabalho.includes(dow)
  }

  return diasPadraoAtivos.includes(dow)
}

/** Obras visíveis em um dia do calendário, respeitando dias_trabalho de cada obra. */
export function obrasParaDiaCalendario(
  obras: ObraFull[],
  iso: string,
  diasPadraoAtivos: number[],
): ObraFull[] {
  return obras.filter(o => obraAtivaNoDia(o, iso, diasPadraoAtivos))
}

/** Dia ativo no calendário: config global ou pelo menos uma obra naquele dia. */
export function isDiaAtivoNoCalendario(
  dow: number,
  diasPadraoAtivos: number[],
  obrasNoDia: ObraFull[],
): boolean {
  return diasPadraoAtivos.includes(dow) || obrasNoDia.length > 0
}
