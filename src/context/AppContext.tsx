import { createContext, useContext, ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'
import { useEmpresaAtiva, type EmpresaAtiva } from '../hooks/useEmpresaAtiva'
import type { CrmProfile } from '../lib/crm-identity'
import type { UserRole, UserProfile } from '../types'

interface AppContextType {
  session: Session | null
  user: User | null
  userProfile: UserProfile | null
  crmProfile: CrmProfile | null
  role: UserRole | null
  roles: UserRole[]
  authLoading: boolean
  profileLoading: boolean
  profileError: string | null
  signOut: () => Promise<void>
  retryProfile: () => void
  /** Marcenaria em que o usuário está trabalhando (multi-empresa). */
  empresa: EmpresaAtiva | null
  /** Usuário master da plataforma (acessa todas as empresas). */
  isMaster: boolean
  empresaLoading: boolean
  trocarEmpresa: (empresaId: string, somenteLeitura?: boolean, destino?: string) => Promise<void>
  sairInspecao: () => Promise<void>
  recarregarEmpresa: () => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const emp = useEmpresaAtiva(auth.session?.user?.id)
  return (
    <AppContext.Provider
      value={{
        session: auth.session,
        user: auth.user,
        userProfile: auth.userProfile,
        crmProfile: auth.crmProfile,
        role: auth.role,
        roles: auth.roles,
        authLoading: auth.loading,
        profileLoading: auth.profileLoading,
        profileError: auth.profileError,
        signOut: auth.signOut,
        retryProfile: auth.retryProfile,
        empresa: emp.empresa,
        isMaster: emp.isMaster,
        empresaLoading: emp.empresaLoading,
        trocarEmpresa: emp.trocarEmpresa,
        sairInspecao: emp.sairInspecao,
        recarregarEmpresa: emp.recarregarEmpresa,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

/** Igual a `useApp`, mas devolve null fora do provider (ex.: testes e telas isoladas). */
export function useAppOptional() {
  return useContext(AppContext)
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
