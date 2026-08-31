import { Calculator, ChevronRight } from 'lucide-react'
import { formatarMoedaMarkup } from '@/lib/markup-calculo'
import type { MarkupLeadResumo } from '@/lib/markup-types'
import { cn } from '@/lib/utils'

interface MarkupCardPreviewProps {
  resumo?: MarkupLeadResumo | null
  compact?: boolean
  onClick?: (e: React.MouseEvent) => void
  /** Só exibe valores — vendedor vê o preço, sem abrir a calculadora. */
  readOnly?: boolean
  className?: string
}

export function MarkupCardPreview({
  resumo,
  compact = false,
  onClick,
  readOnly = false,
  className,
}: MarkupCardPreviewProps) {
  if (!resumo || resumo.preco_final <= 0) return null

  const isInteractive = !readOnly && !!onClick

  return (
    <div
      className={cn(
        'lead-markup-chip w-full rounded-md border pointer-events-auto',
        isInteractive && 'transition-colors',
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
        className,
      )}
    >
      {isInteractive ? (
        <button
          type="button"
          onClick={onClick}
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          className="min-w-0 w-full text-left"
        >
          <MarkupPreviewBody resumo={resumo} compact={compact} showChevron />
        </button>
      ) : (
        <div className="min-w-0">
          <MarkupPreviewBody resumo={resumo} compact={compact} showChevron={false} />
        </div>
      )}
    </div>
  )
}

function MarkupPreviewBody({
  resumo,
  compact,
  showChevron,
}: {
  resumo: MarkupLeadResumo
  compact: boolean
  showChevron: boolean
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Calculator className="lead-markup-chip__icon h-3 w-3 shrink-0" />
          <span
            className={cn(
              'lead-markup-chip__label truncate font-semibold tracking-wide',
              compact ? 'text-[10px]' : 'text-xs',
            )}
          >
            Markup
          </span>
        </div>
        {showChevron && <ChevronRight className="lead-markup-chip__icon h-3 w-3 shrink-0 opacity-80" />}
      </div>
      <div
        className={cn(
          'lead-markup-chip__value mt-0.5 font-semibold',
          compact ? 'text-[11px]' : 'text-sm',
        )}
      >
        {formatarMoedaMarkup(resumo.preco_final)}
      </div>
      {!compact && resumo.titulo && (
        <div className="lead-markup-chip__hint mt-0.5 truncate text-[10px]">{resumo.titulo}</div>
      )}
    </>
  )
}
