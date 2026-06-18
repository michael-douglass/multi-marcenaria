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

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 15_000)

  try {
    const { data, error } = await supabase
      .from('movelaria_usuarios')
      .select('*')
      .eq('id', userId)
      .abortSignal(controller.signal)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(error.message)
    }

    return (data ?? null) as UserProfile | null
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

    void (async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        if (!active) return

        setSession(initialSession)
        setUser(initialSession?.user ?? null)
      } catch (err) {
        if (!active) return
        console.error('[useAuth] Erro ao buscar sessão inicial:', err)
      } finally {
        if (active) setLoading(false)
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return

      if (event === 'INITIAL_SESSION') return

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
          const profile = await fetchProfile(userId)
          if (!active) return

          setUserProfile(profile)
          if (!profile) {
            setProfileError('Perfil não encontrado no sistema.')
          }
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
    const deferId = window.setTimeout(run, 50)

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
