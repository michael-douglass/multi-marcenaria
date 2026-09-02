/**
 * Janela do card do lead — estilo “quase tela cheia” com margem,
 * mais controles tipo Windows (minimizar / maximizar / restaurar).
 */

export interface LeadModalSize {
  x: number
  y: number
  w: number
  h: number
}

export type LeadModalWindowMode = 'maximized' | 'restored' | 'minimized'

export interface LeadModalLayout extends LeadModalSize {
  mode: LeadModalWindowMode
}

export type LeadResizeEdge = 'se' | 'sw' | 'ne' | 'nw' | 'e' | 's' | 'w' | 'n'

/** v4: maximizado por padrão + modo de janela. */
export const LEAD_MODAL_SIZE_STORAGE_KEY = 'lead-modal-size-v4'
export const LEAD_MODAL_MOBILE_BREAKPOINT = 768

export const LEAD_MODAL_MARGIN_DESKTOP = 16
export const LEAD_MODAL_MARGIN_MOBILE = 8

export const LEAD_MODAL_MIN_W_DESKTOP = 420
export const LEAD_MODAL_MIN_H_DESKTOP = 360
export const LEAD_MODAL_MIN_W_MOBILE = 280
export const LEAD_MODAL_MIN_H_MOBILE = 320

/** Altura da faixa quando minimizado (só o chrome). */
export const LEAD_MODAL_MINIMIZED_H = 52

export function isLeadModalMobileViewport(
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
): boolean {
  return vw < LEAD_MODAL_MOBILE_BREAKPOINT
}

export function leadModalOuterMargin(vw?: number): number {
  return isLeadModalMobileViewport(vw) ? LEAD_MODAL_MARGIN_MOBILE : LEAD_MODAL_MARGIN_DESKTOP
}

export function leadModalMins(vw?: number) {
  const mobile = isLeadModalMobileViewport(vw)
  return {
    minW: mobile ? LEAD_MODAL_MIN_W_MOBILE : LEAD_MODAL_MIN_W_DESKTOP,
    minH: mobile ? LEAD_MODAL_MIN_H_MOBILE : LEAD_MODAL_MIN_H_DESKTOP,
  }
}

function centerLeadModalSize(
  w: number,
  h: number,
  vw: number,
  vh: number,
  margin: number,
): LeadModalSize {
  return {
    x: Math.max(margin, Math.round((vw - w) / 2)),
    y: Math.max(margin, Math.round((vh - h) / 2)),
    w,
    h,
  }
}

/** Quase tela cheia: viewport menos a margem dos quatro lados. */
export function maximizedLeadModalSize(
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): LeadModalSize {
  const { minW, minH } = leadModalMins(vw)
  const margin = leadModalOuterMargin(vw)
  const w = Math.max(minW, vw - margin * 2)
  const h = Math.max(minH, vh - margin * 2)
  return clampLeadModalSize(centerLeadModalSize(w, h, vw, vh, margin), vw, vh)
}

/** Alias: padrão fixo = maximizado. */
export function defaultLeadModalSize(vw?: number, vh?: number): LeadModalSize {
  return maximizedLeadModalSize(vw, vh)
}

export function defaultLeadModalLayout(
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): LeadModalLayout {
  return { ...maximizedLeadModalSize(vw, vh), mode: 'maximized' }
}

/** Tamanho “restaurado” intermediário (quando sai do maximizado). */
export function restoredLeadModalSize(
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): LeadModalSize {
  const { minW, minH } = leadModalMins(vw)
  const margin = leadModalOuterMargin(vw)
  const w = Math.min(Math.max(minW, Math.round(vw * 0.72)), vw - margin * 2)
  const h = Math.min(Math.max(minH, Math.round(vh * 0.78)), vh - margin * 2)
  return clampLeadModalSize(centerLeadModalSize(w, h, vw, vh, margin), vw, vh)
}

export function clampLeadModalSize(
  size: LeadModalSize,
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): LeadModalSize {
  const { minW, minH } = leadModalMins(vw)
  const margin = leadModalOuterMargin(vw)
  const maxW = Math.max(minW, vw - margin * 2)
  const maxH = Math.max(minH, vh - margin * 2)
  const w = Math.min(Math.max(size.w, minW), maxW)
  const h = Math.min(Math.max(size.h, minH), maxH)
  const x = Math.min(Math.max(size.x, margin), Math.max(margin, vw - w - margin))
  const y = Math.min(Math.max(size.y, margin), Math.max(margin, vh - h - margin))
  return { x, y, w, h }
}

