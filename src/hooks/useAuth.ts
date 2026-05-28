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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setUserProfile(profile)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setUserProfile(profile)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const role = userProfile ? perfilToRole(userProfile.perfil) : null

  return { session, user, userProfile, role, loading, signOut }
}
