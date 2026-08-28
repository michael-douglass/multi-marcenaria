import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'
import { ptBR } from 'date-fns/locale'

const TIMEZONE = 'America/Sao_Paulo'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const fmtCur = (v?: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

export const fmtDate = (s?: string | null): string => {
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export const fmtTime = (s?: string | null): string => {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export const todayISO = (): string => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export const addDays = (s: string, days: number): string => {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Soma meses mantendo o dia (ex.: 26/05 → +1 mês → 26/06) */
export const addMonths = (s: string, months: number): string => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setMonth(dt.getMonth() + months)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export const endOfMonth = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export const isOverdue = (dateStr?: string | null): boolean =>
  !!dateStr && dateStr < todayISO()

/** Converte texto em número (aceita 6888,77 e 6.888,77) */
export function parseMoneyBr(value: string): number {
  const raw = value.trim().replace(/\s/g, '')
  if (!raw) return 0
  if (raw.includes(',') && raw.includes('.')) {
    return Number.parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  }
  if (raw.includes(',')) {
    return Number.parseFloat(raw.replace(',', '.'))
  }
  return Number.parseFloat(raw)
}

/** Gera UUID sem depender de crypto.randomUUID (nem sempre disponível) */
export function createId(): string {
  try {
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      const bytes = new Uint8Array(16)
      globalThis.crypto.getRandomValues(bytes)
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
  } catch {
    /* usa fallback abaixo */
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}

/** Remove traços, espaços e qualquer caractere que não seja dígito. */
export function formatInternationalPhone(value: string): string {
  return value.replace(/\D/g, '')
}

export function displayPhone(phone: string): string {
  if (!phone) return ''
  const numbers = phone.replace(/\D/g, '')
  if (numbers.length >= 11) {
    const ddi = numbers.slice(0, 2)
    const ddd = numbers.slice(2, 4)
    const parte1 = numbers.slice(4, 9)
    const parte2 = numbers.slice(9)
    return `+${ddi} (${ddd}) ${parte1}-${parte2}`
  }
  return phone
}

export function formatPhoneNumber(numero: string): string {
  const clean = numero.replace(/\D/g, '')
  if (clean.length === 13) {
    return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 9)}-${clean.slice(9)}`
  }
  if (clean.length === 12) {
    return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 8)}-${clean.slice(8)}`
  }
  return numero
}

export function formatYMDToBR(dateYMD: string): string {
  const [y, m, d] = (dateYMD || '').split('-')
  if (!y || !m || !d) return dateYMD || ''
  return `${d}/${m}/${y}`
}

export function formatYMDToBRShort(dateYMD: string): string {
  const [y, m, d] = (dateYMD || '').split('-')
  if (!y || !m || !d) return dateYMD || ''
  return `${d}/${m}/${String(y).slice(2)}`
}

export function formatDataBrMask(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function parseBRToYMD(br: string): string {
  const m = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return ''
  const [, d, mon, y] = m
  const day = Number(d)
  const month = Number(mon)
  const year = Number(y)
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return ''
  }
  return `${y}-${mon}-${d}`
}

export function valorDataParaExibicaoBR(value: string): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatYMDToBR(value)
  return formatDataBrMask(value)
}

export function getTodaySaoPaulo(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd')
}

export function toSaoPauloTime(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return toZonedTime(dateObj, TIMEZONE)
}

export function formatDateSaoPaulo(date: Date | string, formatStr: string): string {
  return formatInTimeZone(date, TIMEZONE, formatStr, { locale: ptBR })
}

export function getDefaultMonthRange(): { from: Date; to: Date } {
  const today = toSaoPauloTime(new Date())
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  return {
    from: toSaoPauloTime(firstDayOfMonth),
    to: today,
  }
}

/** Distribui ângulos em círculo para o menu radial */
export function distributeAngles(
  count: number,
  startDeg = 90,
  clockwise = true,
): number[] {
  if (count === 0) return []
  const step = 360 / count
  const dir = clockwise ? -1 : 1
  return Array.from({ length: count }, (_, i) => startDeg + dir * i * step)
}
