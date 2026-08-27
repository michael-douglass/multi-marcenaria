/** Dados ainda valem: não busca de novo na rede (aba/iPhone piscando). */
export const CACHE_FRESH_MS = 20_000

/**
 * Página Visualização (TV / painel): cache bem maior.
 * Evita martelar o banco a cada minuto enquanto a tela fica aberta.
 */
export const VISUALIZACAO_CACHE_FRESH_MS = 5 * 60 * 1000

/** Configuração de painéis muda raramente. */
export const VISUALIZACAO_CONFIG_CACHE_FRESH_MS = 30 * 60 * 1000

/** Atualização em segundo plano da Visualização. */
export const VISUALIZACAO_POLL_MS = 5 * 60 * 1000

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
