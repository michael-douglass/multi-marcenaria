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
    montador: 'Montador',
    montador_admin: 'MontadorAdmin',
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
    // 1. Carga inicial da sessão (crítico para F5)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.user) {
        scheduleProfileFetch(session.user.id)
      }
    }).catch(err => {
      console.error('[useAuth] Erro ao buscar sessão inicial:', err)
      setLoading(false)
    })

    // 2. Listener de mudanças de estado
    // O callback DEVE ser síncrono para evitar deadlocks em produção
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // console.log(`[useAuth] Evento: ${event}`, session?.user?.id)

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setUserProfile(null)
        setProfileLoading(false)
        setLoading(false)
        return
      }

      // TOKEN_REFRESHED só atualiza a sessão local
      if (event === 'TOKEN_REFRESHED') {
        setSession(session)
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.user) {
        scheduleProfileFetch(session.user.id)
      }
    })

    function scheduleProfileFetch(userId: string) {
      setProfileLoading(true)
      // setTimeout 0 garante que o fetch ocorra fora do loop síncrono do listener
      // e após o Supabase atualizar internamente o estado do cliente (JWT)
      setTimeout(async () => {
        try {
          const profile = await fetchProfile(userId)
          setUserProfile(profile)
          if (!profile) {
            console.warn('[useAuth] Perfil não encontrado para o usuário:', userId)
          }
        } catch (err) {
          console.error('[useAuth] Erro ao buscar perfil:', err)
          setUserProfile(null)
        } finally {
          setProfileLoading(false)
        }
      }, 0)
    }

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const role = userProfile ? perfilToRole(userProfile.perfil) : null

  return { session, user, userProfile, role, loading, profileLoading, signOut }
}
