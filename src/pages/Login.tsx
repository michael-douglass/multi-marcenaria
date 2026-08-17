import { useState, useEffect, FormEvent } from 'react'
import {
  clearLocalAuthSession,
  getAuthRateLimitMessage,
  supabase,
} from '@/lib/supabase'
import { isAuthRateLimited } from '@/lib/supabase-auth-storage'
import { isNetworkFailure, NETWORK_FAILURE_USER_MESSAGE } from '@/lib/network-error'
import { AppRefreshButton } from '@/components/ui/AppRefreshButton'
import { GarboLoadingBrand } from '@/components/ui/GarboLoadingBrand'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [clearingSession, setClearingSession] = useState(false)

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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#2a1812',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        backgroundImage: [
          'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(240,210,140,.09) 0%, transparent 65%)',
          'radial-gradient(ellipse 55% 45% at 85% 90%, rgba(80,25,8,.5) 0%, transparent 65%)',
        ].join(', '),
        position: 'relative',
      }}
    >
      {loading ? <GarboLoadingBrand variant="overlay" message="Entrando..." /> : null}
      <AppRefreshButton variant="floating" />
      {/* Logo block — displayed prominently above the card */}
      <div
        style={{
          marginBottom: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '.75rem',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '18px 24px',
            boxShadow: '0 8px 40px rgba(0,0,0,.45), 0 0 0 1px rgba(240,210,140,.18)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/garbo-logo.png"
            alt="GARBO Movelaria"
            style={{ height: 120, width: 'auto', display: 'block' }}
            draggable={false}
          />
        </div>

        <p
          style={{
            color: 'rgba(240,210,140,.55)',
            fontSize: '.72rem',
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 600,
          }}
        >
          Sistema Financeiro
        </p>
      </div>

      {/* Login card */}
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'rgba(28,12,5,0.88)',
          backdropFilter: 'blur(28px)',
          border: '1px solid rgba(240,210,140,.2)',
          borderRadius: '14px',
          padding: '2.25rem 2rem',
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>

          {/* Email field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
            <label
              htmlFor="login-email"
              style={{
                color: '#e8c878',
                fontSize: '.72rem',
                fontWeight: 700,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                fontFamily: 'Raleway, sans-serif',
              }}
            >
              E-mail
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoFocus
              autoComplete="email"
            />
          </div>

          {/* Password field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
            <label
              htmlFor="login-password"
              style={{
                color: '#e8c878',
                fontSize: '.72rem',
                fontWeight: 700,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                fontFamily: 'Raleway, sans-serif',
              }}
            >
              Senha
            </label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {/* Error message */}
          {error && (
            <p
              style={{
                color: '#f87171',
                fontSize: '.8rem',
                textAlign: 'center',
                background: 'rgba(239,68,68,.07)',
                border: '1px solid rgba(239,68,68,.2)',
                borderRadius: '.6rem',
                padding: '.55rem .75rem',
                fontFamily: 'Raleway, sans-serif',
              }}
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || clearingSession}
            style={{
              marginTop: '.1rem',
              width: '100%',
              padding: '.75rem 1rem',
              background: loading ? 'rgba(240,210,140,.35)' : 'linear-gradient(135deg, #f2d892 0%, #a87830 100%)',
              color: '#2a1812',
              border: 'none',
              borderRadius: '8px',
              fontSize: '.88rem',
              fontWeight: 700,
              fontFamily: 'Raleway, sans-serif',
              letterSpacing: '.06em',
              cursor: loading || clearingSession ? 'not-allowed' : 'pointer',
              transition: 'opacity .15s',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={() => void handleClearSession()}
            disabled={loading || clearingSession}
            style={{
              marginTop: '.25rem',
              width: '100%',
              padding: '.45rem .75rem',
              background: 'transparent',
              color: 'rgba(240,210,140,.55)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '.72rem',
              fontFamily: 'Raleway, sans-serif',
              cursor: loading || clearingSession ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
            }}
          >
            {clearingSession ? 'Limpando sessão...' : 'Problemas para entrar? Limpar sessão antiga'}
          </button>
        </form>
      </div>
    </div>
  )
}
