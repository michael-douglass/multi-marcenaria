import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthReady } from '@/hooks/useAuthReady'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { invalidateCache, OBRAS_CACHE_KEY } from '@/lib/data-cache'
import {
  copyPedidoAnexosToContaPagar,
  deletePedidoAnexo,
  uploadPedidoAnexos,
} from '@/lib/pedidos-obras-anexos'
import { todayISO } from '@/lib/utils'
import type { MarkupLinhaProduto, Pedido, PedidoAnexo, PendingContaPagarAnexo } from '@/types'

const PEDIDO_SELECT = `
  *,
  movelaria_fornecedores(id, nome),
  movelaria_pedidos_itens(
    id, pedido_id, produto_id, markup_produto_id, descricao,
    quantidade, valor_unitario, valor_total,
    valor_unitario_markup, valor_unitario_feito
  ),
  movelaria_pedidos_anexos(
    id, pedido_id, nome_arquivo, tipo_mime, storage_path, preview_path, criado_em
  )
`

export interface PedidoItemDraft {
  markup_produto_id?: string | null
  descricao: string
  quantidade: number
  valor_unitario_markup: number
  valor_unitario_feito: number
}

export interface CriarPedidoObraInput {
  obraId: string
  markupOrcamentoId?: string | null
  fornecedorId: string
  itens: PedidoItemDraft[]
  numParcelas?: number
  primeiroVencimento?: string
  observacao?: string
  anexos?: PendingContaPagarAnexo[]
}

interface GerarParcelasFn {
  (input: {
    pedido_id?: string
    obra_id?: string
    fornecedor_id?: string
    fornecedor_nome?: string
    descricao?: string
    valor_total: number
    num_parcelas: number
    primeiro_vencimento: string
  }): Promise<{ grupo_lancamento_id: string | null }>
}

function linhasParaItens(linhas: MarkupLinhaProduto[], precos?: Record<string, number>): PedidoItemDraft[] {
  return linhas
    .filter(l => l.ativo)
    .map((l, idx) => {
      const key = l.produto_id ?? `${l.descricao}-${idx}`
      const feito = precos?.[key] ?? l.valor_unitario
      return {
        markup_produto_id: l.produto_id ?? null,
        descricao: [l.descricao, l.variacao].filter(Boolean).join(' · '),
        quantidade: l.quantidade,
        valor_unitario_markup: l.valor_unitario,
        valor_unitario_feito: feito,
      }
    })
}

export function draftsFromMarkup(
  linhas: MarkupLinhaProduto[],
  precos?: Record<string, number>,
): PedidoItemDraft[] {
  return linhasParaItens(linhas, precos)
}

