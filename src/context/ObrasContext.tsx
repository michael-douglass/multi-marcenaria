import { useContext, type ReactNode } from 'react'
import { useObrasState, type ObrasStore } from '@/hooks/useObrasState'
import { ObrasStoreContext } from './obras-store-context'

/** Mantém uma única lista de obras para todo o app (Agenda, Visualização, Calendário, etc.). */
export function ObrasProvider({ children }: { children: ReactNode }) {
  const store = useObrasState()
  return <ObrasStoreContext.Provider value={store}>{children}</ObrasStoreContext.Provider>
}

export function useObras(): ObrasStore {
  const ctx = useContext(ObrasStoreContext)
  if (!ctx) {
    throw new Error('useObras deve ser usado dentro de ObrasProvider.')
  }
  return ctx
}
