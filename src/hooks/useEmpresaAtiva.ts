import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { definirInspecaoSomenteLeitura, supabase } from '../lib/supabase'
import { definirEmpresaDocumento } from '../lib/empresa-identidade'
import { APP_SYSTEM_NAME } from '../lib/app-branding'

/** Empresa (marcenaria) em que o usuário está trabalhando — RPC `app_minha_empresa`. */
export interface EmpresaAtiva {
  id: string
  nome: string
  slug: string
  status: 'ativa' | 'bloqueada' | 'inativa'
  ativo: boolean
  logoUrl: string | null
  corPrimaria: string | null
  cnpj: string | null
  razaoSocial: string | null
  /** Endereço e contato (dados cadastrais; CNPJ guardado só com dígitos). */
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  telefone: string | null
  email: string | null
  /** Representante legal (aparece nos contratos); CPF só com dígitos. */
  representanteNome: string | null
  representanteCpf: string | null
  representanteQualificacao: string | null
  /** Páginas bloqueadas pela plataforma (ids de `src/lib/paginas-catalogo.ts`). */
  paginasBloqueadas: string[]
  /** O master está dentro desta empresa (inspeção). */
  emInspecao: boolean
  /** Inspeção do master em modo somente leitura (o banco recusa gravações). */
  somenteLeitura: boolean
}

export interface EmpresaAtivaState {
  empresa: EmpresaAtiva | null
  isMaster: boolean
  empresaLoading: boolean
  /** Só para o master: entra na empresa (inspeção) e recarrega o app (zera caches e estado). */
  trocarEmpresa: (empresaId: string, somenteLeitura?: boolean, destino?: string) => Promise<void>
  /** Só para o master: sai da inspeção e volta ao console `/master`. */
  sairInspecao: () => Promise<void>
  recarregarEmpresa: () => void
}

/** Chave do cache persistido do TanStack Query (ver main.tsx). */
const RQ_CACHE_KEY = 'app-crm-rq-cache-v1'
/** Última empresa carregada neste navegador — se mudar, o cache local é descartado. */
const EMPRESA_LOCAL_KEY = 'app-empresa-ativa-id'

function limparCacheLocal() {
  try {
    window.localStorage.removeItem(RQ_CACHE_KEY)
  } catch {
    /* storage indisponível */
  }
}

