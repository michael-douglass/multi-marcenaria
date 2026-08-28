import { createContext, useContext, useMemo, type ReactNode } from 'react'

export interface Empresa {
  id: string
  nome: string
  slug: string
  schema_nome: string
  ativo: boolean
  cor_primaria: string | null
  logo_url: string | null
  banner_desktop_url: string | null
  banner_mobile_url: string | null
  banner_slides_desktop: string[] | null
  banner_slides_mobile: string[] | null
  cnpj?: string | null
  razao_social?: string | null
}

/** Casa única: Movelaria Garbo. Sem seletor de empresas na UI. */
export const GARBO_EMPRESA: Empresa = {
  id: 'emp_garbo',
  nome: 'Garbo Movelaria',
  slug: 'garbo',
  schema_nome: 'emp_garbo',
  ativo: true,
  cor_primaria: '#f2d892',
  logo_url: '/garbo-logo.png',
  banner_desktop_url: null,
  banner_mobile_url: null,
  banner_slides_desktop: null,
  banner_slides_mobile: null,
}

interface EmpresaContextType {
  empresa: Empresa | null
  schemaEmpresa: string | null
  isSuperAdmin: boolean
  isModoGlobal: boolean
  loading: boolean
  queriesReady: boolean
  trocarEmpresa: (empresa: Empresa | null) => Promise<void>
  limparEmpresaAtiva: () => void
  recarregarEmpresa: (userId: string) => Promise<void>
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined)

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const value = useMemo<EmpresaContextType>(
    () => ({
      empresa: GARBO_EMPRESA,
      schemaEmpresa: 'emp_garbo',
      isSuperAdmin: false,
      isModoGlobal: false,
      loading: false,
      queriesReady: true,
      trocarEmpresa: async () => {
        /* casa única — não troca */
      },
      limparEmpresaAtiva: () => {
        /* casa única — não limpa */
      },
      recarregarEmpresa: async () => {
        /* casa única — schema fixo */
      },
    }),
    [],
  )

  return <EmpresaContext.Provider value={value}>{children}</EmpresaContext.Provider>
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa must be used within EmpresaProvider')
  return ctx
}
