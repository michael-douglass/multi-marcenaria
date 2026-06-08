import { createContext, useContext, ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'
import type { UserRole, UserProfile } from '../types'

interface AppContextType {
  // Auth
  session: Session | null
  user: User | null
  userProfile: UserProfile | null
  role: UserRole | null
  roles: UserRole[]
  authLoading: boolean
  profileLoading: boolean
  profileError: string | null
  signOut: () => Promise<void>
  retryProfile: () => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  return (
    <AppContext.Provider
      value={{
        session: auth.session,
        user: auth.user,
        userProfile: auth.userProfile,
        role: auth.role,
        roles: auth.roles,
        authLoading: auth.loading,
        profileLoading: auth.profileLoading,
        profileError: auth.profileError,
        signOut: auth.signOut,
        retryProfile: auth.retryProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
