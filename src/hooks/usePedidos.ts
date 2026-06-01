import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Pedido, PedidoItem, PedidoStatus } from '../types'
import { todayISO } from '../lib/utils'
import { useAutoRefresh } from './useAutoRefresh'

interface NewItemInput {
  produto_id: string
  quantidade: number
  valor_unitario: number
  valor_total: number
}

export function usePedidos() {
  const [data, setData] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await supabase
      .from('movelaria_pedidos')
      .select(`
        *,
        movelaria_fornecedores(id, nome),
        movelaria_pedidos_itens(
          id, pedido_id, produto_id, quantidade, valor_unitario, valor_total,
          movelaria_produtos(id, descricao, unidade_medida)
        )
      `)
      .order('criado_em', { ascending: false })
    if (err) setError(err.message)
    else setData(rows ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  const create = async (
    fornecedor_id: string,
    itens: NewItemInput[],
    total: number,
  ): Promise<Pedido> => {
    const { data: pedido, error: err1 } = await supabase
      .from('movelaria_pedidos')
      .insert({ fornecedor_id, status: 'aguardando_aprovacao', total, data_pedido: todayISO() })
      .select()
      .single()
    if (err1) throw new Error(err1.message)

    const itensCom = itens.map(i => ({ ...i, pedido_id: pedido.id }))
    const { error: err2 } = await supabase.from('movelaria_pedidos_itens').insert(itensCom)
    if (err2) throw new Error(err2.message)

    await load()
    return pedido
  }

  const updateStatus = async (id: string, status: PedidoStatus) => {
    const { error: err } = await supabase
      .from('movelaria_pedidos')
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.map(x => (x.id === id ? { ...x, status } : x)))
  }

  const getItens = (pedidoId: string): PedidoItem[] => {
    const p = data.find(x => x.id === pedidoId)
    return p?.movelaria_pedidos_itens ?? []
  }

  return { data, loading, error, create, updateStatus, getItens, reload: load }
}
