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
 * O ícone permanece sempre na tela; o clique só abre/fecha o histórico.
 */
export function FloatingProjetoChatShell() {
  const { totalUnread, threads: unreadThreads, lastReadByLead } = useProjetoChatUnread({
    realtime: true,
  })
  const [isOpen, setIsOpen] = useState(false)

  const unreadCountByLead = unreadThreads.reduce<Record<number, number>>((acc, thread) => {
    acc[thread.lead_id] = thread.unreadCount
    return acc
  }, {})

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
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
          onClick={() => setIsOpen((open) => !open)}
          isActive={isOpen}
        />
      </div>

      <FloatingProjetoChatPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        unreadCountByLead={unreadCountByLead}
        lastReadByLead={lastReadByLead}
      />
    </>,
    document.body,
  )
}
