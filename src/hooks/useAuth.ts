import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UserProfile, UserRole } from '../types'

export interface AuthState {
  session: Session | null
  user: User | null
  userProfile: UserProfile | null
  role: UserRole | null
  loading: boolean
  profileLoading: boolean
  signOut: () => Promise<void>
}

function perfilToRole(perfil: UserProfile['perfil']): UserRole {
  const map: Record<UserProfile['perfil'], UserRole> = {
    administrador: 'Administrador',
    financeiro: 'Financeiro',
    marceneiro: 'Marceneiro',
  }
  return map[perfil]
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('movelaria_usuarios')
    .select('*')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return data as UserProfile
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    // Fallback: se onAuthStateChange nunca disparar (falha de rede), desbloqueia a UI após 6s
    let timeoutId = setTimeout(() => setLoading(false), 6000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // TOKEN_REFRESHED só atualiza o token — não precisa rebuscar o perfil
      if (event === 'TOKEN_REFRESHED') {
        setSession(session)
        return
      }

      clearTimeout(timeoutId)

      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        // Adia um tick para o JWT ser propagado internamente pelo Supabase
        // antes de qualquer query ao banco (padrão documentado pelo Supabase)
        await new Promise<void>(resolve => setTimeout(resolve, 0))
        setProfileLoading(true)
        try {
          const profile = await fetchProfile(session.user.id)
          setUserProfile(profile)
          if (!profile) {
            console.warn('[useAuth] Perfil não encontrado para o usuário:', session.user.id)
          }
        } catch (err) {
          console.error('[useAuth] Erro ao buscar perfil:', err)
          setUserProfile(null)
        } finally {
          setProfileLoading(false)
        }
      } else {
        setUserProfile(null)
        setProfileLoading(false)
      }

      setLoading(false)
    })

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const role = userProfile ? perfilToRole(userProfile.perfil) : null

  return { session, user, userProfile, role, loading, profileLoading, signOut }
}
