/** Chave da última rota útil do app (para retomar após o PWA reabrir em `/`). */
export const LAST_ROUTE_KEY = 'movelaria-last-route'

const SKIP_PATHS = new Set(['/', '/login'])

export function rememberLastRoute(pathWithSearch: string): void {
  try {
    const path = pathWithSearch.split('?')[0] || '/'
    if (SKIP_PATHS.has(path)) return
    sessionStorage.setItem(LAST_ROUTE_KEY, pathWithSearch)
  } catch {
    // ignore
  }
}

export function readLastRoute(): string | null {
  try {
    const value = sessionStorage.getItem(LAST_ROUTE_KEY)
    if (!value || SKIP_PATHS.has(value.split('?')[0] || '/')) return null
    return value
  } catch {
    return null
  }
}
