import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

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
}

export interface EmpresaAtivaState {
  empresa: EmpresaAtiva | null
  isMaster: boolean
  empresaLoading: boolean
  /** Só para o master: troca a empresa ativa e recarrega o app (zera caches e estado). */
  trocarEmpresa: (empresaId: string) => Promise<void>
  recarregarEmpresa: () => void
}

/** Chave do cache persistido do TanStack Query (ver main.tsx). */
const RQ_CACHE_KEY = 'garbo-crm-rq-cache-v1'
/** Última empresa carregada neste navegador — se mudar, o cache local é descartado. */
const EMPRESA_LOCAL_KEY = 'garbo-empresa-ativa-id'

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
  }
}

export function useEmpresaAtiva(userId: string | null | undefined): EmpresaAtivaState {
  const queryClient = useQueryClient()
  const [empresa, setEmpresa] = useState<EmpresaAtiva | null>(null)
  const [isMaster, setIsMaster] = useState(false)
  const [empresaLoading, setEmpresaLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const ultimoUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) {
      // Logout (havia usuário e agora não há): descarta o cache local da empresa.
      if (ultimoUserId.current) {
        limparCacheLocal()
        queryClient.clear()
        ultimoUserId.current = null
      }
      setEmpresa(null)
      setIsMaster(false)
      setEmpresaLoading(false)
      return
    }
    ultimoUserId.current = userId
    let active = true
    setEmpresaLoading(true)
    void (async () => {
      const { data, error } = await supabase.rpc('app_minha_empresa' as never)
      if (!active) return
      if (error) {
        console.error('[useEmpresaAtiva] Erro ao carregar empresa:', error)
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
      setEmpresa(next)
      setIsMaster(row?.is_master === true)
      setEmpresaLoading(false)
    })()
    return () => {
      active = false
    }
  }, [userId, reloadKey, queryClient])

  const trocarEmpresa = useCallback(
    async (empresaId: string) => {
      const { error } = await supabase.rpc('master_definir_empresa_ativa' as never, { p_empresa_id: empresaId } as never)
      if (error) throw new Error(error.message)
      limparCacheLocal()
      queryClient.clear()
      try {
        window.localStorage.setItem(EMPRESA_LOCAL_KEY, empresaId)
      } catch {
        /* storage indisponível */
      }
      // Recarrega a aplicação inteira: garante que nenhum estado da empresa anterior sobreviva.
      window.location.assign('/')
    },
    [queryClient],
  )

  const recarregarEmpresa = useCallback(() => setReloadKey((k) => k + 1), [])

  return { empresa, isMaster, empresaLoading, trocarEmpresa, recarregarEmpresa }
}
