import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
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
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  telefone?: string | null
  email?: string | null
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

  // Identidade estável: telas usam essas funções como dependência de efeito (ex.: Prestador).
  // Se fossem recriadas a cada mudança do memo, o efeito rodaria de novo a cada setState de empresa.
  const trocarEmpresaCtx = useCallback(
    async (e: Empresa | null) => {
      if (e?.id) await trocarEmpresa(e.id)
    },
    [trocarEmpresa],
  )
  const limparEmpresaAtiva = useCallback(() => {
    /* a empresa ativa vem do banco; o master troca pelo seletor */
  }, [])
  const recarregarEmpresaCtx = useCallback(async () => {
    recarregarEmpresa()
  }, [recarregarEmpresa])

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
          cep: ativa.cep,
          logradouro: ativa.logradouro,
          numero: ativa.numero,
          complemento: ativa.complemento,
          bairro: ativa.bairro,
          cidade: ativa.cidade,
          uf: ativa.uf,
          telefone: ativa.telefone,
          email: ativa.email,
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
      trocarEmpresa: trocarEmpresaCtx,
      limparEmpresaAtiva,
      recarregarEmpresa: recarregarEmpresaCtx,
    }
  }, [ativa, isMaster, empresaLoading, trocarEmpresaCtx, limparEmpresaAtiva, recarregarEmpresaCtx])

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
