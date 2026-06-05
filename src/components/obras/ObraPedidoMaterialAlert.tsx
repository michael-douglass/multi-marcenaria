import { AlertTriangle } from 'lucide-react'

interface ObraPedidoMaterialAlertProps {
  count: number
  compact?: boolean
}

/** Alerta: obras ativas sem pedido de material confirmado. */
export function ObraPedidoMaterialAlert({ count, compact = false }: ObraPedidoMaterialAlertProps) {
  if (count <= 0) return null

  return (
    <div
      className={[
        'inline-flex items-center gap-1.5 rounded-full border font-semibold text-[#fbbf24]',
        'border-[rgba(245,158,11,0.38)] bg-[rgba(245,158,11,0.12)]',
        compact ? 'px-2.5 py-1 text-[0.68rem]' : 'px-3 py-2 text-[0.78rem] rounded-lg',
      ].join(' ')}
      role="status"
      title="Obras ativas aguardando confirmação de pedido de material"
    >
      <AlertTriangle size={compact ? 14 : 16} className="shrink-0" aria-hidden />
      <span>
        {count} sem pedido
      </span>
    </div>
  )
}
