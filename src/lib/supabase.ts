import { createClient } from '@supabase/supabase-js'
import { isIosDevice, isMobileUi } from './device'
import { isNetworkFailure } from './network-error'
import {
  clearAuthRateLimitFlag,
  isAuthRateLimited,
  isRefreshTokenRequest,
  markAuthRateLimited,
  removeSupabaseAuthStorage,
} from './supabase-auth-storage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env e no Netlify.',
  )
}

const REST_TIMEOUT_MS = 20_000
/** PDFs executivos grandes (dezenas de MB) precisam de mais que 2 min no upload. */
const STORAGE_TIMEOUT_MS = 600_000
/** Render/IA no servidor pode passar de 1 minuto. Cortar cedo aborta o cliente e dispara um 2º pedido. */
const FUNCTIONS_TIMEOUT_MS = 180_000

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key) {
      return map.has(key) ? map.get(key)! : null
    },
    key(index) {
      return [...map.keys()][index] ?? null
    },
    removeItem(key) {
      map.delete(key)
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
  }
}

/** Safari privado / PWA às vezes bloqueia localStorage e o login parece “Failed to fetch”. */
function getAuthStorage(): Storage {
  try {
    const probe = '__garbo_auth_probe'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return createMemoryStorage()
  }
}

/**
 * No iPhone o cadeado interno do login (Web Locks) pode nunca abrir.
 * Sem isso a logo gira para sempre.
 */
async function skipAuthLock<R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> {
  return fn()
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function isStorageRequest(url: string): boolean {
  return url.includes('/storage/v1/')
}

function isFunctionRequest(url: string): boolean {
  return url.includes('/functions/v1/')
}

function mergeAbortSignals(parent: AbortSignal | undefined, local: AbortController): () => void {
  if (!parent) return () => {}
  if (parent.aborted) {
    local.abort()
    return () => {}
  }
  const onAbort = () => local.abort()
  parent.addEventListener('abort', onAbort)
  return () => parent.removeEventListener('abort', onAbort)
}

// Se o login foi bloqueado (429), remove sessão antiga antes do cliente tentar renovar.
if (isAuthRateLimited()) {
  removeSupabaseAuthStorage(supabaseUrl)
}

let authRefreshBlocked = isAuthRateLimited()

const supabaseFetch: typeof fetch = async (input, init) => {
  const url = requestUrl(input)

  if (authRefreshBlocked && isRefreshTokenRequest(url)) {
    removeSupabaseAuthStorage(supabaseUrl)
    return new Response(
      JSON.stringify({
        error: 'rate_limit_exceeded',
        error_description: 'Auth rate limited locally',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const timeoutMs = isStorageRequest(url)
    ? STORAGE_TIMEOUT_MS
    : isFunctionRequest(url)
      ? FUNCTIONS_TIMEOUT_MS
      : REST_TIMEOUT_MS
  // Edge Functions com efeito colateral (gerar imagem) NÃO podem ser retried —
  // o servidor continua mesmo após o abort e a 2ª chamada cria outra imagem.
  const maxAttempts = isStorageRequest(url) || isFunctionRequest(url) ? 1 : 2
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const stopParent = mergeAbortSignals(init?.signal ?? undefined, controller)
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(input, { ...init, signal: controller.signal })

      if (response.status === 429 && isRefreshTokenRequest(url)) {
        authRefreshBlocked = true
        markAuthRateLimited()
        removeSupabaseAuthStorage(supabaseUrl)
        window.dispatchEvent(new CustomEvent('supabase:auth-rate-limited'))
      }

      return response
    } catch (err) {
      lastError = err
      const parentAborted = Boolean(init?.signal?.aborted)
      const canRetry = attempt < maxAttempts - 1 && !parentAborted && isNetworkFailure(err)
      if (!canRetry) throw err
      await new Promise(resolve => window.setTimeout(resolve, 400 * (attempt + 1)))
    } finally {
      window.clearTimeout(timer)
      stopParent()
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: supabaseFetch },
  auth: {
    storage: getAuthStorage(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    ...(isMobileUi() || isIosDevice() ? { lock: skipAuthLock } : {}),
  },
})

/** Remove sessão salva no navegador sem chamar o servidor (útil após erro 429). */
export async function clearLocalAuthSession(options?: { keepRateLimit?: boolean }): Promise<void> {
  authRefreshBlocked = Boolean(options?.keepRateLimit && isAuthRateLimited())
  if (!options?.keepRateLimit) {
    clearAuthRateLimitFlag()
    authRefreshBlocked = false
  }
  removeSupabaseAuthStorage(supabaseUrl)
  await supabase.auth.signOut({ scope: 'local' })
}

export function getAuthRateLimitMessage(): string {
  return 'Muitas tentativas de login em pouco tempo. Aguarde cerca de 15 minutos, feche outras abas do sistema e tente novamente.'
}
