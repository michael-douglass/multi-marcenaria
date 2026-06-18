import { Banknote } from 'lucide-react'
import {
  getObraComissaoItensVisiveis,
  sumObraComissao,
  formatComissaoStripLabel,
} from '@/lib/obra-comissao'
import { fmtCur } from '@/lib/utils'
import type { ObraFull } from '@/types'

interface ObraComissaoStripProps {
  obra: ObraFull
  prestadorId?: string | null
  showAll?: boolean
  /** default = faixa da agenda; compact = célula da semana; prominent = destaque no calendário dia */
  variant?: 'default' | 'compact' | 'prominent'
}

function comissaoStatusLabel(obra: ObraFull): string {
  if (obra.comissao_gerada) return 'Aguardando pagamento'
  if (obra.status_kanban === 'concluida' || obra.finalizado_em) return 'A gerar'
  return 'A receber'
}

/** Faixa de comissão — visível fora ou no topo do card, inclusive quando o card está recolhido. */
export function ObraComissaoStrip({
  obra,
  prestadorId,
  showAll = false,
  variant = 'default',
}: ObraComissaoStripProps) {
  const itens = getObraComissaoItensVisiveis(obra, { prestadorId, showAll })
  const total = sumObraComissao(itens)
  const label = formatComissaoStripLabel(itens, fmtCur)
  if (!label || total <= 0) return null

  const status = comissaoStatusLabel(obra)

  if (variant === 'prominent') {
    return (
      <div
        className="obra-comissao-prominent flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg px-3 py-2"
        style={{
          background:
            'linear-gradient(135deg, rgba(240,210,140,0.22) 0%, rgba(240,210,140,0.08) 55%, rgba(68,46,34,0.4) 100%)',
          border: '1px solid rgba(240,210,140,0.38)',
          boxShadow: '0 0 0 1px rgba(240,210,140,0.06) inset, 0 4px 14px rgba(0,0,0,0.18)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
            style={{
              backgroundColor: 'rgba(240,210,140,0.18)',
              border: '1px solid rgba(240,210,140,0.35)',
            }}
          >
            <Banknote size={14} className="text-[#f2d892]" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-[#c4a882]">
              Comissão a receber
            </p>
            <p className="truncate text-[0.62rem] text-[#edd9c4]">{status}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p
            className="font-display text-lg leading-none tracking-wide text-[#f0d48a]"
            style={{ textShadow: '0 0 20px rgba(240,210,140,0.35)' }}
          >
            {fmtCur(total)}
          </p>
          {showAll && itens.length > 1 && (
            <p className="mt-0.5 max-w-[9rem] truncate text-[0.55rem] text-[#edd9c4]">{label}</p>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        className="obra-comissao-compact mb-1 flex w-full min-w-0 items-center gap-1 overflow-hidden rounded px-1.5 py-1"
        style={{
          background:
            'linear-gradient(90deg, rgba(240,210,140,0.2) 0%, rgba(240,210,140,0.06) 100%)',
          border: '1px solid rgba(240,210,140,0.32)',
        }}
      >
        <Banknote size={10} className="shrink-0 text-[#f2d892]" aria-hidden />
        <span className="shrink-0 text-[0.5rem] font-bold uppercase tracking-wider text-[#c4a882]">
          A receber
        </span>
        <span
          className="ml-auto shrink-0 font-display text-[0.78rem] font-semibold leading-none text-[#f0d48a]"
          title={label}
        >
          {fmtCur(total)}
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.62rem] leading-snug"
      style={{
        backgroundColor: 'rgba(240,210,140,0.1)',
        border: '1px solid rgba(240,210,140,0.22)',
        color: '#f2d892',
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
