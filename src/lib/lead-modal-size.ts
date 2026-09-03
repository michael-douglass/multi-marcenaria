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

/** Respiro extra no topo do celular (abaixo do notch / status bar). */
export const LEAD_MODAL_MOBILE_TOP_EXTRA = 4

export const LEAD_MODAL_MIN_W_DESKTOP = 420
export const LEAD_MODAL_MIN_H_DESKTOP = 360
export const LEAD_MODAL_MIN_W_MOBILE = 280
export const LEAD_MODAL_MIN_H_MOBILE = 320

/** Altura da faixa quando minimizado (só o chrome). */
export const LEAD_MODAL_MINIMIZED_H = 52

function readCssSafeAreaInset(side: 'top' | 'right' | 'bottom' | 'left'): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0
  try {
    const probe = document.createElement('div')
    probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;padding-${side}:env(safe-area-inset-${side},0px);`
    document.body.appendChild(probe)
    const value = Number.parseFloat(getComputedStyle(probe).getPropertyValue(`padding-${side}`)) || 0
    document.body.removeChild(probe)
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

export function isLeadModalMobileViewport(
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
): boolean {
  return vw < LEAD_MODAL_MOBILE_BREAKPOINT
}

export function leadModalOuterMargin(vw?: number): number {
  return isLeadModalMobileViewport(vw) ? LEAD_MODAL_MARGIN_MOBILE : LEAD_MODAL_MARGIN_DESKTOP
}

/** Margens assimétricas: no celular o topo respeita o notch para o X ficar alcançável. */
export function leadModalInsets(vw?: number): {
  top: number
  right: number
  bottom: number
  left: number
} {
  const base = leadModalOuterMargin(vw)
  if (!isLeadModalMobileViewport(vw)) {
    return { top: base, right: base, bottom: base, left: base }
  }
  const safeTop = readCssSafeAreaInset('top')
  const safeRight = readCssSafeAreaInset('right')
  const safeBottom = readCssSafeAreaInset('bottom')
  const safeLeft = readCssSafeAreaInset('left')
  return {
    top: Math.max(base, Math.ceil(safeTop) + LEAD_MODAL_MOBILE_TOP_EXTRA),
    right: Math.max(base, Math.ceil(safeRight)),
    bottom: Math.max(base, Math.ceil(safeBottom)),
    left: Math.max(base, Math.ceil(safeLeft)),
  }
}

export function leadModalMins(vw?: number) {
  const mobile = isLeadModalMobileViewport(vw)
  return {
    minW: mobile ? LEAD_MODAL_MIN_W_MOBILE : LEAD_MODAL_MIN_W_DESKTOP,
    minH: mobile ? LEAD_MODAL_MIN_H_MOBILE : LEAD_MODAL_MIN_H_DESKTOP,
  }
}

function placeLeadModalSize(
  w: number,
  h: number,
  vw: number,
  vh: number,
  insets: { top: number; right: number; bottom: number; left: number },
): LeadModalSize {
  const usableW = Math.max(0, vw - insets.left - insets.right)
  const usableH = Math.max(0, vh - insets.top - insets.bottom)
  return {
    x: Math.max(insets.left, Math.round(insets.left + (usableW - w) / 2)),
    y: Math.max(insets.top, Math.round(insets.top + (usableH - h) / 2)),
    w,
    h,
  }
}

/** Quase tela cheia: viewport menos a margem dos quatro lados (topo com safe-area no celular). */
export function maximizedLeadModalSize(
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): LeadModalSize {
  const { minW, minH } = leadModalMins(vw)
  const insets = leadModalInsets(vw)
  const w = Math.max(minW, vw - insets.left - insets.right)
  const h = Math.max(minH, vh - insets.top - insets.bottom)
  return clampLeadModalSize(placeLeadModalSize(w, h, vw, vh, insets), vw, vh)
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
  const insets = leadModalInsets(vw)
  const maxW = Math.max(minW, vw - insets.left - insets.right)
  const maxH = Math.max(minH, vh - insets.top - insets.bottom)
  const w = Math.min(Math.max(minW, Math.round(vw * 0.72)), maxW)
  const h = Math.min(Math.max(minH, Math.round(vh * 0.78)), maxH)
  return clampLeadModalSize(placeLeadModalSize(w, h, vw, vh, insets), vw, vh)
}

export function clampLeadModalSize(
  size: LeadModalSize,
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): LeadModalSize {
  const { minW, minH } = leadModalMins(vw)
  const insets = leadModalInsets(vw)
  const maxW = Math.max(minW, vw - insets.left - insets.right)
  const maxH = Math.max(minH, vh - insets.top - insets.bottom)
  const w = Math.min(Math.max(size.w, minW), maxW)
  const h = Math.min(Math.max(size.h, minH), maxH)
  const x = Math.min(Math.max(size.x, insets.left), Math.max(insets.left, vw - w - insets.right))
  const y = Math.min(Math.max(size.y, insets.top), Math.max(insets.top, vh - h - insets.bottom))
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
    const insets = leadModalInsets(vw)
    const maxW = Math.max(280, vw - insets.left - insets.right)
    const w = Math.min(Math.max(layout.w, 280), maxW)
    const x = Math.min(Math.max(layout.x, insets.left), Math.max(insets.left, vw - w - insets.right))
    const y = Math.min(
      Math.max(layout.y, insets.top),
      Math.max(insets.top, vh - LEAD_MODAL_MINIMIZED_H - insets.bottom),
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
