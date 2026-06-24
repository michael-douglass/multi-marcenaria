import { createClient } from '@supabase/supabase-js'
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

// Se o login foi bloqueado (429), remove sessão antiga antes do cliente tentar renovar.
if (isAuthRateLimited()) {
  removeSupabaseAuthStorage(supabaseUrl)
}

let authRefreshBlocked = isAuthRateLimited()

const supabaseFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url

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

  const response = await fetch(input, init)

  if (response.status === 429 && isRefreshTokenRequest(url)) {
    authRefreshBlocked = true
    markAuthRateLimited()
    removeSupabaseAuthStorage(supabaseUrl)
    window.dispatchEvent(new CustomEvent('supabase:auth-rate-limited'))
  }

  return response
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: supabaseFetch },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
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