/** Resolve o retângulo visível conforme o modo da janela. */
export function resolveLeadModalDisplaySize(
  layout: LeadModalLayout,
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): LeadModalSize {
  if (layout.mode === 'maximized') {
    return maximizedLeadModalSize(vw, vh)
  }
  if (layout.mode === 'minimized') {
    const margin = leadModalOuterMargin(vw)
    const maxW = Math.max(280, vw - margin * 2)
    const w = Math.min(Math.max(layout.w, 280), maxW)
    const x = Math.min(Math.max(layout.x, margin), Math.max(margin, vw - w - margin))
    const y = Math.min(
      Math.max(layout.y, margin),
      Math.max(margin, vh - LEAD_MODAL_MINIMIZED_H - margin),
    )
    return { x, y, w, h: LEAD_MODAL_MINIMIZED_H }
  }
  return clampLeadModalSize(layout, vw, vh)
}

export function parseLeadModalLayout(raw: unknown): LeadModalLayout | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<LeadModalLayout>
  if (
    typeof parsed.x !== 'number' ||
    typeof parsed.y !== 'number' ||
    typeof parsed.w !== 'number' ||
    typeof parsed.h !== 'number'
  ) {
    return null
  }
  if (![parsed.x, parsed.y, parsed.w, parsed.h].every((n) => Number.isFinite(n))) {
    return null
  }
  const mode: LeadModalWindowMode =
    parsed.mode === 'restored' || parsed.mode === 'minimized' || parsed.mode === 'maximized'
      ? parsed.mode
      : 'maximized'

  const size = clampLeadModalSize({
    x: parsed.x,
    y: parsed.y,
    w: Math.round(parsed.w),
    h: Math.round(parsed.h),
  })

  // Se veio de versão antiga e está bem menor que a tela, força maximizado.
  if (typeof window !== 'undefined' && mode === 'restored') {
    const max = maximizedLeadModalSize()
    if (size.w < max.w * 0.85 || size.h < max.h * 0.85) {
      return { ...max, mode: 'maximized' }
    }
  }

  if (mode === 'maximized') {
    return { ...maximizedLeadModalSize(), mode: 'maximized' }
  }

  return { ...size, mode }
}

export function readInitialLeadModalLayout(): LeadModalLayout {
  if (typeof window === 'undefined') {
    return defaultLeadModalLayout(1440, 900)
  }
  try {
    const fromLocal = parseLeadModalLayout(
      JSON.parse(localStorage.getItem(LEAD_MODAL_SIZE_STORAGE_KEY) ?? 'null'),
    )
    if (fromLocal) return fromLocal
  } catch {
    /* fallthrough */
  }
  // Migra legado v3 pequeno → maximizado
  try {
    const legacy = JSON.parse(localStorage.getItem('lead-modal-size-v3') ?? 'null')
    if (legacy && typeof legacy === 'object') {
      const max = maximizedLeadModalSize()
      localStorage.removeItem('lead-modal-size-v3')
      return { ...max, mode: 'maximized' }
    }
  } catch {
    /* fallthrough */
  }
  return defaultLeadModalLayout()
}

export function applyLeadModalResize(
  start: LeadModalSize,
  edge: LeadResizeEdge,
  dx: number,
  dy: number,
  vw?: number,
  vh?: number,
): LeadModalSize {
  const { minW, minH } = leadModalMins(vw)
  let next: LeadModalSize = { ...start }

  if (edge.includes('e')) next.w = start.w + dx
  if (edge.includes('s')) next.h = start.h + dy
  if (edge.includes('w')) {
    next.w = start.w - dx
    next.x = start.x + dx
  }
  if (edge.includes('n')) {
    next.h = start.h - dy
    next.y = start.y + dy
  }

  if (next.w < minW) {
    if (edge.includes('w')) next.x = start.x + start.w - minW
    next.w = minW
  }
  if (next.h < minH) {
    if (edge.includes('n')) next.y = start.y + start.h - minH
    next.h = minH
  }

  return clampLeadModalSize(next, vw, vh)
}

export function leadModalSizeToCssVars(size: LeadModalSize): Record<string, string> {
  return {
    '--lead-card-x': `${Math.round(size.x)}px`,
    '--lead-card-y': `${Math.round(size.y)}px`,
    '--lead-card-w': `${Math.round(size.w)}px`,
    '--lead-card-h': `${Math.round(size.h)}px`,
  }
}
