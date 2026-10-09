import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  FLOATING_AGENDA_ICON_RIGHT,
  FLOATING_ICONS_TOGGLE_TOP,
  FLOATING_TOP_EDGE,
} from '@/lib/floating-ui-layout'
import { floatingAgendaIconClass, FLOATING_UI_ROOT_ATTR } from '@/lib/overlay-z-index'
import { cn } from '@/lib/utils'

interface FloatingIconsToggleProps {
  isCollapsed: boolean
  onToggle: () => void
}

/**
 * Minimiza/mostra a faixa de ícones flutuantes do topo (Agenda, Chat do ateliê, Saldo).
 * Expandido: fica logo abaixo da Agenda. Minimizado: ocupa o lugar da Agenda.
 */
export function FloatingIconsToggle({ isCollapsed, onToggle }: FloatingIconsToggleProps) {
  if (typeof document === 'undefined') return null

  const label = isCollapsed ? 'Mostrar ícones flutuantes' : 'Minimizar ícones flutuantes'

  return createPortal(
    <div
      {...{ [FLOATING_UI_ROOT_ATTR]: '' }}
      className={cn(
        'fixed pointer-events-auto flex w-14 justify-center',
        isCollapsed ? FLOATING_TOP_EDGE : FLOATING_ICONS_TOGGLE_TOP,
        FLOATING_AGENDA_ICON_RIGHT,
        floatingAgendaIconClass,
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-expanded={!isCollapsed}
        title={label}
        className={cn(
          'flex items-center justify-center rounded-full border border-[rgba(240,210,140,0.45)]',
          'bg-gradient-to-br from-[rgba(20,8,4,0.95)] to-[rgba(8,3,1,0.95)] text-[#f2d892]',
          'shadow-[0_4px_14px_rgba(0,0,0,0.4)] transition-all hover:scale-105 hover:text-[#f5e0a8]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(240,210,140,0.55)]',
          isCollapsed ? 'h-9 w-9' : 'h-6 w-10',
        )}
      >
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </div>,
    document.body,
  )
}
