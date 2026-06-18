/** Converte ISO (YYYY-MM-DD) para exibição brasileira (DD/MM/YYYY). */
export function isoToBrDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return ''
  return `${match[3]}/${match[2]}/${match[1]}`
}

export function parseIsoDate(iso: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!iso) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  if (!isValidCalendarDate(day, month + 1, year)) return null
  return { year, month, day }
}

export function buildIsoDate(year: number, month: number, day: number): string | null {
  if (!isValidCalendarDate(day, month + 1, year)) return null
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const

export const WEEKDAYS_PT_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

export interface CalendarDayCell {
  day: number | null
  iso: string | null
}

/** grade do mês (month 0–11), com dias vazios no início da semana. */
export function buildCalendarMonthGrid(year: number, month: number): CalendarDayCell[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: CalendarDayCell[] = []

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: null, iso: null })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, iso: buildIsoDate(year, month, day) })
  }

  return cells
}

/** Aplica máscara DD/MM/YYYY enquanto o usuário digita. */
export function maskBrDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2100) return false
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** Converte DD/MM/YYYY para ISO (YYYY-MM-DD). Retorna null se inválido ou incompleto. */
export function brDateToIso(br: string): string | null {
  const digits = br.replace(/\D/g, '')
  if (digits.length !== 8) return null

  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4, 8))

  if (!isValidCalendarDate(day, month, year)) return null

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
