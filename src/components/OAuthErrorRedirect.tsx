import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function OAuthErrorRedirect({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const search = location.search
    if (!search) return
    const params = new URLSearchParams(search)
    const error = params.get('error')
    const errorCode = params.get('error_code')
    if (!error && !errorCode) return
    if (location.pathname === '/cadastro-de-alunos') return
    navigate(`/cadastro-de-alunos${search}`, { replace: true })
  }, [location.pathname, location.search, navigate])

  return <>{children}</>
}
