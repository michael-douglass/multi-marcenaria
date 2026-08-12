import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { useApp } from '@/context/AppContext'
import { useCaixaFornecedor } from '@/hooks/useCaixaFornecedor'
import { useClientes } from '@/hooks/useClientes'
import { useContasPagar } from '@/hooks/useContasPagar'
import { useFornecedores } from '@/hooks/useFornecedores'
import type { UserRole } from '@/types'

type FornecedoresStore = ReturnType<typeof useFornecedores>
type ClientesStore = ReturnType<typeof useClientes>
type ContasPagarStore = ReturnType<typeof useContasPagar>
type CaixaFornecedorStore = ReturnType<typeof useCaixaFornecedor>

export interface FinanceDataStore {
  fornecedores: FornecedoresStore
  clientes: ClientesStore
  contasPagar: ContasPagarStore
  caixaFornecedor: CaixaFornecedorStore
}

const FinanceDataContext = createContext<FinanceDataStore | null>(null)

/** Perfis que usam clientes/fornecedores/cobranças no App shell. */
export function needsFinanceAppData(roles: UserRole[]): boolean {
  return roles.some(
    r => r === 'Administrador' || r === 'Financeiro' || r === 'Marceneiro',
  )
}

/**
 * Carrega dados financeiros só para quem precisa.
 * Prestadores (montador / montador admin) não ficam poluindo a Agenda
 * com recargas de Contas a Pagar, Clientes etc. a cada poucos segundos.
 */
function FinanceDataProvider({ children }: { children: ReactNode }) {
  const fornecedores = useFornecedores()
  const clientes = useClientes()
  const contasPagar = useContasPagar()
  const caixaFornecedor = useCaixaFornecedor()

  const value = useMemo<FinanceDataStore>(
    () => ({
      fornecedores,
      clientes,
      contasPagar,
      caixaFornecedor,
    }),
    [fornecedores, clientes, contasPagar, caixaFornecedor],
  )

  return (
    <FinanceDataContext.Provider value={value}>
      {children}
    </FinanceDataContext.Provider>
  )
}

export function OptionalFinanceDataProvider({ children }: { children: ReactNode }) {
  const { roles } = useApp()
  if (!needsFinanceAppData(roles)) {
    return <>{children}</>
  }
  return <FinanceDataProvider>{children}</FinanceDataProvider>
}

export function useFinanceData(): FinanceDataStore {
  const ctx = useContext(FinanceDataContext)
  if (!ctx) {
    throw new Error(
      'useFinanceData só funciona para perfis financeiro/admin (ou dentro do FinanceDataProvider).',
    )
  }
  return ctx
}

/** Versão segura: null para prestadores (não monta os hooks financeiros). */
export function useFinanceDataOptional(): FinanceDataStore | null {
  return useContext(FinanceDataContext)
}
