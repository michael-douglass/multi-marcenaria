import { createPortal } from 'react-dom';
import { FloatingCalendarIcon } from './FloatingCalendarIcon';
import { FloatingAgendaGeralPopup } from './FloatingAgendaGeralPopup';
import { useAgendaGeral } from '@/hooks/useAgendaGeral';
import type { FloatingAgendaSide } from '@/hooks/useUiPreferences';
import { floatingAgendaIconClass } from '@/lib/overlay-z-index';

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
 */
export function FloatingAgendaGeralShell({
  isOpen,
  onToggle,
  onClose,
  side,
  onSideChange,
}: FloatingAgendaGeralShellProps) {
  const { pendingTodayCount } = useAgendaGeral();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        data-floating-agenda-root
        className={`fixed top-[4rem] right-4 ${floatingAgendaIconClass} pointer-events-auto`}
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
