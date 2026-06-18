import { createContext, useContext, type ReactNode } from 'react'
import { useObrasState, type ObrasStore } from '@/hooks/useObrasState'

const ObrasContext = createContext<ObrasStore | null>(null)

/** Mantém uma única lista de obras para todo o app (Agenda, Visualização, Calendário, etc.). */
export function ObrasProvider({ children }: { children: ReactNode }) {
  const store = useObrasState()
  return <ObrasContext.Provider value={store}>{children}</ObrasContext.Provider>
}

export function useObras(): ObrasStore {
  const ctx = useContext(ObrasContext)
  if (!ctx) {
    throw new Error('useObras deve ser usado dentro de ObrasProvider.')
  }
  return ctx
}
