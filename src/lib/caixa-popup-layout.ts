/**
 * Layout do popup flutuante "Caixa de Pagamentos".
 * Tamanho padrão ~3/4 da tela; tabela rola por dentro do container.
 */

export interface CaixaPopupLayout {
  x: number
  y: number
  w: number
  h: number
}

/** Mínimos usáveis; a tabela rola por dentro se precisar. */
export const CAIXA_POPUP_MIN_W = 420
export const CAIXA_POPUP_MIN_H = 320
export const CAIXA_POPUP_MOBILE_BREAKPOINT = 768

/** v3: tamanho intermediário (maior que metade, menor que tela cheia). */
export const CAIXA_POPUP_STORAGE_KEY = 'caixa-contas-pagar-popup-layout-v3'
export const CAIXA_POPUP_LEGACY_STORAGE_KEY = 'caixa-contas-pagar-popup-position'
export const CAIXA_POPUP_LEGACY_LAYOUT_KEY = 'caixa-contas-pagar-popup-layout-v2'

export function defaultCaixaPopupLayout(
  vw = typeof window !== 'undefined' ? window.innerWidth : 1440,
  vh = typeof window !== 'undefined' ? window.innerHeight : 900,
): CaixaPopupLayout {
  // ~3/4 da tela: confortável para filtros + tabela, sem cobrir tudo.
  const w = Math.min(980, Math.max(CAIXA_POPUP_MIN_W, Math.round(vw * 0.72)))
  const h = Math.min(720, Math.max(CAIXA_POPUP_MIN_H, Math.round(vh * 0.72)))
  return {
    x: Math.max(8, Math.round((vw - w) / 2)),
    y: Math.max(48, Math.round((vh - h) / 2)),
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

/** Lê layout salvo; se só tiver posição (legado), aplica o tamanho padrão novo. */
export function parseCaixaPopupLayout(
  raw: string | null,
  opts?: { forceDefaultSize?: boolean },
): CaixaPopupLayout | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CaixaPopupLayout>
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
    const base = defaultCaixaPopupLayout()
    const forceDefaultSize = opts?.forceDefaultSize === true
    return clampCaixaPopupLayout({
      x: parsed.x,
      y: parsed.y,
      w: forceDefaultSize || typeof parsed.w !== 'number' ? base.w : parsed.w,
      h: forceDefaultSize || typeof parsed.h !== 'number' ? base.h : parsed.h,
    })
  } catch {
    return null
  }
}

export function readInitialCaixaPopupLayout(): CaixaPopupLayout {
  if (typeof window === 'undefined') {
    return { x: 40, y: 56, w: 900, h: 620 }
  }
  return (
    parseCaixaPopupLayout(localStorage.getItem(CAIXA_POPUP_STORAGE_KEY))
    ?? parseCaixaPopupLayout(localStorage.getItem(CAIXA_POPUP_LEGACY_LAYOUT_KEY), {
      forceDefaultSize: true,
    })
    ?? parseCaixaPopupLayout(localStorage.getItem('caixa-contas-pagar-popup-layout'), {
      forceDefaultSize: true,
    })
    ?? parseCaixaPopupLayout(localStorage.getItem(CAIXA_POPUP_LEGACY_STORAGE_KEY), {
      forceDefaultSize: true,
    })
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

/**
 * Altura útil da área da tabela dentro do popup
 * (desconta header, filtros, cards, abas e padding aproximados).
 */
export function estimateCaixaTableViewportHeight(popupH: number, chrome = 230): number {
  return Math.max(120, popupH - chrome)
}

/**
 * A lista "cabe" no popup quando a área da tabela tem altura positiva
 * e o conteúdo pode rolar internamente (scrollHeight pode ser maior que a viewport).
 */
export function caixaTableScrollFitsPopup(opts: {
  popupH: number
  tablePanelClientH: number
  tablePanelScrollH: number
}): { ok: boolean; reason: string } {
  const { popupH, tablePanelClientH, tablePanelScrollH } = opts
  if (popupH < CAIXA_POPUP_MIN_H) {
    return { ok: false, reason: 'popup menor que o mínimo' }
  }
  if (tablePanelClientH <= 0) {
    return { ok: false, reason: 'painel da tabela sem altura' }
  }
  if (tablePanelClientH > popupH) {
    return { ok: false, reason: 'painel maior que o popup (estourou o container)' }
  }
  // Com muitos itens, scrollHeight >= clientHeight; com poucos, iguais — ambos ok.
  if (tablePanelScrollH < tablePanelClientH - 1) {
    return { ok: false, reason: 'scrollHeight inconsistente' }
  }
  return { ok: true, reason: 'painel contido no popup com rolagem interna' }
}
