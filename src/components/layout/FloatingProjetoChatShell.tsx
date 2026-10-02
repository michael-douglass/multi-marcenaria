import { useState } from 'react'
import { createPortal } from 'react-dom'
import { FloatingProjetoChatIcon } from '@/components/layout/FloatingProjetoChatIcon'
import { FloatingProjetoChatPopup } from '@/components/layout/FloatingProjetoChatPopup'
import { useProjetoChatUnread } from '@/hooks/useProjetoChatUnread'
import {
  FLOATING_PROJETO_CHAT_ICON_RIGHT,
  FLOATING_TOP_EDGE,
} from '@/lib/floating-ui-layout'
import { floatingAgendaIconClass, FLOATING_UI_ROOT_ATTR } from '@/lib/overlay-z-index'
import { cn } from '@/lib/utils'

/**
 * Chat do ateliê — ícone flutuante global (ao lado da Agenda).
 * Mesmo comportamento da Agenda: permanece visível com não lidas,
 * independentemente de “ocultar popups” do dock CRM.
 */
export function FloatingProjetoChatShell() {
  const { totalUnread, threads } = useProjetoChatUnread({ realtime: true })
  const [isOpen, setIsOpen] = useState(false)

  if (typeof document === 'undefined') return null
  if (!isOpen && totalUnread <= 0) return null

  return createPortal(
    <>
      {!isOpen ? (
        <div
          {...{ [FLOATING_UI_ROOT_ATTR]: '' }}
          data-floating-projeto-chat-icon=""
          className={cn(
            'fixed pointer-events-auto',
            FLOATING_TOP_EDGE,
            FLOATING_PROJETO_CHAT_ICON_RIGHT,
            floatingAgendaIconClass,
          )}
        >
          <FloatingProjetoChatIcon
            count={totalUnread}
            onClick={() => setIsOpen(true)}
            isActive={false}
          />
        </div>
      ) : null}

      <FloatingProjetoChatPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        threads={threads}
      />
    </>,
    document.body,
  )
}
