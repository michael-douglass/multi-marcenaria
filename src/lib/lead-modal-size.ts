/**
 * Tamanho e posição do card do lead.
 * Cada usuário guarda a dimensão escolhida; ao reabrir, o card volta no mesmo tamanho.
 *
 * Padrão desktop (referência de atelier): ~1147×718 — o tamanho confortável
 * visto em tela cheia de trabalho; centralizado na viewport.
 */

export interface LeadModalSize {
  x: number
  y: number
  w: number
  h: number
}

export type LeadResizeEdge = 'se' | 'sw' | 'ne' | 'nw' | 'e' | 's' | 'w' | 'n'

/** v2: novo padrão fixo (~1147×718) centralizado. */
export const LEAD_MODAL_SIZE_STORAGE_KEY = 'lead-modal-size-v2'
export const LEAD_MODAL_MOBILE_BREAKPOINT = 768

/** Dimensão fixa de referência no desktop (o “tamanho atual” do card). */
export const LEAD_MODAL_PREFERRED_W = 1147
export const LEAD_MODAL_PREFERRED_H = 718

/** Desktop: card usável sem ficar minúsculo. */
export const LEAD_MODAL_MIN_W_DESKTOP = 420
export const LEAD_MODAL_MIN_H_DESKTOP = 360

/** Celular: alvos de toque e conteúdo mínimo. */
export const LEAD_MODAL_MIN_W_MOBILE = 280
export const LEAD_MODAL_MIN_H_MOBILE = 320

export function isLeadModalMobileViewport(
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
): boolean {
  return vw < LEAD_MODAL_MOBILE_BREAKPOINT
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

export function defaultLeadModalSize(
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): LeadModalSize {
  const mobile = isLeadModalMobileViewport(vw)
  const { minW, minH } = leadModalMins(vw)
  const margin = mobile ? 8 : 16

  if (mobile) {
    const w = Math.max(minW, vw - margin * 2)
    const h = Math.max(minH, Math.round(Math.min(vh * 0.9, vh - margin * 2)))
    return centerLeadModalSize(w, h, vw, vh, margin)
  }

  // Desktop: tamanho fixo de referência, encolhe só se a tela for menor.
  const w = Math.min(LEAD_MODAL_PREFERRED_W, Math.max(minW, vw - margin * 2))
  const h = Math.min(LEAD_MODAL_PREFERRED_H, Math.max(minH, vh - margin * 2))
  return clampLeadModalSize(centerLeadModalSize(w, h, vw, vh, margin), vw, vh)
}

export function clampLeadModalSize(
  size: LeadModalSize,
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): LeadModalSize {
  const { minW, minH } = leadModalMins(vw)
  const margin = isLeadModalMobileViewport(vw) ? 8 : 16
  const maxW = Math.max(minW, vw - margin * 2)
  const maxH = Math.max(minH, vh - margin * 2)
  const w = Math.min(Math.max(size.w, minW), maxW)
  const h = Math.min(Math.max(size.h, minH), maxH)
  const x = Math.min(Math.max(size.x, margin), Math.max(margin, vw - w - margin))
  const y = Math.min(Math.max(size.y, margin), Math.max(margin, vh - h - margin))
  return { x, y, w, h }
}

/** Re-centra mantendo largura/altura (após restaurar padrão ou abrir). */
export function centerLeadModalKeepSize(
  size: Pick<LeadModalSize, 'w' | 'h'>,
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): LeadModalSize {
  const margin = isLeadModalMobileViewport(vw) ? 8 : 16
  return clampLeadModalSize(
    centerLeadModalSize(size.w, size.h, vw, vh, margin),
    vw,
    vh,
  )
}

export function parseLeadModalSize(raw: unknown): LeadModalSize | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<LeadModalSize>
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
  return clampLeadModalSize({
    x: parsed.x,
    y: parsed.y,
    w: Math.round(parsed.w),
    h: Math.round(parsed.h),
  })
}

export function readInitialLeadModalSize(): LeadModalSize {
  if (typeof window === 'undefined') {
    return {
      x: 40,
      y: 40,
      w: LEAD_MODAL_PREFERRED_W,
      h: LEAD_MODAL_PREFERRED_H,
    }
  }
  try {
    const fromLocal = parseLeadModalSize(
      JSON.parse(localStorage.getItem(LEAD_MODAL_SIZE_STORAGE_KEY) ?? 'null'),
    )
    if (fromLocal) return fromLocal
  } catch {
    /* fallthrough */
  }
  return clampLeadModalSize(defaultLeadModalSize())
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

/** Estilo CSS aplicado no DialogContent via variáveis. */
export function leadModalSizeToCssVars(size: LeadModalSize): Record<string, string> {
  return {
    '--lead-card-x': `${Math.round(size.x)}px`,
    '--lead-card-y': `${Math.round(size.y)}px`,
    '--lead-card-w': `${Math.round(size.w)}px`,
    '--lead-card-h': `${Math.round(size.h)}px`,
  }
}
