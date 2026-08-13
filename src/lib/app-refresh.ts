import { isMobileUi } from './device'

export const APP_REFRESH_RETURN_KEY = 'movelaria-refresh-return'
export const SOFT_REFRESH_EVENT = 'garbo:soft-refresh'

const HARD_RELOAD_GUARD_KEY = 'garbo-hard-reload-at'
/** No computador, evita dois reloads seguidos (Safari interpreta como crash). */
const HARD_RELOAD_MIN_MS = 12_000

/** Avisa o app para buscar dados de novo, sem desligar a página. */
export function requestSoftRefresh(): void {
  window.dispatchEvent(new Event(SOFT_REFRESH_EVENT))
}

export function subscribeSoftRefresh(handler: () => void): () => void {
  window.addEventListener(SOFT_REFRESH_EVENT, handler)
  return () => window.removeEventListener(SOFT_REFRESH_EVENT, handler)
}

/**
 * Atualiza o sistema.
 * No iPhone NUNCA usa location.reload — o Safari cai na tela
 * “Um problema ocorreu repetidamente” depois de alguns reloads.
 */
export function refreshAppPreservingRoute(): void {
  if (isMobileUi()) {
    requestSoftRefresh()
    return
  }

  const now = Date.now()
  try {
    const last = Number(sessionStorage.getItem(HARD_RELOAD_GUARD_KEY) || '0')
    if (Number.isFinite(last) && now - last < HARD_RELOAD_MIN_MS) {
      requestSoftRefresh()
      return
    }
    sessionStorage.setItem(HARD_RELOAD_GUARD_KEY, String(now))
    const target = `${window.location.pathname}${window.location.search}${window.location.hash}`
    sessionStorage.setItem(APP_REFRESH_RETURN_KEY, target)
  } catch {
    // Sem storage: ainda tentamos o reload no desktop.
  }

  window.location.reload()
}
