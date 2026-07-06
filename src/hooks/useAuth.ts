import { useState, useEffect, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserProfile, UserRole } from '../types'

export interface AuthState {
  session: Session | null
  user: User | null
  userProfile: UserProfile | null
  role: UserRole | null
  roles: UserRole[]
  loading: boolean
  profileLoading: boolean
  profileError: string | null
  signOut: () => Promise<void>
  retryProfile: () => void
}

const PERFIL_TO_ROLE: Record<UserProfile['perfil'], UserRole> = {
  administrador: 'Administrador',
  financeiro: 'Financeiro',
  marceneiro: 'Marceneiro',
  montador: 'Montador',
  montador_admin: 'MontadorAdmin',
  administrador_obras: 'AdministradorObras',
  visualizador: 'Visualizador',
}

function perfilToRole(perfil: UserProfile['perfil']): UserRole {
  return PERFIL_TO_ROLE[perfil]
}

function computeRoles(profile: UserProfile): UserRole[] {
  const primary = PERFIL_TO_ROLE[profile.perfil]
  const extras = (profile.perfis_extras ?? [])
    .map(p => PERFIL_TO_ROLE[p as UserProfile['perfil']])
    .filter(Boolean)
  const seen = new Set<UserRole>()
  const result: UserRole[] = []
  for (const r of [primary, ...extras]) {
    if (r && !seen.has(r)) { seen.add(r); result.push(r) }
  }
  return result
}

function mapRpcProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    email: String(row.email),
    nome: row.nome ? String(row.nome) : undefined,
    perfil: row.perfil as UserProfile['perfil'],
    perfis_extras: Array.isArray(row.perfis_extras) ? row.perfis_extras.map(String) : [],
    ativo: row.ativo === true,
    criado_em: String(row.criado_em ?? ''),
  }
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token || session.user.id !== userId) {
    return null
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 15_000)

  try {
    const { data, error } = await supabase
      .rpc('movelaria_obter_meu_usuario')
      .abortSignal(controller.signal)

    if (error) throw new Error(error.message)

    const row = (data ?? [])[0] as Record<string, unknown> | undefined
    return row ? mapRpcProfile(row) : null
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        'Não foi possível conectar ao banco de dados. Verifique se o projeto Supabase está ativo.',
      )
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}

async function fetchProfileWithRetry(userId: string, attempts = 4): Promise<UserProfile | null> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const profile = await fetchProfile(userId)
      if (profile) return profile
    } catch (err) {
      lastError = err
    }

    if (attempt < attempts - 1) {
      await new Promise(resolve => window.setTimeout(resolve, 150 * (attempt + 1)))
    }
  }

  if (lastError) throw lastError
  return null
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileRetryKey, setProfileRetryKey] = useState(0)

  useEffect(() => {
    let active = true

    const handleRateLimited = () => {
      if (!active) return
      setSession(null)
      setUser(null)
      setUserProfile(null)
      setProfileError(null)
      setProfileLoading(false)
      setLoading(false)
    }

    window.addEventListener('supabase:auth-rate-limited', handleRateLimited)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return

      if (event === 'INITIAL_SESSION') {
        setSession(nextSession)
        setUser(nextSession?.user ?? null)
        setLoading(false)
        return
      }

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setUserProfile(null)
        setProfileError(null)
        setProfileLoading(false)
        setLoading(false)
        return
      }

      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession)
        return
      }

      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      window.removeEventListener('supabase:auth-rate-limited', handleRateLimited)
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setUserProfile(null)
      setProfileError(null)
      setProfileLoading(false)
      return
    }

    let active = true

    const run = () => {
      void (async () => {
        setProfileLoading(true)
        setProfileError(null)

        try {
          const profile = await fetchProfileWithRetry(userId)
          if (!active) return

          if (!profile) {
            setUserProfile(null)
            setProfileError('Perfil não encontrado no sistema. Contate o administrador.')
            return
          }

          if (profile.ativo === false) {
            setUserProfile(null)
            setProfileError(
              'Conta pendente de aprovação. Aguarde o administrador ativar seu acesso em Configurações.',
            )
            return
          }

          setUserProfile(profile)
        } catch (err) {
          if (!active) return
          const message = err instanceof Error ? err.message : 'Erro ao carregar perfil.'
          console.error('[useAuth] Erro ao buscar perfil:', err)
          setUserProfile(null)
          setProfileError(message)
        } finally {
          if (active) setProfileLoading(false)
        }
      })()
    }

    // Evita deadlock conhecido do Supabase ao consultar DB logo após auth
    const deferId = window.setTimeout(run, 200)

    return () => {
      active = false
      window.clearTimeout(deferId)
    }
  }, [session?.user?.id, profileRetryKey])

  useEffect(() => {
    const token = session?.access_token
    if (token) {
      supabase.realtime.setAuth(token)
    }
  }, [session?.access_token])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const retryProfile = useCallback(() => {
    setProfileRetryKey(k => k + 1)
  }, [])

  const role = userProfile ? perfilToRole(userProfile.perfil) : null
  const roles = userProfile ? computeRoles(userProfile) : []

  return {
    session,
    user,
    userProfile,
    role,
    roles,
    loading,
    profileLoading,
    profileError,
    signOut,
    retryProfile,
  }
}
