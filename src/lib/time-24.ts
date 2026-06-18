/** Normaliza HH:mm (24h) para exibição. */
export function normalizeTime24(value: string | null | undefined): string {
  if (!value) return ''
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return ''
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return ''
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** Máscara HH:mm enquanto o usuário digita. */
export function maskTime24Input(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

export function isValidTime24(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return false
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

/** Converte texto digitado para HH:mm (24h). */
export function parseTime24Input(display: string): string | null {
  if (!display.trim()) return null
  const digits = display.replace(/\D/g, '')
  if (digits.length !== 4) return null
  const value = `${digits.slice(0, 2)}:${digits.slice(2)}`
  return isValidTime24(value) ? value : null
}
