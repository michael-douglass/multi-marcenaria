export type AgendaMesFiltro =
  | { mode: 'all' }
  | { mode: 'month'; mes: number; ano: number }

export interface AgendaMesFiltroPrefs {
  filtro: AgendaMesFiltro
  minimized: boolean
}

const STORAGE_PREFIX = 'movelaria:agenda:mes-filtro'

function defaultFiltro(): AgendaMesFiltro {
  return { mode: 'all' }
}

function defaultPrefs(): AgendaMesFiltroPrefs {
  return { filtro: defaultFiltro(), minimized: true }
}

function storageKey(userId?: string | null): string {
  return userId ? `${STORAGE_PREFIX}:${userId}` : STORAGE_PREFIX
}

function parseFiltro(data: unknown): AgendaMesFiltro | null {
  if (!data || typeof data !== 'object') return null
  const record = data as AgendaMesFiltro
  if (record.mode === 'all') return { mode: 'all' }
  if (
    record.mode === 'month'
    && Number.isInteger(record.mes)
    && record.mes >= 1
    && record.mes <= 12
    && Number.isInteger(record.ano)
    && record.ano >= 2000
    && record.ano <= 2100
  ) {
    return { mode: 'month', mes: record.mes, ano: record.ano }
  }
  return null
}

function parseStored(raw: string | null): AgendaMesFiltroPrefs | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as unknown

    if (data && typeof data === 'object' && 'filtro' in data) {
      const filtro = parseFiltro((data as AgendaMesFiltroPrefs).filtro)
      if (!filtro) return null
      return {
        filtro,
        minimized: Boolean((data as AgendaMesFiltroPrefs).minimized),
      }
    }

    const legacy = parseFiltro(data)
    if (legacy) return { filtro: legacy, minimized: true }
  } catch {
    /* ignore */
  }
  return null
}

export function readAgendaMesFiltroPrefs(userId?: string | null): AgendaMesFiltroPrefs {
  try {
    return parseStored(localStorage.getItem(storageKey(userId))) ?? defaultPrefs()
  } catch {
    return defaultPrefs()
  }
}

export function readAgendaMesFiltro(userId?: string | null): AgendaMesFiltro {
  return readAgendaMesFiltroPrefs(userId).filtro
}

export function writeAgendaMesFiltroPrefs(
  userId: string | null | undefined,
  prefs: AgendaMesFiltroPrefs,
): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

export function writeAgendaMesFiltro(
  userId: string | null | undefined,
  filtro: AgendaMesFiltro,
  minimized?: boolean,
): void {
  const current = readAgendaMesFiltroPrefs(userId)
  writeAgendaMesFiltroPrefs(userId, {
    filtro,
    minimized: minimized ?? current.minimized,
  })
}

export function writeAgendaMesFiltroMinimized(
  userId: string | null | undefined,
  minimized: boolean,
): void {
  const current = readAgendaMesFiltroPrefs(userId)
  writeAgendaMesFiltroPrefs(userId, { ...current, minimized })
}
