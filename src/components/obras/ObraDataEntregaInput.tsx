import { Calendar } from 'lucide-react'
import { useState, useEffect } from 'react'
import { DateInput } from '@/components/ui/DateInput'
import type { ObraFull } from '@/types'

interface ObraDataEntregaInputProps {
  obra: Pick<ObraFull, 'id' | 'pedido_material_feito' | 'data_entrega_pedido'>
  canEdit: boolean
  loading?: boolean
  onChange: (date: string | null) => void
  compact?: boolean
}

/** Input de data de entrega do pedido — exibido no card da obra quando o pedido está feito. */
export function ObraDataEntregaInput({
  obra,
  canEdit,
  loading = false,
  onChange,
  compact = false,
}: ObraDataEntregaInputProps) {
  const [localDate, setLocalDate] = useState<string | null>(obra.data_entrega_pedido ?? null)

  // Sincroniza estado local se a obra mudar externamente
  useEffect(() => {
    setLocalDate(obra.data_entrega_pedido ?? null)
  }, [obra.data_entrega_pedido])

  if (!obra.pedido_material_feito) return null

  const handleChange = (date: string | null) => {
    setLocalDate(date)
    if (date !== obra.data_entrega_pedido) {
      onChange(date)
    }
  }

  return (
    <div 
      className={[
        'flex items-center gap-1.5 rounded-md border border-[rgba(240,210,140,0.18)] bg-[rgba(255,255,255,0.02)] transition-colors min-w-0',
        compact ? 'p-1.5' : 'p-2',
        canEdit && !loading ? 'hover:border-[rgba(240,210,140,0.35)]' : '',
      ].join(' ')}
      onClick={e => e.stopPropagation()}
    >
      <Calendar size={compact ? 12 : 14} className="text-[#f2d892] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[#edd9c4] text-[0.55rem] uppercase tracking-wider leading-none mb-1">
          Chegada Material
        </p>
        <DateInput
          className="w-full bg-transparent border-none p-0 text-[#fffaf4] text-[0.65rem] focus:ring-0"
          value={localDate}
          disabled={!canEdit || loading}
          onChange={handleChange}
          onClick={e => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
