/** Preferência do cabeçalho da Agenda (KPIs + título + ações): automático, sempre aberto ou sempre fechado. */

export type AgendaHeaderLockMode = 'auto' | 'open' | 'closed'

export interface AgendaHeaderPrefs {
  lockMode: AgendaHeaderLockMode
}

/** A cada quanto o cabeçalho aparece no modo automático. */
export const AGENDA_HEADER_AUTO_INTERVAL_MS = 5_000

/** Quanto tempo fica aberto no modo automático antes de recolher. */
export const AGENDA_HEADER_AUTO_VISIBLE_MS = 5_000

const STORAGE_PREFIX = 'movelaria:agenda:header-collapse'

function defaultPrefs(): AgendaHeaderPrefs {
  return { lockMode: 'auto' }
}

function storageKey(userId?: string | null): string {
  return userId ? `${STORAGE_PREFIX}:${userId}` : STORAGE_PREFIX
}

function parseLockMode(value: unknown): AgendaHeaderLockMode | null {
  if (value === 'auto' || value === 'open' || value === 'closed') return value
  return null
}

function parseStored(raw: string | null): AgendaHeaderPrefs | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return null
    const lockMode = parseLockMode((data as AgendaHeaderPrefs).lockMode)
    if (!lockMode) return null
    return { lockMode }
  } catch {
    return null
  }
}

export function readAgendaHeaderPrefs(userId?: string | null): AgendaHeaderPrefs {
  try {
    return parseStored(localStorage.getItem(storageKey(userId))) ?? defaultPrefs()
  } catch {
    return defaultPrefs()
  }
}

export function writeAgendaHeaderPrefs(
  userId: string | null | undefined,
  prefs: AgendaHeaderPrefs,
): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

export function writeAgendaHeaderLockMode(
  userId: string | null | undefined,
  lockMode: AgendaHeaderLockMode,
): void {
  writeAgendaHeaderPrefs(userId, { lockMode })
}
