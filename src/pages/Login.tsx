import { useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { AppRefreshButton } from '@/components/ui/AppRefreshButton'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message
      )
    }
    setLoading(false)
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
      }}
    >
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
            disabled={loading}
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
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity .15s',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
