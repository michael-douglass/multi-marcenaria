import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'
import { isCrmAdmin, type CrmRole } from '@/lib/crm-identity'
import { hasAppRole, normalizeRoles, type AppUserRole } from '@/lib/app-roles'

export type UserRole = AppUserRole

export interface AccessHours {
  inicio: string | null
  fim: string | null
}

interface AuthContextType {
  user: SupabaseUser | null
  session: Session | null
  userRole: UserRole | null
  userRoles: UserRole[]
  hasRole: (role: UserRole) => boolean
  isSuperAdmin: boolean
  accessHours: AccessHours | null
  tipoUsuario: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<void>
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function mapCrmRoles(roles: CrmRole[] | undefined): AppUserRole[] {
  const mapped = (roles ?? []).filter((role): role is AppUserRole =>
    role === 'admin' ||
    role === 'vendedor' ||
    role === 'marketing' ||
    role === 'projetista' ||
    role === 'projetista_admin' ||
    role === 'nenhum',
  )
  return normalizeRoles(mapped.length ? mapped : ['nenhum'])
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const app = useApp()

  const userRoles = useMemo(
    () => mapCrmRoles(app.crmProfile?.roles),
    [app.crmProfile?.roles],
  )
  const userRole = userRoles[0] ?? 'nenhum'
  const isSuperAdmin = isCrmAdmin(app.crmProfile) || app.role === 'Administrador'

  const hasRole = useCallback(
    (role: UserRole) => hasAppRole(userRoles, role) || (isSuperAdmin && role === 'admin'),
    [userRoles, isSuperAdmin],
  )

  const accessHours = useMemo<AccessHours | null>(() => {
    const inicio = app.crmProfile?.horarioAcessoInicio ?? null
    const fim = app.crmProfile?.horarioAcessoFim ?? null
    return inicio || fim ? { inicio, fim } : null
  }, [app.crmProfile?.horarioAcessoFim, app.crmProfile?.horarioAcessoInicio])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, phone } },
    })
    if (error) throw error
  }

  const signInWithGoogle = async (redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo ?? window.location.origin },
    })
    if (error) throw error
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  const value = useMemo<AuthContextType>(
    () => ({
      user: app.user,
      session: app.session,
      userRole,
      userRoles,
      hasRole,
      isSuperAdmin,
      accessHours,
      tipoUsuario: app.crmProfile?.tipoUsuario ?? null,
      loading: app.authLoading || app.profileLoading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut: app.signOut,
      resetPassword,
      updatePassword,
    }),
    [
      accessHours,
      app.authLoading,
      app.profileLoading,
      app.session,
      app.signOut,
      app.user,
      app.crmProfile?.tipoUsuario,
      hasRole,
      isSuperAdmin,
      userRole,
      userRoles,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
