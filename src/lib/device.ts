/** iPhone / iPad (inclui iPadOS que se passa por Mac). */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Celular ou iPhone: UI estreita ou Safari iOS. */
export function isMobileUi(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 768px)').matches || isIosDevice()
}

export function isGarboSafeMode(): boolean {
  return typeof document !== 'undefined'
    && document.documentElement.dataset.garboSafeMode === '1'
}

/**
 * No celular a conexão “ao vivo” do banco compete com o login
 * e faz a tela girar até aparecer “Failed to fetch”.
 * No telefone atualizamos a cada minuto; no computador continua ao vivo.
 */
export function canUseRealtime(): boolean {
  if (typeof window === 'undefined') return false
  if (isGarboSafeMode()) return false
  return !isMobileUi()
}
