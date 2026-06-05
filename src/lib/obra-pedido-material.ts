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
