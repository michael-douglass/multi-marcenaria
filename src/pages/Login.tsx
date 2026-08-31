import { useState, useEffect, useRef, FormEvent } from 'react'
import {
  clearLocalAuthSession,
  getAuthRateLimitMessage,
  supabase,
} from '@/lib/supabase'
import { isAuthRateLimited } from '@/lib/supabase-auth-storage'
import { isNetworkFailure, NETWORK_FAILURE_USER_MESSAGE } from '@/lib/network-error'
import { AppRefreshButton } from '@/components/ui/AppRefreshButton'
import { GarboLoadingBrand } from '@/components/ui/GarboLoadingBrand'
import { Input } from '@/components/ui/input'
import { LoginAtmosphereFoil } from '@/components/login/LoginAtmosphereFoil'
import { LoginLogoMark } from '@/components/login/LoginLogoMark'
import '@/components/login/login-atelier.css'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [clearingSession, setClearingSession] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isAuthRateLimited()) return
    void clearLocalAuthSession({ keepRateLimit: true }).then(() => {
      setError(
        `${getAuthRateLimitMessage()} A sessão antiga do navegador foi removida automaticamente.`,
      )
    })
  }, [])

  function authErrorMessage(message: string, status?: number): string {
    if (status === 429 || /rate limit|too many requests|429/i.test(message)) {
      return getAuthRateLimitMessage()
    }
    if (message === 'Invalid login credentials') {
      return 'E-mail ou senha incorretos.'
    }
    return message
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        if (isNetworkFailure(authError)) {
          setError(NETWORK_FAILURE_USER_MESSAGE)
        } else {
          setError(authErrorMessage(authError.message, authError.status))
        }
      }
    } catch (err) {
      setError(isNetworkFailure(err) ? NETWORK_FAILURE_USER_MESSAGE : 'Não foi possível entrar. Tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleClearSession() {
    setClearingSession(true)
    setError(null)
    try {
      await clearLocalAuthSession()
      window.location.reload()
    } catch {
      setError('Não foi possível limpar a sessão. Tente fechar o navegador e abrir de novo.')
      setClearingSession(false)
    }
  }

  const busy = loading || clearingSession

  return (
    <div className="login-atelier">
      {loading ? <GarboLoadingBrand variant="overlay" message="Entrando..." /> : null}
      <LoginAtmosphereFoil />
      <div className="login-atelier__grain" aria-hidden />
      <AppRefreshButton variant="floating" />

      <div className="login-atelier__stage">
        <div className="login-atelier__brand">
          <LoginLogoMark onActivate={() => emailRef.current?.focus()} />
          <p className="login-atelier__kicker">Sistema financeiro</p>
          <h1 className="login-atelier__title">A porta do ateliê</h1>
          <p className="login-atelier__lede">
            A placa reage ao movimento do mouse. Clique nela para começar pelo e-mail.
          </p>
        </div>

        <div className="login-atelier__card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="login-atelier__label">
                E-mail
              </label>
              <Input
                ref={emailRef}
                id="login-email"
                type="email"
                className="login-atelier__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoFocus
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="login-atelier__label">
                Senha
              </label>
              <Input
                id="login-password"
                type="password"
                className="login-atelier__input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-md border border-red-500/25 bg-red-500/[0.07] px-3 py-2 text-center font-[Raleway,sans-serif] text-[0.8rem] text-red-400"
              >
                {error}
              </p>
            ) : null}

            <button type="submit" className="login-atelier__enter" disabled={busy}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <button
              type="button"
              className="login-atelier__ghost"
              onClick={() => void handleClearSession()}
              disabled={busy}
            >
              {clearingSession ? 'Limpando sessão...' : 'Problemas para entrar? Limpar sessão antiga'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
