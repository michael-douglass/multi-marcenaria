import { PackageCheck } from 'lucide-react'
import type { ObraFull } from '@/types'

interface ObraPedidoMaterialBadgeProps {
  obra: Pick<ObraFull, 'pedido_material_feito'>
  compact?: boolean
}

/** Selo exibido quando o pedido de material já foi feito. */
export function ObraPedidoMaterialBadge({ obra, compact }: ObraPedidoMaterialBadgeProps) {
  if (!obra.pedido_material_feito) return null

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide shrink-0',
        'bg-[rgba(34,197,94,0.14)] text-[#4ade80] border border-[rgba(34,197,94,0.35)]',
        compact ? 'px-1.5 py-0.5 text-[0.52rem]' : 'px-2 py-0.5 text-[0.58rem]',
      ].join(' ')}
      title="Pedido de material confirmado"
    >
      <PackageCheck size={compact ? 9 : 11} className="shrink-0" />
      <span>{compact ? 'Pedido' : 'Pedido feito'}</span>
    </span>
  )
}
