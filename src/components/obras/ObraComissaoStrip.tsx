import { Banknote } from 'lucide-react'
import { getObraComissaoItensVisiveis, formatComissaoStripLabel } from '@/lib/obra-comissao'
import { fmtCur } from '@/lib/utils'
import type { ObraFull } from '@/types'

interface ObraComissaoStripProps {
  obra: ObraFull
  prestadorId?: string | null
  showAll?: boolean
}

/** Faixa externa ao card com valores de comissão por prestador. */
export function ObraComissaoStrip({ obra, prestadorId, showAll = false }: ObraComissaoStripProps) {
  const itens = getObraComissaoItensVisiveis(obra, { prestadorId, showAll })
  const label = formatComissaoStripLabel(itens, fmtCur)
  if (!label) return null

  return (
    <div
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.62rem] leading-snug"
      style={{
        backgroundColor: 'rgba(212,168,83,0.1)',
        border: '1px solid rgba(212,168,83,0.22)',
        color: '#d4a853',
      }}
    >
      <Banknote size={11} className="shrink-0 opacity-80" aria-hidden />
      <span className="min-w-0 break-words">{label}</span>
      {obra.comissao_gerada && (
        <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase text-emerald-400">
          Gerado
        </span>
      )}
    </div>
  )
}
