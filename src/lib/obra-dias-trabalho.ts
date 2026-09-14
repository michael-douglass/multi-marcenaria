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

/** Ordena obras pelo horário de início (mais cedo primeiro); sem horário vai ao final. */
export function sortObrasPorHorarioInicio(obras: ObraFull[]): ObraFull[] {
  return [...obras].sort((a, b) => {
    const ha = a.horario_inicio?.trim() || '99:99'
    const hb = b.horario_inicio?.trim() || '99:99'
    if (ha !== hb) return ha.localeCompare(hb)
    const fa = a.horario_fim?.trim() || '99:99'
    const fb = b.horario_fim?.trim() || '99:99'
    if (fa !== fb) return fa.localeCompare(fb)
    return a.cliente_nome.localeCompare(b.cliente_nome, 'pt-BR')
  })
}

function dayOfWeekFromIso(iso: string): number {
  return new Date(`${iso}T12:00:00`).getDay()
}

function hojeIsoLocal(ref: Date = new Date()): string {
  return ref.toISOString().slice(0, 10)
}

type ObraCalendarioDia = Pick<
  ObraFull,
  | 'data_prevista_inicio'
  | 'data_prevista_fim'
  | 'dias_trabalho'
  | 'status_kanban'
  | 'finalizado_em'
  | 'atraso_permanente'
>

/** Prazo já passou (ou atraso permanente) e a obra ainda não foi concluída nem cancelada. */
export function obraEmAtrasoAberta(obra: ObraCalendarioDia, hojeIso: string): boolean {
  if (obra.status_kanban === 'concluida' || obra.status_kanban === 'cancelada') return false
  if (obra.finalizado_em) return false
  if (obra.atraso_permanente) return true
  const fim = normalizeObraDate(obra.data_prevista_fim)
  return Boolean(fim && fim < hojeIso)
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

/**
 * No calendário, obra em atraso continua aparecendo no dia de hoje
 * até alguém concluir — senão some no vencimento e o montador não vê.
 */
export function obraVisivelNoDiaCalendario(
  obra: ObraCalendarioDia,
  iso: string,
  diasPadraoAtivos: number[],
  hojeIso: string = hojeIsoLocal(),
): boolean {
  if (obraAtivaNoDia(obra, iso, diasPadraoAtivos)) return true
  return iso === hojeIso && obraEmAtrasoAberta(obra, hojeIso)
}

/** Obras visíveis em um dia do calendário, respeitando dias_trabalho de cada obra. */
export function obrasParaDiaCalendario(
  obras: ObraFull[],
  iso: string,
  diasPadraoAtivos: number[],
  hojeIso: string = hojeIsoLocal(),
): ObraFull[] {
  const visiveis = obras.filter(o => obraVisivelNoDiaCalendario(o, iso, diasPadraoAtivos, hojeIso))
  const atrasadas: ObraFull[] = []
  const noPrazo: ObraFull[] = []
  for (const obra of visiveis) {
    if (obraEmAtrasoAberta(obra, hojeIso)) atrasadas.push(obra)
    else noPrazo.push(obra)
  }
  return [
    ...sortObrasPorHorarioInicio(atrasadas),
    ...sortObrasPorHorarioInicio(noPrazo),
  ]
}

/** Dia ativo no calendário: config global ou pelo menos uma obra naquele dia. */
export function isDiaAtivoNoCalendario(
  dow: number,
  diasPadraoAtivos: number[],
  obrasNoDia: ObraFull[],
): boolean {
  return diasPadraoAtivos.includes(dow) || obrasNoDia.length > 0
}
