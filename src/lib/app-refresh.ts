export const APP_REFRESH_RETURN_KEY = 'movelaria-refresh-return'

/** Recarrega o app mantendo a rota atual (pathname, query e hash). */
export function refreshAppPreservingRoute(): void {
  const target = `${window.location.pathname}${window.location.search}${window.location.hash}`

  try {
    sessionStorage.setItem(APP_REFRESH_RETURN_KEY, target)
  } catch {
    // Sem storage: o reload ainda preserva a URL.
  }

  window.location.reload()
}
