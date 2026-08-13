/** Dados ainda valem: não busca de novo na rede (aba/iPhone piscando). */
export const CACHE_FRESH_MS = 20_000

/**
 * No iPhone, voltar da notificação / Central de Controle dispara
 * `visibilitychange` várias vezes. Só recarrega se já passou deste tempo.
 */
export const VISIBILITY_RELOAD_MIN_MS = 45_000

/** Junta vários avisos “aba visível” num único. */
export const VISIBILITY_DEBOUNCE_MS = 350

export interface VisibleReloadInput {
  now: number
  lastReloadAt: number
  visibilityState: string
  minIntervalMs?: number
}

export function isCacheFresh(
  savedAt: number,
  now = Date.now(),
  freshMs = CACHE_FRESH_MS,
): boolean {
  return now - savedAt < freshMs
}

/**
 * Decide se deve buscar de novo ao voltar para a aba.
 * Atualização ao vivo (realtime) não passa por aqui — ela força o reload.
 */
export function shouldReloadOnVisible(input: VisibleReloadInput): boolean {
  if (input.visibilityState !== 'visible') return false
  const minIntervalMs = input.minIntervalMs ?? VISIBILITY_RELOAD_MIN_MS
  return input.now - input.lastReloadAt >= minIntervalMs
}
