import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Lead, User } from '@/types/selletos'
import { useAuth } from './AuthContext'
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile'
import { resolveAppUser } from '@/lib/resolve-app-user'

interface CrmUiContextType {
  currentUser: User
  setCurrentUser: (user: User) => void
  users: User[]
  setUsers: (users: User[]) => void
  leads: Lead[]
  setLeads: (leads: Lead[]) => void
  updateLead: (id: number, updates: Partial<Lead>) => void
  addLead: (lead: Omit<Lead, 'id'>) => void
  deleteLead: (id: number) => void
}

const CrmUiContext = createContext<CrmUiContextType | undefined>(undefined)

const guestUser: User = {
  id: 0,
  name: 'Visitante',
  email: '',
  role: 'NENHUM',
  inviteSent: false,
  createdAt: new Date().toISOString(),
}

/** Contexto de UI do CRM (currentUser). Não confundir com `@/context/AppContext` da fábrica. */
export function AppProvider({ children }: { children: ReactNode }) {
  const { user: authUser, userRole } = useAuth()
  const { data: profileUser } = useCurrentUserProfile()

  const currentUser = useMemo(
    () => (authUser ? resolveAppUser(authUser, profileUser, userRole) : guestUser),
    [authUser, profileUser, userRole],
  )

  const [users, setUsers] = useState<User[]>([])
  const [leads, setLeads] = useState<Lead[]>([])

  const setCurrentUser = () => {
    console.warn('setCurrentUser is deprecated, currentUser is now computed from auth state')
  }

  const updateLead = (id: number, updates: Partial<Lead>) => {
    setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, ...updates } : lead)))
  }

  const addLead = (lead: Omit<Lead, 'id'>) => {
    setLeads((prev) => {
      const newLead = { ...lead, id: Math.max(0, ...prev.map((l) => l.id)) + 1 }
      return [...prev, newLead]
    })
  }

  const deleteLead = (id: number) => {
    setLeads((prev) => prev.filter((lead) => lead.id !== id))
  }

  return (
    <CrmUiContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        setUsers,
        leads,
        setLeads,
        updateLead,
        addLead,
        deleteLead,
      }}
    >
      {children}
    </CrmUiContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(CrmUiContext)
  if (!context) {
    throw new Error('useApp must be used within CRM AppProvider')
  }
  return context
}
