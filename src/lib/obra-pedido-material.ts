import type { ObraFull } from '@/types'

const STATUS_INATIVOS = new Set(['concluida', 'cancelada'])

/** Obra ativa que ainda não teve o pedido de material confirmado. */
export function obraPrecisaPedidoMaterial(obra: Pick<ObraFull, 'status_kanban' | 'pedido_material_feito'>): boolean {
  if (STATUS_INATIVOS.has(obra.status_kanban)) return false
  return !obra.pedido_material_feito
}

export function countObrasSemPedidoMaterial(obras: ObraFull[]): number {
  return obras.filter(obraPrecisaPedidoMaterial).length
}

export function filterObrasSemPedidoMaterial(obras: ObraFull[]): ObraFull[] {
  return obras.filter(obraPrecisaPedidoMaterial)
}

/** Obra ainda não concluída nem cancelada. */
export function obraEmAberto(obra: Pick<ObraFull, 'status_kanban'>): boolean {
  return !STATUS_INATIVOS.has(obra.status_kanban)
}

export function countObrasEmAberto(obras: ObraFull[]): number {
  return obras.filter(obraEmAberto).length
}
