import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

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