function mapEmpresa(row: Record<string, unknown>): EmpresaAtiva {
  return {
    id: String(row.id),
    nome: String(row.nome ?? ''),
    slug: String(row.slug ?? ''),
    status: (row.status as EmpresaAtiva['status']) ?? 'ativa',
    ativo: row.ativo !== false,
    logoUrl: (row.logo_url as string | null) ?? null,
    corPrimaria: (row.cor_primaria as string | null) ?? null,
    cnpj: (row.cnpj as string | null) ?? null,
    razaoSocial: (row.razao_social as string | null) ?? null,
    cep: (row.cep as string | null) ?? null,
    logradouro: (row.logradouro as string | null) ?? null,
    numero: (row.numero as string | null) ?? null,
    complemento: (row.complemento as string | null) ?? null,
    bairro: (row.bairro as string | null) ?? null,
    cidade: (row.cidade as string | null) ?? null,
    uf: (row.uf as string | null) ?? null,
    telefone: (row.telefone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    representanteNome: (row.representante_nome as string | null) ?? null,
    representanteCpf: (row.representante_cpf as string | null) ?? null,
    representanteQualificacao: (row.representante_qualificacao as string | null) ?? null,
    paginasBloqueadas: Array.isArray(row.paginas_bloqueadas) ? (row.paginas_bloqueadas as string[]) : [],
    emInspecao: row.em_inspecao === true,
    somenteLeitura: row.inspecao_somente_leitura === true,
  }
}

export function useEmpresaAtiva(userId: string | null | undefined): EmpresaAtivaState {
  const queryClient = useQueryClient()
  const [empresa, setEmpresa] = useState<EmpresaAtiva | null>(null)
  const [isMaster, setIsMaster] = useState(false)
  const [empresaLoading, setEmpresaLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const ultimoUserId = useRef<string | null>(null)
  /** Usuário para o qual a empresa já foi carregada ao menos uma vez. */
  const carregadoPara = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) {
      carregadoPara.current = null
      // Logout (havia usuário e agora não há): descarta o cache local da empresa.
      if (ultimoUserId.current) {
        limparCacheLocal()
        queryClient.clear()
        ultimoUserId.current = null
      }
      definirEmpresaDocumento(null)
      if (typeof document !== 'undefined') document.title = APP_SYSTEM_NAME
      setEmpresa(null)
      setIsMaster(false)
      setEmpresaLoading(false)
      return
    }
    ultimoUserId.current = userId
    let active = true
    // `empresaLoading` (que no App troca a árvore inteira pelo loader) só liga na 1ª carga ou na
    // troca de usuário. `recarregarEmpresa` (reloadKey) é refresh silencioso: desmontar a árvore a
    // cada refresh fazia telas que o chamam no mount (ex.: portal do prestador) entrarem em loop.
    if (carregadoPara.current !== userId) setEmpresaLoading(true)
    void (async () => {
      // O master fora de inspeção não tem empresa: `app_is_master` vem separado.
      const [{ data, error }, masterRes] = await Promise.all([
        supabase.rpc('app_minha_empresa' as never),
        supabase.rpc('app_is_master' as never),
      ])
      if (!active) return
      if (error) {
        console.error('[useEmpresaAtiva] Erro ao carregar empresa:', error)
        carregadoPara.current = userId
        setEmpresa(null)
        setIsMaster(false)
        setEmpresaLoading(false)
        return
      }
      const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[]
      const row = rows[0]
      const next = row ? mapEmpresa(row) : null
      // Cache local é por empresa: ao detectar outra empresa neste navegador, descarta o anterior.
      try {
        const anterior = window.localStorage.getItem(EMPRESA_LOCAL_KEY)
        if (next && anterior && anterior !== next.id) {
          limparCacheLocal()
          queryClient.clear()
        }
        if (next) window.localStorage.setItem(EMPRESA_LOCAL_KEY, next.id)
      } catch {
        /* storage indisponível */
      }
      definirInspecaoSomenteLeitura(next?.somenteLeitura === true)
      definirEmpresaDocumento(next)
      // Aba do navegador com o nome da empresa (sem marca fixa — ADR 0006).
      if (typeof document !== 'undefined') document.title = next?.nome?.trim() || APP_SYSTEM_NAME
      carregadoPara.current = userId
      // Mantém a identidade do objeto quando nada mudou (evita re-render em cascata no refresh).
      setEmpresa((atual) => (atual && next && JSON.stringify(atual) === JSON.stringify(next) ? atual : next))
      setIsMaster(row?.is_master === true || masterRes.data === true)
      setEmpresaLoading(false)
    })()
    return () => {
      active = false
    }
  }, [userId, reloadKey, queryClient])

  const trocarEmpresa = useCallback(
    async (empresaId: string, somenteLeitura = true, destino?: string) => {
      const { error } = await supabase.rpc(
        'master_definir_empresa_ativa' as never,
        { p_empresa_id: empresaId, p_somente_leitura: somenteLeitura } as never,
      )
      if (error) throw new Error(error.message)
      limparCacheLocal()
      queryClient.clear()
      try {
        window.localStorage.setItem(EMPRESA_LOCAL_KEY, empresaId)
      } catch {
        /* storage indisponível */
      }
      // Recarrega a aplicação inteira: garante que nenhum estado da empresa anterior sobreviva.
      // `destino` (rota interna) leva direto a uma tela, ex.: editar o markup da empresa-modelo.
      window.location.assign(destino && destino.startsWith('/') && !destino.startsWith('//') ? destino : '/')
    },
    [queryClient],
  )

  const sairInspecao = useCallback(async () => {
    const { error } = await supabase.rpc('master_sair_empresa' as never)
    if (error) throw new Error(error.message)
    limparCacheLocal()
    queryClient.clear()
    try {
      window.localStorage.removeItem(EMPRESA_LOCAL_KEY)
    } catch {
      /* storage indisponível */
    }
    window.location.assign('/master')
  }, [queryClient])

  const recarregarEmpresa = useCallback(() => setReloadKey((k) => k + 1), [])

  return { empresa, isMaster, empresaLoading, trocarEmpresa, sairInspecao, recarregarEmpresa }
}
