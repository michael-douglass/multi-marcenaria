import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp, Lock, Pin } from 'lucide-react'
import type { AgendaHeaderLockMode } from '@/lib/agenda-header-prefs-storage'
import { cn } from '@/lib/utils'

interface AgendaHeaderCollapseProps {
  title: string
  subtitle?: ReactNode
  expanded: boolean
  lockMode: AgendaHeaderLockMode
  /** Quando false, o chip "Auto 5s" some (ciclo pausado nesta tela). */
  autoCycleActive?: boolean
  onToggle: () => void
  onLockModeChange: (mode: AgendaHeaderLockMode) => void
  children: ReactNode
}

/**
 * Envolve o cabeçalho da Agenda (KPIs + título + ações).
 * Barra compacta sempre visível; conteúdo completo sobe/desce conforme a preferência.
 */
export function AgendaHeaderCollapse({
  title,
  subtitle,
  expanded,
  lockMode,
  autoCycleActive = lockMode === 'auto',
  onToggle,
  onLockModeChange,
  children,
}: AgendaHeaderCollapseProps) {
  return (
    <div
      className={cn(
        'agenda-header-collapse',
        expanded && 'agenda-header-collapse--expanded',
        `agenda-header-collapse--${lockMode}`,
      )}
    >
      <div className="agenda-header-collapse__bar">
        <button
          type="button"
          className="agenda-header-collapse__summary"
          onClick={onToggle}
          aria-expanded={expanded}
          title={expanded ? 'Recolher cabeçalho' : 'Expandir cabeçalho'}
        >
          <span className="agenda-header-collapse__title">{title}</span>
          {subtitle != null && (
            <span className="agenda-header-collapse__subtitle">{subtitle}</span>
          )}
          {autoCycleActive && (
            <span className="agenda-header-collapse__mode-chip" title="Abre sozinho a cada 5 segundos">
              Auto 5s
            </span>
          )}
        </button>

        <div className="agenda-header-collapse__controls" role="group" aria-label="Travar cabeçalho">
          <button
            type="button"
            className={cn(
              'agenda-header-collapse__btn',
              lockMode === 'open' && 'agenda-header-collapse__btn--active',
            )}
            onClick={() => onLockModeChange(lockMode === 'open' ? 'auto' : 'open')}
            aria-pressed={lockMode === 'open'}
            title={
              lockMode === 'open'
                ? 'Destravar — volta ao automático (abre a cada 5s)'
                : 'Travar sempre aberto'
            }
            aria-label={lockMode === 'open' ? 'Destravar cabeçalho' : 'Travar cabeçalho aberto'}
          >
            <Pin size={13} aria-hidden />
            <span className="agenda-header-collapse__btn-label">Aberto</span>
          </button>

          <button
            type="button"
            className={cn(
              'agenda-header-collapse__btn',
              lockMode === 'closed' && 'agenda-header-collapse__btn--active',
            )}
            onClick={() => onLockModeChange(lockMode === 'closed' ? 'auto' : 'closed')}
            aria-pressed={lockMode === 'closed'}
            title={
              lockMode === 'closed'
                ? 'Destravar — volta ao automático (abre a cada 5s)'
                : 'Travar sempre fechado'
            }
            aria-label={lockMode === 'closed' ? 'Destravar cabeçalho' : 'Travar cabeçalho fechado'}
          >
            <Lock size={13} aria-hidden />
            <span className="agenda-header-collapse__btn-label">Fechado</span>
          </button>

          <button
            type="button"
            className="agenda-header-collapse__btn agenda-header-collapse__btn--toggle"
            onClick={onToggle}
            aria-expanded={expanded}
            title={expanded ? 'Recolher agora' : 'Expandir agora'}
            aria-label={expanded ? 'Recolher cabeçalho' : 'Expandir cabeçalho'}
          >
            {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          'agenda-header-collapse__panel',
          !expanded && 'agenda-header-collapse__panel--hidden',
        )}
        aria-hidden={!expanded}
      >
        {children}
      </div>
    </div>
  )
}
