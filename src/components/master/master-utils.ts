import type { SituacaoMensalidade, StatusEmpresa } from '@/hooks/useMaster'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const brl = (v: number | null | undefined) => BRL.format(Number(v ?? 0))

/** yyyy-mm-dd no fuso local. */
export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function inicioDoMes(d = new Date()): string {
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function fimDoMes(d = new Date()): string {
  return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

export function competenciaBR(iso: string): string {
  const [y, m] = iso.slice(0, 10).split('-')
  return `${m}/${y}`
}

/** Slug a partir do nome (minúsculas, números e _). */
export function slugify(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

export const STATUS_EMPRESA_LABEL: Record<StatusEmpresa, string> = {
  ativa: 'Ativa',
  bloqueada: 'Bloqueada',
  inativa: 'Inativa',
}

export const STATUS_EMPRESA_CLASS: Record<StatusEmpresa, string> = {
  ativa: 'border-emerald-600/30 bg-emerald-50 text-emerald-800',
  bloqueada: 'border-red-600/30 bg-red-50 text-red-800',
  inativa: 'border-stone-400/40 bg-stone-100 text-stone-700',
}

export const SITUACAO_LABEL: Record<SituacaoMensalidade, string> = {
  em_dia: 'Em dia',
  vencida: 'Vencida',
  bloqueada: 'Bloqueada',
  sem_assinatura: 'Sem assinatura',
}

export const SITUACAO_CLASS: Record<SituacaoMensalidade, string> = {
  em_dia: 'border-emerald-600/30 bg-emerald-50 text-emerald-800',
  vencida: 'border-amber-600/30 bg-amber-50 text-amber-800',
  bloqueada: 'border-red-600/30 bg-red-50 text-red-800',
  sem_assinatura: 'border-stone-400/40 bg-stone-100 text-stone-700',
}

export const STATUS_COBRANCA_LABEL = {
  pendente: 'Pendente',
  paga: 'Paga',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
} as const

export const STATUS_COBRANCA_CLASS = {
  pendente: 'border-sky-600/30 bg-sky-50 text-sky-800',
  paga: 'border-emerald-600/30 bg-emerald-50 text-emerald-800',
  vencida: 'border-red-600/30 bg-red-50 text-red-800',
  cancelada: 'border-stone-400/40 bg-stone-100 text-stone-600',
} as const

export function erroMsg(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}
