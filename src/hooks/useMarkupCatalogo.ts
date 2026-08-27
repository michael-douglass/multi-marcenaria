import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { MarkupCatalogoCategoria, MarkupCatalogoProduto } from '@/types'

export function useMarkupCatalogo(enabled: boolean) {
  const [produtos, setProdutos] = useState<MarkupCatalogoProduto[]>([])
  const [categorias, setCategorias] = useState<MarkupCatalogoCategoria[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setProdutos([])
      setCategorias([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.rpc('movelaria_markup_catalogo_listar'),
        supabase.rpc('movelaria_markup_catalogo_categorias'),
      ])
      if (prodRes.error) throw prodRes.error
      if (catRes.error) throw catRes.error
      setProdutos((prodRes.data ?? []) as MarkupCatalogoProduto[])
      setCategorias((catRes.data ?? []) as MarkupCatalogoCategoria[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar catálogo.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])

  const saveProduto = useCallback(async (input: {
    id?: string | null
    categoria_id?: string | null
    nome: string
    variacao?: string | null
    preco_unitario: number
    unidade: string
    quantidade_padrao?: number | null
    ativo?: boolean
    ordem?: number
  }) => {
    const { error: rpcError } = await supabase.rpc('movelaria_markup_catalogo_salvar_produto', {
      p_id: input.id ?? null,
      p_categoria_id: input.categoria_id ?? null,
      p_nome: input.nome,
      p_variacao: input.variacao ?? null,
      p_preco_unitario: input.preco_unitario,
      p_unidade: input.unidade,
      p_quantidade_padrao: input.quantidade_padrao ?? null,
      p_ativo: input.ativo ?? true,
      p_ordem: input.ordem ?? 0,
    })
    if (rpcError) throw new Error(rpcError.message)
    await load()
  }, [load])

  const saveCategoria = useCallback(async (input: {
    id?: string | null
    nome: string
    ordem?: number
    ativo?: boolean
  }) => {
    const { error: rpcError } = await supabase.rpc('movelaria_markup_catalogo_salvar_categoria', {
      p_id: input.id ?? null,
      p_nome: input.nome,
      p_ordem: input.ordem ?? 0,
      p_ativo: input.ativo ?? true,
    })
    if (rpcError) throw new Error(rpcError.message)
    await load()
  }, [load])

  return { produtos, categorias, loading, error, reload: load, saveProduto, saveCategoria }
}
