/** Converte ISO (YYYY-MM-DD) para exibição brasileira (DD/MM/YYYY). */
export function isoToBrDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return ''
  return `${match[3]}/${match[2]}/${match[1]}`
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
