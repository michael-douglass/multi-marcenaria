import { Hash } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ObraFull } from '@/types'

interface ObraNumeroPedidoCortClaudInputProps {
  obra: Pick<ObraFull, 'id' | 'pedido_material_feito' | 'numero_pedido_cort_claud'>
  canEdit: boolean
  loading?: boolean
  onChange: (numero: string | null) => void
  compact?: boolean
}

/** Número do pedido no Cort Claud — exibido nos modais de detalhe/edição da obra. */
export function ObraNumeroPedidoCortClaudInput({
  obra,
  canEdit,
  loading = false,
  onChange,
  compact = false,
}: ObraNumeroPedidoCortClaudInputProps) {
  const [localValue, setLocalValue] = useState<string>(obra.numero_pedido_cort_claud ?? '')

  useEffect(() => {
    setLocalValue(obra.numero_pedido_cort_claud ?? '')
  }, [obra.numero_pedido_cort_claud])

  if (!obra.pedido_material_feito) return null

  const handleBlur = () => {
    const val = localValue.trim() || null
    if (val !== (obra.numero_pedido_cort_claud?.trim() || null)) {
      onChange(val)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div
      className={[
        'flex items-center gap-1.5 rounded-md border border-[rgba(212,168,83,0.18)] bg-[rgba(255,255,255,0.02)] transition-colors min-w-0',
        compact ? 'p-1.5' : 'p-2',
        canEdit && !loading ? 'hover:border-[rgba(212,168,83,0.35)]' : '',
      ].join(' ')}
      onClick={e => e.stopPropagation()}
    >
      <Hash size={compact ? 12 : 14} className="text-[#d4a853] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[#8a6a55] text-[0.55rem] uppercase tracking-wider leading-none mb-1">
          Nº Pedido Cort Claud
        </p>
        <input
          type="text"
          className="w-full bg-transparent border-none p-0 text-[#f4e4d6] text-[0.65rem] focus:ring-0 placeholder:text-[#6b5544] disabled:cursor-default"
          value={localValue}
          disabled={!canEdit || loading}
          placeholder="Ex: 12345"
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={e => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
