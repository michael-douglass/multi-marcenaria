import { User } from 'lucide-react'
import type { ObraFull } from '@/types'
import { formatObraMontadoresLabel, getObraMontadorNomes } from '@/lib/obra-montadores'
import { getMontadorResponsavelDisplay } from '@/lib/obra-montador'

interface ObraMontadorBadgeProps {
  obra: Pick<
    ObraFull,
    | 'montador_id'
    | 'montador_nome'
    | 'montador_ids'
    | 'montador_nomes'
    | 'montador_admin_id'
    | 'montador_admin_nome'
  >
  compact?: boolean
}

/** Etiqueta dos montadores responsáveis pela obra. */
export function ObraMontadorBadge({ obra, compact }: ObraMontadorBadgeProps) {
  const nomes = getObraMontadorNomes(obra)
  const nome = formatObraMontadoresLabel(nomes, compact) ?? getMontadorResponsavelDisplay(obra)
  if (!nome) return null

  const titulo = nomes.length > 0
    ? `Montadores: ${nomes.join(', ')}`
    : `Montador responsável: ${nome}`

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full font-medium min-w-0 max-w-full',
        'bg-[rgba(212,168,83,0.12)] text-[#d4a853] border border-[rgba(212,168,83,0.25)]',
        compact ? 'px-1.5 py-0.5 text-[0.55rem]' : 'px-2 py-0.5 text-[0.65rem]',
      ].join(' ')}
      title={titulo}
    >
      <User size={compact ? 8 : 10} className="shrink-0" />
      <span className="truncate min-w-0">{nome}</span>
    </span>
  )
}
