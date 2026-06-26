import { createContext, useContext, type ReactNode } from 'react'
import { useCaixa } from '@/hooks/useCaixa'

export type CaixaStore = ReturnType<typeof useCaixa>

const CaixaContext = createContext<CaixaStore | null>(null)

/** Uma única fonte de dados do Caixa para a página e os diálogos. */
export function CaixaProvider({
  mes,
  ano,
  children,
}: {
  mes: number
  ano: number
  children: ReactNode
}) {
  const store = useCaixa(mes, ano)
  return <CaixaContext.Provider value={store}>{children}</CaixaContext.Provider>
}

export function useCaixaContext(): CaixaStore {
  const ctx = useContext(CaixaContext)
  if (!ctx) {
    throw new Error('useCaixaContext deve ser usado dentro de CaixaProvider.')
  }
  return ctx
}
