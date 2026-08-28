import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthReady } from '@/hooks/useAuthReady'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import {
  parseMarkupBoot,
  parseMarkupOrcamento,
  parseMarkupResumos,
  type CrmMarkupBoot,
} from '@/lib/crm-markup'
import type { MarkupLeadResumo, MarkupModulos, MarkupOrcamento } from '@/lib/markup-types'

const EMPTY: CrmMarkupBoot = {
  orcamentos: [],
  config: parseMarkupBoot({}).config,
  categorias: [],
  produtos: [],
  despesas: [],
  servicos: [],
  leads: [],
}

export function useCrmMarkup(enabled = true) {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<CrmMarkupBoot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady || !enabled) return
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const { data: raw, error: err } = await supabase.rpc('movelaria_crm_markup_boot')
      if (err) throw err
      setData(parseMarkupBoot(raw))
    } catch (err) {
      if (!opts?.silent) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar o markup.')
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [isReady, enabled])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setError(null)
      return
    }
    void load()
  }, [load, enabled])
  useAutoRefresh(() => { void load({ silent: true }) })

  const obter = async (id: string): Promise<MarkupOrcamento> => {
    const { data: raw, error: err } = await supabase.rpc('movelaria_crm_markup_obter', { p_id: id })
    if (err) throw new Error(err.message)
    return parseMarkupOrcamento(raw, data.config)
  }

  const salvar = async (input: {
    id: string
    titulo: string
    status: string
    modulos: MarkupModulos
    observacoes: string
    leadId: number | null
  }) => {
    const { data: raw, error: err } = await supabase.rpc('movelaria_crm_markup_salvar', {
      p_id: input.id,
      p_titulo: input.titulo,
      p_status: input.status,
      p_modulos: input.modulos,
      p_observacoes: input.observacoes,
      p_lead_id: input.leadId,
    })
    if (err) throw new Error(err.message)
    const saved = parseMarkupOrcamento(raw, data.config)
    setData(prev => ({
      ...prev,
      orcamentos: prev.orcamentos.map(item => item.id === saved.id
        ? {
            ...item,
            titulo: saved.titulo,
            status: saved.status,
            preco_final: saved.preco_final,
            atualizado_em: saved.atualizado_em ?? item.atualizado_em,
          }
        : item),
    }))
    return saved
  }

  const criar = async (leadId: number | null, titulo?: string) => {
    const { data: raw, error: err } = await supabase.rpc('movelaria_crm_markup_criar', {
      p_lead_id: leadId,
      p_titulo: titulo ?? '',
    })
    if (err) throw new Error(err.message)
    const created = parseMarkupOrcamento(raw, data.config)
    await load({ silent: true })
    return created
  }

  const salvarConfig = async (input: {
    valorHora: number
    fatorSobras: number
    margemLucro: number
    imposto: number
    taxas: number
    frete: number
    rodape: string
  }) => {
    const { error: err } = await supabase.rpc('movelaria_crm_markup_salvar_config', {
      p_valor_hora: input.valorHora,
      p_fator_sobras: input.fatorSobras,
      p_margem_lucro: input.margemLucro,
      p_percentual_imposto: input.imposto,
      p_taxas_financeiras: input.taxas,
      p_custo_frete: input.frete,
      p_rodape: input.rodape,
    })
    if (err) throw new Error(err.message)
    await load()
  }

  const salvarProduto = async (input: {
    id?: string | null
    categoriaId?: string | null
    nome: string
    variacao?: string | null
    preco: number
    unidade: string
    quantidadePadrao?: number
    ativo?: boolean
  }) => {
    const { error: err } = await supabase.rpc('movelaria_crm_markup_salvar_produto', {
      p_id: input.id ?? null,
      p_categoria_id: input.categoriaId ?? null,
      p_nome: input.nome,
      p_variacao: input.variacao ?? null,
      p_preco_unitario: input.preco,
      p_unidade: input.unidade,
      p_quantidade_padrao: input.quantidadePadrao ?? 1,
      p_ativo: input.ativo ?? true,
      p_ordem: 0,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const salvarCategoria = async (nome: string) => {
    const { error: err } = await supabase.rpc('movelaria_crm_markup_salvar_categoria', {
      p_id: null,
      p_nome: nome,
      p_ordem: 0,
      p_ativo: true,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const salvarDespesa = async (input: { id?: string | null; nome: string; valor: number; ativo?: boolean }) => {
    const { error: err } = await supabase.rpc('movelaria_crm_markup_salvar_despesa', {
      p_id: input.id ?? null,
      p_nome: input.nome,
      p_valor_padrao: input.valor,
      p_ordem: 0,
      p_ativo: input.ativo ?? true,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  const salvarServico = async (input: { id?: string | null; nome: string; valorHora: number; ativo?: boolean }) => {
    const { error: err } = await supabase.rpc('movelaria_crm_markup_salvar_servico', {
      p_id: input.id ?? null,
      p_nome: input.nome,
      p_valor_hora: input.valorHora,
      p_ordem: 0,
      p_ativo: input.ativo ?? true,
    })
    if (err) throw new Error(err.message)
    await load({ silent: true })
  }

  return {
    data,
    loading,
    error,
    reload: load,
    obter,
    salvar,
    criar,
    salvarConfig,
    salvarProduto,
    salvarCategoria,
    salvarDespesa,
    salvarServico,
  }
}

export function useCrmMarkupResumos() {
  const { isReady } = useAuthReady()
  const [resumos, setResumos] = useState<MarkupLeadResumo[]>([])

  const load = useCallback(async () => {
    if (!isReady) return
    const { data: raw, error } = await supabase.rpc('movelaria_crm_markup_resumos')
    if (error) return
    setResumos(parseMarkupResumos(raw))
  }, [isReady])

  useEffect(() => { void load() }, [load])
  useAutoRefresh(() => { void load() })

  return { resumos, reload: load }
}
