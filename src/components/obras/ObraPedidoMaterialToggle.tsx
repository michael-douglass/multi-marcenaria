import { useId } from 'react'
import { Loader2 } from 'lucide-react'
import type { ObraFull } from '@/types'

interface ObraPedidoMaterialToggleProps {
  obra: Pick<ObraFull, 'pedido_material_feito'>
  canEdit: boolean
  loading?: boolean
  onChange: (feito: boolean) => void
  compact?: boolean
}

/** Confirmação de pedido de material — checkbox no card da obra. */
export function ObraPedidoMaterialToggle({
  obra,
  canEdit,
  loading = false,
  onChange,
  compact = false,
}: ObraPedidoMaterialToggleProps) {
  const inputId = useId()

  return (
    <label
      className={[
        'flex items-start gap-2 rounded-md border transition-colors min-w-0',
        obra.pedido_material_feito
          ? 'border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.08)]'
          : 'border-[rgba(212,168,83,0.18)] bg-[rgba(255,255,255,0.02)]',
        compact ? 'p-1.5' : 'p-2',
        canEdit && !loading ? 'cursor-pointer hover:border-[rgba(212,168,83,0.35)]' : 'cursor-default',
      ].join(' ')}
      onClick={e => e.stopPropagation()}
      title="Confirmação de pedido de material feito"
    >
      {loading ? (
        <Loader2 size={compact ? 12 : 14} className="animate-spin shrink-0 text-[#d4a853] mt-0.5" />
      ) : (
        <input
          id={inputId}
          type="checkbox"
          className="mt-0.5 shrink-0 accent-[#4ade80]"
          checked={obra.pedido_material_feito ?? false}
          disabled={!canEdit || loading}
          onChange={e => onChange(e.target.checked)}
          onClick={e => e.stopPropagation()}
        />
      )}
      <span className={`leading-snug text-[#f4e4d6] ${compact ? 'text-[0.62rem]' : 'text-[0.68rem]'}`}>
        Pedido de material feito
      </span>
    </label>
  )
}
