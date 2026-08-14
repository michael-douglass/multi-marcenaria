import { createContext } from 'react'
import type { ObrasStore } from '@/hooks/useObrasState'

/**
 * Contexto isolado num arquivo estável.
 * Se o Provider e o hook vivem em módulos diferentes (HMR / PWA),
 * ambos precisam ler o mesmo objeto — senão a tela de obras quebra.
 */
export const ObrasStoreContext = createContext<ObrasStore | null>(null)
