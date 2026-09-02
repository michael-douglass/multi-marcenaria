import { ChevronDown, Copy, Minus, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeadModalWindowMode } from '@/lib/lead-modal-size'

interface LeadModalWindowControlsProps {
  mode: LeadModalWindowMode
  /** Cabeçalho recolhido (por rolagem ou minimizar) */
  headerCollapsed?: boolean
  isMobile: boolean
  onMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
}

/**
 * Controles de janela no estilo Windows: minimizar/expandir cabeçalho, maximizar, fechar.
 */
export function LeadModalWindowControls({
  mode,
  headerCollapsed = false,
  isMobile,
  onMinimize,
  onToggleMaximize,
  onClose,
}: LeadModalWindowControlsProps) {
  const btn =
    'inline-flex h-7 w-9 sm:h-8 sm:w-10 items-center justify-center rounded-sm text-[color:var(--lead-soft)] transition-colors hover:bg-[color:var(--lead-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lead-gold)]/40'

  const minimizeLabel =
    mode === 'minimized' || headerCollapsed
      ? 'Expandir cabeçalho do lead'
      : 'Recolher cabeçalho do lead'

  return (
    <div
      className={cn(
        'lead-modal-window-controls flex shrink-0 items-stretch overflow-hidden rounded-md border border-[color:var(--lead-line)] bg-[color:var(--lead-panel)]',
        isMobile && 'scale-[0.98]',
      )}
      role="toolbar"
      aria-label="Controles da janela do lead"
    >
      <button
        type="button"
        className={btn}
        title={
          mode === 'minimized' || headerCollapsed
            ? 'Expandir cabeçalho'
            : 'Recolher cabeçalho'
        }
        aria-label={minimizeLabel}
        aria-pressed={headerCollapsed || mode === 'minimized'}
        onClick={onMinimize}
      >
        {mode === 'minimized' || headerCollapsed ? (
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        ) : (
          <Minus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        )}
      </button>
      <button
        type="button"
        className={cn(btn, 'border-l border-[color:var(--lead-line)]')}
        title={mode === 'maximized' ? 'Restaurar tamanho' : 'Maximizar'}
        aria-label={mode === 'maximized' ? 'Restaurar tamanho do card' : 'Maximizar card do lead'}
        onClick={onToggleMaximize}
      >
        {mode === 'maximized' ? (
          <Copy className="h-3.5 w-3.5 rotate-90" strokeWidth={2.25} aria-hidden />
        ) : (
          <Square className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        )}
      </button>
      <button
        type="button"
        className={cn(
          btn,
          'border-l border-[color:var(--lead-line)] text-[color:var(--lead-muted)] hover:bg-destructive/15 hover:text-destructive',
        )}
        title="Fechar"
        aria-label="Fechar card do lead"
        onClick={onClose}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  )
}
