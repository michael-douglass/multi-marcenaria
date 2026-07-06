import { AlertTriangle } from 'lucide-react'

interface ObraPedidoMaterialAlertProps {
  count: number
  compact?: boolean
  active?: boolean
  onClick?: () => void
}

/** Alerta: obras ativas sem pedido de material confirmado. */
export function ObraPedidoMaterialAlert({
  count,
  compact = false,
  active = false,
  onClick,
}: ObraPedidoMaterialAlertProps) {
  if (count <= 0) return null

  const className = [
    'inline-flex items-center gap-1.5 rounded-full border font-semibold text-[#fbbf24]',
    active
      ? 'border-[rgba(245,158,11,0.65)] bg-[rgba(245,158,11,0.24)] ring-1 ring-[rgba(245,158,11,0.35)]'
      : 'border-[rgba(245,158,11,0.38)] bg-[rgba(245,158,11,0.12)]',
    compact ? 'px-2.5 py-1 text-[0.68rem]' : 'px-3 py-2 text-[0.78rem] rounded-lg',
    onClick ? 'cursor-pointer transition-colors hover:bg-[rgba(245,158,11,0.2)]' : '',
  ].join(' ')

  const title = active
    ? 'Mostrando só obras sem pedido — clique para ver todas'
    : 'Clique para ver só obras sem pedido de material'

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        title={title}
        aria-pressed={active}
      >
        <AlertTriangle size={compact ? 14 : 16} className="shrink-0" aria-hidden />
        <span>{count} sem pedido</span>
      </button>
    )
  }

  return (
    <div className={className} role="status" title="Obras ativas aguardando confirmação de pedido de material">
      <AlertTriangle size={compact ? 14 : 16} className="shrink-0" aria-hidden />
      <span>{count} sem pedido</span>
    </div>
  )
}
