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
 * No celular os alvos de toque ficam maiores (≥44px) e acima da camada de redimensionar.
 */
export function LeadModalWindowControls({
  mode,
  headerCollapsed = false,
  isMobile,
  onMinimize,
  onToggleMaximize,
  onClose,
}: LeadModalWindowControlsProps) {
  const btn = cn(
    'inline-flex items-center justify-center rounded-sm text-[color:var(--lead-soft)] transition-colors',
    'hover:bg-[color:var(--lead-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lead-gold)]/40',
    isMobile ? 'h-11 min-w-[2.75rem] px-2' : 'h-7 w-9 sm:h-8 sm:w-10',
  )

  const iconClass = isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'
  const squareClass = isMobile ? 'h-3.5 w-3.5' : 'h-3 w-3'

  const minimizeLabel =
    mode === 'minimized' || headerCollapsed
      ? 'Expandir cabeçalho do lead'
      : 'Recolher cabeçalho do lead'

  return (
    <div
      className={cn(
        'lead-modal-window-controls relative z-40 flex shrink-0 items-stretch overflow-hidden rounded-md border border-[color:var(--lead-line)] bg-[color:var(--lead-panel)]',
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
          <ChevronDown className={iconClass} strokeWidth={2.5} aria-hidden />
        ) : (
          <Minus className={iconClass} strokeWidth={2.5} aria-hidden />
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
          <Copy className={cn(iconClass, 'rotate-90')} strokeWidth={2.25} aria-hidden />
        ) : (
          <Square className={squareClass} strokeWidth={2.5} aria-hidden />
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
        <X className={iconClass} strokeWidth={2.25} />
      </button>
    </div>
  )
}
