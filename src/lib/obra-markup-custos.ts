import { obraPrecisaPedidoMaterial } from '@/lib/obra-pedido-material'
import type { MarkupCustosFiltro, MarkupOrcamentoCustos, ObraFull } from '@/types'

export const MARKUP_CUSTOS_FILTRO_DEFAULT: MarkupCustosFiltro = {
  materiais: true,
  servicos: true,
  despesas: true,
}

export const MARKUP_CUSTOS_FILTRO_STORAGE_KEY = 'agenda-obras-markup-custos-filtro'

export function collectObraLeadIds(obras: Pick<ObraFull, 'origem_lead_id'>[]): string[] {
  const ids = new Set<string>()
  for (const obra of obras) {
    const leadId = obra.origem_lead_id?.trim()
    if (leadId) ids.add(leadId)
  }
  return [...ids]
}

export function getObraMarkupCustos(
  obra: Pick<ObraFull, 'origem_lead_id'>,
  custosByLead: ReadonlyMap<string, MarkupOrcamentoCustos>,
): MarkupOrcamentoCustos | null {
  const leadId = obra.origem_lead_id?.trim()
  if (!leadId) return null
  return custosByLead.get(leadId) ?? null
}

/** Soma custos das obras ativas sem pedido — respeita o filtro de categorias. */
export function sumPedidoAFazerCustos(
  obras: ObraFull[],
  custosByLead: ReadonlyMap<string, MarkupOrcamentoCustos>,
  filtro: MarkupCustosFiltro,
): number {
  let total = 0
  for (const obra of obras) {
    if (!obraPrecisaPedidoMaterial(obra)) continue
    const custos = getObraMarkupCustos(obra, custosByLead)
    if (!custos) continue
    if (filtro.materiais) total += Number(custos.custo_materiais) || 0
    if (filtro.servicos) total += Number(custos.custo_servicos) || 0
    if (filtro.despesas) total += Number(custos.custo_despesas) || 0
  }
  return total
}

export interface MarkupCustoLinha {
  key: 'materiais' | 'servicos' | 'despesas' | 'total'
  label: string
  valor: number
}

/** Linhas visíveis no card conforme filtro + total (soma das categorias ligadas). */
export function buildMarkupCustoLinhas(
  custos: MarkupOrcamentoCustos,
  filtro: MarkupCustosFiltro,
): MarkupCustoLinha[] {
  const linhas: MarkupCustoLinha[] = []
  let total = 0

  if (filtro.materiais) {
    const valor = Number(custos.custo_materiais) || 0
    linhas.push({ key: 'materiais', label: 'Materiais', valor })
    total += valor
  }
  if (filtro.servicos) {
    const valor = Number(custos.custo_servicos) || 0
    linhas.push({ key: 'servicos', label: 'Serviços', valor })
    total += valor
  }
  if (filtro.despesas) {
    const valor = Number(custos.custo_despesas) || 0
    linhas.push({ key: 'despesas', label: 'Despesas', valor })
    total += valor
  }

  if (linhas.length === 0) return []

  linhas.push({ key: 'total', label: 'Total', valor: total })
  return linhas
}

export function parseMarkupCustosFiltro(raw: unknown): MarkupCustosFiltro {
  if (!raw || typeof raw !== 'object') return { ...MARKUP_CUSTOS_FILTRO_DEFAULT }
  const obj = raw as Record<string, unknown>
  return {
    materiais: obj.materiais !== false,
    servicos: obj.servicos !== false,
    despesas: obj.despesas !== false,
  }
}

export function loadMarkupCustosFiltro(): MarkupCustosFiltro {
  try {
    const raw = localStorage.getItem(MARKUP_CUSTOS_FILTRO_STORAGE_KEY)
    if (!raw) return { ...MARKUP_CUSTOS_FILTRO_DEFAULT }
    return parseMarkupCustosFiltro(JSON.parse(raw))
  } catch {
    return { ...MARKUP_CUSTOS_FILTRO_DEFAULT }
  }
}

export function saveMarkupCustosFiltro(filtro: MarkupCustosFiltro): void {
  try {
    localStorage.setItem(MARKUP_CUSTOS_FILTRO_STORAGE_KEY, JSON.stringify(filtro))
  } catch {
    // ignore quota / private mode
  }
}

export function mapMarkupCustosRows(
  rows: Array<{
    lead_id: string
    custo_materiais: number | string | null
    custo_servicos: number | string | null
    custo_despesas: number | string | null
    preco_final: number | string | null
  }> | null | undefined,
): Map<string, MarkupOrcamentoCustos> {
  const map = new Map<string, MarkupOrcamentoCustos>()
  for (const row of rows ?? []) {
    const leadId = String(row.lead_id)
    map.set(leadId, {
      lead_id: leadId,
      custo_materiais: Number(row.custo_materiais) || 0,
      custo_servicos: Number(row.custo_servicos) || 0,
      custo_despesas: Number(row.custo_despesas) || 0,
      preco_final: Number(row.preco_final) || 0,
    })
  }
  return map
}
