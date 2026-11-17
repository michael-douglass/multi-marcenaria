import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useApp as useAppCore } from '@/context/AppContext'
import { CRM_SCHEMA } from '@/lib/empresa-tables'

export interface Empresa {
  id: string
  nome: string
  slug: string
  schema_nome: string
  ativo: boolean
  status?: 'ativa' | 'bloqueada' | 'inativa'
  cor_primaria: string | null
  logo_url: string | null
  banner_desktop_url: string | null
  banner_mobile_url: string | null
  banner_slides_desktop: string[] | null
  banner_slides_mobile: string[] | null
  cnpj?: string | null
  razao_social?: string | null
}

/**
 * Empresa ativa do CRM — vem do núcleo (`@/context/AppContext`, RPC `app_minha_empresa`).
 * Multi-empresa: todas as marcenarias usam o schema compartilhado `crm`; o isolamento é por
 * `empresa_id` + RLS no banco (docs/multi-empresa/DESIGN.md).
 */
interface EmpresaContextType {
  empresa: Empresa | null
  schemaEmpresa: string | null
  /** Usuário master da plataforma (acessa todas as empresas). Não confundir com admin da empresa. */
  isMaster: boolean
  /** @deprecated use `isMaster`. Mantido por compatibilidade com telas antigas. */
  isSuperAdmin: boolean
  isModoGlobal: boolean
  loading: boolean
  queriesReady: boolean
  trocarEmpresa: (empresa: Empresa | null) => Promise<void>
  limparEmpresaAtiva: () => void
  recarregarEmpresa: (userId?: string) => Promise<void>
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined)

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const core = useAppCore()
  const { empresa: ativa, isMaster, empresaLoading, trocarEmpresa, recarregarEmpresa } = core

  const value = useMemo<EmpresaContextType>(() => {
    const empresa: Empresa | null = ativa
      ? {
          id: ativa.id,
          nome: ativa.nome,
          slug: ativa.slug,
          schema_nome: CRM_SCHEMA,
          ativo: ativa.ativo,
          status: ativa.status,
          cor_primaria: ativa.corPrimaria,
          logo_url: ativa.logoUrl,
          banner_desktop_url: null,
          banner_mobile_url: null,
          banner_slides_desktop: null,
          banner_slides_mobile: null,
          cnpj: ativa.cnpj,
          razao_social: ativa.razaoSocial,
        }
      : null
    return {
      empresa,
      schemaEmpresa: empresa ? CRM_SCHEMA : null,
      isMaster,
      isSuperAdmin: isMaster,
      isModoGlobal: false,
      loading: empresaLoading,
      queriesReady: !empresaLoading && !!empresa,
      trocarEmpresa: async (e) => {
        if (e?.id) await trocarEmpresa(e.id)
      },
      limparEmpresaAtiva: () => {
        /* a empresa ativa vem do banco; o master troca pelo seletor */
      },
      recarregarEmpresa: async () => {
        recarregarEmpresa()
      },
    }
  }, [ativa, isMaster, empresaLoading, trocarEmpresa, recarregarEmpresa])

  return <EmpresaContext.Provider value={value}>{children}</EmpresaContext.Provider>
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext)
  if (!ctx) throw new Error('useEmpresa must be used within EmpresaProvider')
  return ctx
}

/** Igual a `useEmpresa`, mas devolve null fora do provider (ex.: páginas públicas). */
export function useEmpresaOptional() {
  return useContext(EmpresaContext) ?? null
}