export function usePedidosObras() {
  const { isReady } = useAuthReady()
  const [data, setData] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady) return
    if (!opts?.silent) setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('movelaria_pedidos')
      .select(PEDIDO_SELECT)
      .not('obra_id', 'is', null)
      .order('criado_em', { ascending: false })
    if (err) {
      if (!opts?.silent) setError(err.message)
    } else {
      setData((rows ?? []) as Pedido[])
      setError(null)
    }
    if (!opts?.silent) setLoading(false)
  }, [isReady])

  useEffect(() => {
    void load()
  }, [load])
  useAutoRefresh(() => {
    void load({ silent: true })
  })

  const criarPedidoDaObra = useCallback(async (input: CriarPedidoObraInput): Promise<Pedido> => {
    const itens = input.itens.filter(i => i.quantidade > 0)
    if (!itens.length) throw new Error('Inclua pelo menos um item no pedido.')
    if (!input.fornecedorId) throw new Error('Escolha o fornecedor.')

    const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario_feito, 0)

    const { data: pedido, error: err1 } = await supabase
      .from('movelaria_pedidos')
      .insert({
        fornecedor_id: input.fornecedorId,
        obra_id: input.obraId,
        markup_orcamento_id: input.markupOrcamentoId ?? null,
        status: 'aguardando_aprovacao',
        total,
        data_pedido: todayISO(),
        num_parcelas: input.numParcelas ?? 1,
        primeiro_vencimento: input.primeiroVencimento ?? todayISO(),
        observacao: input.observacao?.trim() || null,
      })
      .select()
      .single()
    if (err1) throw new Error(err1.message)

    const { error: err2 } = await supabase.from('movelaria_pedidos_itens').insert(
      itens.map(i => ({
        pedido_id: pedido.id,
        produto_id: null,
        markup_produto_id: i.markup_produto_id ?? null,
        descricao: i.descricao,
        quantidade: i.quantidade,
        valor_unitario: i.valor_unitario_feito,
        valor_total: i.quantidade * i.valor_unitario_feito,
        valor_unitario_markup: i.valor_unitario_markup,
        valor_unitario_feito: i.valor_unitario_feito,
      })),
    )
    if (err2) throw new Error(err2.message)

    const { error: obraErr } = await supabase
      .from('movelaria_obras')
      .update({ pedido_material_feito: true })
      .eq('id', input.obraId)
    if (obraErr) throw new Error(obraErr.message)
    invalidateCache(OBRAS_CACHE_KEY)

    if (input.anexos?.length) {
      await uploadPedidoAnexos(pedido.id, input.anexos)
    }

    await load({ silent: true })
    return pedido as Pedido
  }, [load])

  const anexarNf = useCallback(async (pedidoId: string, anexos: PendingContaPagarAnexo[]) => {
    await uploadPedidoAnexos(pedidoId, anexos)
    await load({ silent: true })
  }, [load])

  const removerAnexo = useCallback(async (anexo: PedidoAnexo) => {
    await deletePedidoAnexo(anexo)
    await load({ silent: true })
  }, [load])

  const atualizarParcelasPrevistas = useCallback(async (
    pedidoId: string,
    numParcelas: number,
    primeiroVencimento: string,
  ) => {
    const { error: err } = await supabase
      .from('movelaria_pedidos')
      .update({
        num_parcelas: numParcelas,
        primeiro_vencimento: primeiroVencimento,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', pedidoId)
    if (err) throw new Error(err.message)
    setData(prev => prev.map(p => (
      p.id === pedidoId
        ? { ...p, num_parcelas: numParcelas, primeiro_vencimento: primeiroVencimento }
        : p
    )))
  }, [])

  const aprovarPedido = useCallback(async (
    pedido: Pedido,
    opts: {
      numParcelas: number
      primeiroVencimento: string
      gerarParcelas: GerarParcelasFn
    },
  ) => {
    const fornecedorNome = pedido.movelaria_fornecedores?.nome ?? ''
    const { grupo_lancamento_id } = await opts.gerarParcelas({
      pedido_id: pedido.id,
      obra_id: pedido.obra_id ?? undefined,
      fornecedor_id: pedido.fornecedor_id ?? undefined,
      fornecedor_nome: fornecedorNome,
      descricao: `Pedido de material — ${fornecedorNome}`,
      valor_total: pedido.total,
      num_parcelas: opts.numParcelas,
      primeiro_vencimento: opts.primeiroVencimento,
    })

    const { error: err } = await supabase
      .from('movelaria_pedidos')
      .update({
        status: 'aprovado',
        num_parcelas: opts.numParcelas,
        primeiro_vencimento: opts.primeiroVencimento,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', pedido.id)
    if (err) throw new Error(err.message)

    const { data: anexosRows, error: anexosErr } = await supabase
      .from('movelaria_pedidos_anexos')
      .select('*')
      .eq('pedido_id', pedido.id)
    if (anexosErr) throw new Error(anexosErr.message)
    if (grupo_lancamento_id && (anexosRows?.length ?? 0) > 0) {
      await copyPedidoAnexosToContaPagar(anexosRows as PedidoAnexo[], grupo_lancamento_id)
    }

    await load({ silent: true })
  }, [load])

  const recusarPedido = useCallback(async (pedido: Pedido) => {
    const { error: err } = await supabase
      .from('movelaria_pedidos')
      .update({ status: 'recusado', atualizado_em: new Date().toISOString() })
      .eq('id', pedido.id)
    if (err) throw new Error(err.message)

    if (pedido.obra_id) {
      await supabase
        .from('movelaria_obras')
        .update({ pedido_material_feito: false })
        .eq('id', pedido.obra_id)
      invalidateCache(OBRAS_CACHE_KEY)
    }
    await load({ silent: true })
  }, [load])

  return {
    data,
    loading,
    error,
    reload: load,
    criarPedidoDaObra,
    anexarNf,
    removerAnexo,
    atualizarParcelasPrevistas,
    aprovarPedido,
    recusarPedido,
  }
}
