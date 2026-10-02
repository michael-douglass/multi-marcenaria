import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FloatingProjetoChatIcon } from '@/components/layout/FloatingProjetoChatIcon'
import { FloatingProjetoChatPopup } from '@/components/layout/FloatingProjetoChatPopup'
import { useProjetoChatUnread } from '@/hooks/useProjetoChatUnread'
import { useUiPreferences } from '@/hooks/useUiPreferences'
import {
  FLOATING_PROJETO_CHAT_ICON_RIGHT,
  FLOATING_TOP_EDGE,
} from '@/lib/floating-ui-layout'
import { floatingAgendaIconClass, FLOATING_UI_ROOT_ATTR } from '@/lib/overlay-z-index'
import { cn } from '@/lib/utils'

/**
 * Chat do ateliê — ícone flutuante global (ao lado da Agenda).
 * Só aparece com mensagens não lidas (ou com o painel aberto).
 */
export function FloatingProjetoChatShell() {
  const { preferences } = useUiPreferences()
  const hidePopups = preferences.hideFloatingPopups
  const { totalUnread, threads } = useProjetoChatUnread({ realtime: true })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (hidePopups) setIsOpen(false)
  }, [hidePopups])

  if (typeof document === 'undefined') return null
  if (hidePopups) return null
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
