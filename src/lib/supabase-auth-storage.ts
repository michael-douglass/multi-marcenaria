const AUTH_RATE_LIMIT_UNTIL_KEY = 'movelaria-auth-rate-limited-until'
const AUTH_RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000

export function getSupabaseAuthStorageKey(supabaseUrl: string): string {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

export function removeSupabaseAuthStorage(supabaseUrl: string): void {
  try {
    const primaryKey = getSupabaseAuthStorageKey(supabaseUrl)
    localStorage.removeItem(primaryKey)

    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('sb-') && key.includes('auth')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch {
    // Sem storage (modo privado restrito, etc.)
  }
}

export function isAuthRateLimited(): boolean {
  try {
    const until = sessionStorage.getItem(AUTH_RATE_LIMIT_UNTIL_KEY)
    if (!until) return false
    return Date.now() < Number(until)
  } catch {
    return false
  }
}

export function markAuthRateLimited(): void {
  try {
    sessionStorage.setItem(
      AUTH_RATE_LIMIT_UNTIL_KEY,
      String(Date.now() + AUTH_RATE_LIMIT_COOLDOWN_MS),
    )
  } catch {
    // ignore
  }
}

export function clearAuthRateLimitFlag(): void {
  try {
    sessionStorage.removeItem(AUTH_RATE_LIMIT_UNTIL_KEY)
  } catch {
    // ignore
  }
}

export function isRefreshTokenRequest(url: string): boolean {
  return url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token')
}
