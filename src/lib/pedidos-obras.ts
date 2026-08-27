import { obraPrecisaPedidoMaterial } from '@/lib/obra-pedido-material'
import type {
  MarkupCatalogoProduto,
  MarkupLinhaProduto,
  MarkupOrcamentoItens,
  ObraFull,
  Pedido,
} from '@/types'

export type PedidoColunaId = 'a_fazer' | 'preco_feito' | 'enviado'

export interface PedidoObraCardModel {
  obra: ObraFull
  markup: MarkupOrcamentoItens | null
  pedido: Pedido | null
  coluna: PedidoColunaId
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

export function parseMarkupLinhas(raw: unknown): MarkupLinhaProduto[] {
  if (!Array.isArray(raw)) return []
  return raw.map(item => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const quantidade = asNumber(row.quantidade)
    const valorUnitario = asNumber(row.valor_unitario)
    const valorTotal = asNumber(row.valor_total, quantidade * valorUnitario)
    return {
      produto_id: row.produto_id ? String(row.produto_id) : null,
      descricao: asText(row.descricao) || 'Item',
      variacao: asText(row.variacao) || null,
      unidade: asText(row.unidade) || 'un',
      categoria: asText(row.categoria) || null,
      quantidade,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
      ativo: row.ativo !== false,
    }
  })
}

export function linhasAtivas(linhas: MarkupLinhaProduto[]): MarkupLinhaProduto[] {
  return linhas.filter(linha => linha.ativo)
}

export function sumLinhasMarkup(linhas: MarkupLinhaProduto[]): number {
  return linhasAtivas(linhas).reduce((acc, linha) => acc + asNumber(linha.valor_total), 0)
}

export function itemLabel(linha: Pick<MarkupLinhaProduto, 'descricao' | 'variacao' | 'categoria'>): string {
  const parts = [linha.descricao]
  if (linha.variacao) parts.push(linha.variacao)
  return parts.filter(Boolean).join(' · ')
}

export function linhaFromCatalogo(produto: MarkupCatalogoProduto): MarkupLinhaProduto {
  const quantidade = produto.quantidade_padrao && produto.quantidade_padrao > 0
    ? produto.quantidade_padrao
    : 1
  const valorUnitario = Number(produto.preco_unitario) || 0
  return {
    produto_id: produto.id,
    descricao: produto.nome,
    variacao: produto.variacao,
    unidade: produto.unidade || 'un',
    categoria: produto.categoria_nome,
    quantidade,
    valor_unitario: valorUnitario,
    valor_total: quantidade * valorUnitario,
    ativo: true,
  }
}

export function linhaMarkupAvulsa(
  descricao: string,
  quantidade: number,
  valorUnitario: number,
  unidade = 'un',
): MarkupLinhaProduto {
  const qtd = Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1
  const unit = Number.isFinite(valorUnitario) ? valorUnitario : 0
  return {
    produto_id: null,
    descricao: descricao.trim() || 'Item',
    variacao: null,
    unidade: unidade.trim() || 'un',
    categoria: null,
    quantidade: qtd,
    valor_unitario: unit,
    valor_total: qtd * unit,
    ativo: true,
  }
}

export function mapMarkupItensRows(rows: unknown): Map<string, MarkupOrcamentoItens> {
  const map = new Map<string, MarkupOrcamentoItens>()
  if (!Array.isArray(rows)) return map
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const leadId = asText(r.lead_id)
    if (!leadId) continue
    map.set(leadId, {
      lead_id: leadId,
      orcamento_id: asText(r.orcamento_id),
      titulo: asText(r.titulo) || null,
      custo_materiais: asNumber(r.custo_materiais),
      custo_servicos: asNumber(r.custo_servicos),
      custo_despesas: asNumber(r.custo_despesas),
      preco_final: asNumber(r.preco_final),
      linhas: parseMarkupLinhas(r.linhas),
    })
  }
  return map
}

export function pedidosPorObra(pedidos: Pedido[]): Map<string, Pedido> {
  const map = new Map<string, Pedido>()
  for (const pedido of pedidos) {
    if (!pedido.obra_id) continue
    if (pedido.status === 'recusado') continue
    map.set(pedido.obra_id, pedido)
  }
  return map
}

export function colunaDoCard(obra: ObraFull, pedido: Pedido | null): PedidoColunaId | null {
  if (pedido?.status === 'aprovado') return 'enviado'
  if (pedido?.status === 'aguardando_aprovacao') return 'preco_feito'
  if (obraPrecisaPedidoMaterial(obra)) return 'a_fazer'
  return null
}

export function montarCardsPedidos(
  obras: ObraFull[],
  itensByLead: ReadonlyMap<string, MarkupOrcamentoItens>,
  pedidos: Pedido[],
): PedidoObraCardModel[] {
  const byObra = pedidosPorObra(pedidos)
  const cards: PedidoObraCardModel[] = []
  for (const obra of obras) {
    const pedido = byObra.get(obra.id) ?? null
    const coluna = colunaDoCard(obra, pedido)
    if (!coluna) continue
    const leadId = obra.origem_lead_id?.trim() ?? ''
    cards.push({
      obra,
      markup: leadId ? itensByLead.get(leadId) ?? null : null,
      pedido,
      coluna,
    })
  }
  return cards
}

export function totalMarkupDoCard(card: PedidoObraCardModel): number {
  if (card.markup) {
    const somaLinhas = sumLinhasMarkup(card.markup.linhas)
    if (somaLinhas > 0) return somaLinhas
    return asNumber(card.markup.custo_materiais)
  }
  return 0
}

export function totalPrecoFeito(pedido: Pedido | null): number {
  if (!pedido) return 0
  const itens = pedido.movelaria_pedidos_itens ?? []
  if (itens.length) {
    return itens.reduce((acc, item) => acc + asNumber(item.valor_total), 0)
  }
  return asNumber(pedido.total)
}

export const PEDIDO_COLUNAS: Array<{
  id: PedidoColunaId
  title: string
  hint: string
  color: string
}> = [
  {
    id: 'a_fazer',
    title: 'Pedidos a fazer',
    hint: 'Materiais ainda sem compra',
    color: '#fbbf24',
  },
  {
    id: 'preco_feito',
    title: 'Preço feito',
    hint: 'NF e aprovação de compra',
    color: '#60a5fa',
  },
  {
    id: 'enviado',
    title: 'Enviado a pagar',
    hint: 'Já está em Contas a Pagar',
    color: '#4ade80',
  },
]
