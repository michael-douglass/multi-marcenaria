import { useCallback, useEffect, useMemo, useState } from 'react'
import { collectObraLeadIds } from '@/lib/obra-markup-custos'
import { mapMarkupItensRows, parseMarkupLinhas } from '@/lib/pedidos-obras'
import { supabase } from '@/lib/supabase'
import type { MarkupLinhaProduto, MarkupOrcamentoItens, ObraFull } from '@/types'

export function useMarkupItensPorLeads(
  obras: Pick<ObraFull, 'origem_lead_id'>[],
  enabled: boolean,
) {
  const [itensByLead, setItensByLead] = useState<Map<string, MarkupOrcamentoItens>>(() => new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const leadIdsKey = useMemo(() => {
    if (!enabled) return ''
    return collectObraLeadIds(obras).sort().join(',')
  }, [obras, enabled])

  const load = useCallback(async () => {
    if (!enabled || !leadIdsKey) {
      setItensByLead(new Map())
      setLoading(false)
      setError(null)
      return
    }

    const leadIds = leadIdsKey.split(',')
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('movelaria_markup_itens_por_leads', {
        p_lead_ids: leadIds,
      })
      if (rpcError) throw rpcError
      setItensByLead(mapMarkupItensRows(data))
    } catch (e) {
      setItensByLead(new Map())
      setError(e instanceof Error ? e.message : 'Erro ao carregar itens do markup.')
    } finally {
      setLoading(false)
    }
  }, [enabled, leadIdsKey])

  useEffect(() => {
    void load()
  }, [load])

  const saveLinhas = useCallback(async (orcamentoId: string, linhas: MarkupLinhaProduto[]) => {
    const { data, error: rpcError } = await supabase.rpc('movelaria_salvar_markup_itens', {
      p_orcamento_id: orcamentoId,
      p_linhas: linhas,
    })
    if (rpcError) throw new Error(rpcError.message)
    const payload = data as { linhas?: unknown; custo_materiais?: number } | null
    setItensByLead(prev => {
      const next = new Map(prev)
      for (const [leadId, item] of next) {
        if (item.orcamento_id === orcamentoId) {
          next.set(leadId, {
            ...item,
            linhas: parseMarkupLinhas(payload?.linhas ?? linhas),
            custo_materiais: Number(payload?.custo_materiais ?? item.custo_materiais),
          })
        }
      }
      return next
    })
  }, [])

  const createOrcamento = useCallback(async (
    leadId: string,
    titulo: string,
    linhas: MarkupLinhaProduto[],
  ) => {
    const { data, error: rpcError } = await supabase.rpc('movelaria_criar_markup_orcamento_lead', {
      p_lead_id: leadId,
      p_titulo: titulo,
      p_linhas: linhas,
    })
    if (rpcError) throw new Error(rpcError.message)
    const orcamentoId = String(data)
    setItensByLead(prev => {
      const next = new Map(prev)
      next.set(leadId, {
        lead_id: leadId,
        orcamento_id: orcamentoId,
        titulo,
        custo_materiais: linhas.reduce((s, l) => s + (l.ativo ? l.valor_total : 0), 0),
        custo_servicos: 0,
        custo_despesas: 0,
        preco_final: 0,
        linhas,
      })
      return next
    })
    return orcamentoId
  }, [])

  return { itensByLead, loading, error, reload: load, saveLinhas, createOrcamento }
}
