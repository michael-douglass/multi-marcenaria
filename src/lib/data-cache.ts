import { isIosDevice } from './device'
import { CACHE_FRESH_MS, isCacheFresh } from './refresh-policy'

interface CacheEntry<T> {
  value: T
  at: number
}

const memory = new Map<string, CacheEntry<unknown>>()
const STORAGE_PREFIX = 'garbo-data-cache:'
const MAX_PERSIST_BYTES = 1_500_000

export const OBRAS_CACHE_KEY = 'movelaria-obras'

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

function canUseStorage(): boolean {
  // No iPhone, gravar/ler JSON grande no sessionStorage na volta de um crash
  // piora o loop “Um problema ocorreu repetidamente”.
  if (typeof sessionStorage === 'undefined') return false
  if (isIosDevice()) return false
  return true
}

export function readCache<T>(key: string): CacheEntry<T> | null {
  const mem = memory.get(key) as CacheEntry<T> | undefined
  if (mem) return mem

  if (!canUseStorage()) return null

  try {
    const raw = sessionStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { value?: T; at?: number }
    if (!parsed || typeof parsed.at !== 'number' || parsed.value === undefined) {
      return null
    }
    const entry: CacheEntry<T> = { value: parsed.value, at: parsed.at }
    memory.set(key, entry)
    return entry
  } catch {
    return null
  }
}

export function writeCache<T>(key: string, value: T, at = Date.now()): void {
  const entry: CacheEntry<T> = { value, at }
  memory.set(key, entry)

  if (!canUseStorage()) return

  try {
    const payload = JSON.stringify(entry)
    if (payload.length > MAX_PERSIST_BYTES) return
    sessionStorage.setItem(storageKey(key), payload)
  } catch {
    // iPhone em modo privado ou storage cheio: o cache em memória ainda vale.
  }
}

export function invalidateCache(key: string): void {
  memory.delete(key)
  if (!canUseStorage()) return
  try {
    sessionStorage.removeItem(storageKey(key))
  } catch {
    // ignore
  }
}

export function isCacheKeyFresh(key: string, now = Date.now(), freshMs = CACHE_FRESH_MS): boolean {
  const entry = readCache(key)
  if (!entry) return false
  return isCacheFresh(entry.at, now, freshMs)
}
