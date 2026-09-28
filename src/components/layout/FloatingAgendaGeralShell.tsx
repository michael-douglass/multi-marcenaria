import { createPortal } from 'react-dom';
import { FloatingCalendarIcon } from './FloatingCalendarIcon';
import { FloatingAgendaGeralPopup } from './FloatingAgendaGeralPopup';
import { useAgendaGeral } from '@/hooks/useAgendaGeral';
import type { FloatingAgendaSide } from '@/hooks/useUiPreferences';
import {
  FLOATING_AGENDA_ICON_RIGHT,
  FLOATING_TOP_EDGE,
} from '@/lib/floating-ui-layout';
import { floatingAgendaIconClass } from '@/lib/overlay-z-index';
import { cn } from '@/lib/utils';

interface FloatingAgendaGeralShellProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  side: FloatingAgendaSide;
  onSideChange: (side: FloatingAgendaSide) => void;
}

/**
 * Agenda Geral sempre visível em todas as páginas com MainLayout.
 * Renderizado via portal no body para não ser cortado pelo layout da sidebar.
 * Ícone fica na faixa mais alta da tela (junto ao Saldo do mês).
 */
export function FloatingAgendaGeralShell({
  isOpen,
  onToggle,
  onClose,
  side,
  onSideChange,
}: FloatingAgendaGeralShellProps) {
  // Contador do ícone flutuante = só pendências da própria titularidade.
  const { pendingTodayCount } = useAgendaGeral({ forceOwnTitular: true });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        data-floating-agenda-root
        data-floating-agenda-icon=""
        className={cn(
          'fixed pointer-events-auto',
          FLOATING_TOP_EDGE,
          FLOATING_AGENDA_ICON_RIGHT,
          floatingAgendaIconClass,
        )}
      >
        <FloatingCalendarIcon
          count={pendingTodayCount}
          onClick={onToggle}
          isActive={isOpen}
        />
      </div>

      <FloatingAgendaGeralPopup
        isOpen={isOpen}
        onClose={onClose}
        side={side}
        onSideChange={onSideChange}
        pendingCount={pendingTodayCount}
      />
    </>,
    document.body,
  );
}
