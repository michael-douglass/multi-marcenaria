/**
 * Layout do popup flutuante "Caixa de Pagamentos".
 * Mantém posição + tamanho dentro da tela, com mínimos para a tabela caber.
 */

export interface CaixaPopupLayout {
  x: number
  y: number
  w: number
  h: number
}

/** Largura mínima: tabela do caixa tem min-w ~1000px + padding. */
export const CAIXA_POPUP_MIN_W = 720
export const CAIXA_POPUP_MIN_H = 420
export const CAIXA_POPUP_MOBILE_BREAKPOINT = 768

export const CAIXA_POPUP_STORAGE_KEY = 'caixa-contas-pagar-popup-layout'
export const CAIXA_POPUP_LEGACY_STORAGE_KEY = 'caixa-contas-pagar-popup-position'

export function defaultCaixaPopupLayout(
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): CaixaPopupLayout {
  // Quase tela cheia: a tabela e os filtros precisam de espaço horizontal e vertical.
  const w = Math.min(1360, Math.max(CAIXA_POPUP_MIN_W, Math.round(vw * 0.97)))
  const h = Math.min(960, Math.max(CAIXA_POPUP_MIN_H, Math.round(vh * 0.92)))
  return {
    x: Math.max(8, Math.round((vw - w) / 2)),
    y: Math.max(40, Math.round((vh - h) / 2)),
    w,
    h,
  }
}

export function clampCaixaPopupLayout(
  layout: CaixaPopupLayout,
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): CaixaPopupLayout {
  const maxW = Math.max(CAIXA_POPUP_MIN_W, vw - 16)
  const maxH = Math.max(CAIXA_POPUP_MIN_H, vh - 16)
  const w = Math.min(Math.max(layout.w, CAIXA_POPUP_MIN_W), maxW)
  const h = Math.min(Math.max(layout.h, CAIXA_POPUP_MIN_H), maxH)
  const x = Math.min(Math.max(layout.x, 0), Math.max(0, vw - w))
  const y = Math.min(Math.max(layout.y, 0), Math.max(0, vh - h))
  return { x, y, w, h }
}

export function parseCaixaPopupLayout(raw: string | null): CaixaPopupLayout | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CaixaPopupLayout>
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
    const base = defaultCaixaPopupLayout()
    return clampCaixaPopupLayout({
      x: parsed.x,
      y: parsed.y,
      w: typeof parsed.w === 'number' ? parsed.w : base.w,
      h: typeof parsed.h === 'number' ? parsed.h : base.h,
    })
  } catch {
    return null
  }
}

export function readInitialCaixaPopupLayout(): CaixaPopupLayout {
  if (typeof window === 'undefined') {
    return { x: 40, y: 56, w: 1200, h: 820 }
  }
  return (
    parseCaixaPopupLayout(localStorage.getItem(CAIXA_POPUP_STORAGE_KEY))
    ?? parseCaixaPopupLayout(localStorage.getItem(CAIXA_POPUP_LEGACY_STORAGE_KEY))
    ?? clampCaixaPopupLayout(defaultCaixaPopupLayout())
  )
}

export type CaixaResizeCorner = 'se' | 'sw' | 'ne' | 'nw' | 'e' | 's' | 'w' | 'n'

/** Calcula o próximo layout durante um arraste de redimensionamento. */
export function applyCaixaResize(
  start: CaixaPopupLayout,
  corner: CaixaResizeCorner,
  dx: number,
  dy: number,
  vw?: number,
  vh?: number,
): CaixaPopupLayout {
  let next: CaixaPopupLayout = { ...start }

  if (corner.includes('e')) next.w = start.w + dx
  if (corner.includes('s')) next.h = start.h + dy
  if (corner.includes('w')) {
    next.w = start.w - dx
    next.x = start.x + dx
  }
  if (corner.includes('n')) {
    next.h = start.h - dy
    next.y = start.y + dy
  }

  if (next.w < CAIXA_POPUP_MIN_W) {
    if (corner.includes('w')) next.x = start.x + start.w - CAIXA_POPUP_MIN_W
    next.w = CAIXA_POPUP_MIN_W
  }
  if (next.h < CAIXA_POPUP_MIN_H) {
    if (corner.includes('n')) next.y = start.y + start.h - CAIXA_POPUP_MIN_H
    next.h = CAIXA_POPUP_MIN_H
  }

  return clampCaixaPopupLayout(next, vw, vh)
}
