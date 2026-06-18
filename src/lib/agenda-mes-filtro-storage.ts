export type AgendaMesFiltro =
  | { mode: 'all' }
  | { mode: 'month'; mes: number; ano: number }

const STORAGE_PREFIX = 'movelaria:agenda:mes-filtro'

function defaultFiltro(): AgendaMesFiltro {
  return { mode: 'all' }
}

function storageKey(userId?: string | null): string {
  return userId ? `${STORAGE_PREFIX}:${userId}` : STORAGE_PREFIX
}

function parseStored(raw: string | null): AgendaMesFiltro | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as AgendaMesFiltro
    if (data.mode === 'all') return { mode: 'all' }
    if (
      data.mode === 'month'
      && Number.isInteger(data.mes)
      && data.mes >= 1
      && data.mes <= 12
      && Number.isInteger(data.ano)
      && data.ano >= 2000
      && data.ano <= 2100
    ) {
      return { mode: 'month', mes: data.mes, ano: data.ano }
    }
  } catch {
    /* ignore */
  }
  return null
}

export function readAgendaMesFiltro(userId?: string | null): AgendaMesFiltro {
  try {
    return parseStored(localStorage.getItem(storageKey(userId))) ?? defaultFiltro()
  } catch {
    return defaultFiltro()
  }
}

export function writeAgendaMesFiltro(userId: string | null | undefined, filtro: AgendaMesFiltro): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(filtro))
  } catch {
    /* ignore */
  }
}
