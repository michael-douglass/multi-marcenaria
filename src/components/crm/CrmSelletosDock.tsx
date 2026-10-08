import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MessageNotificationsPopup } from '@/components/layout/MessageNotificationsPopup'
import { WhatsAppNotificationIcon } from '@/components/layout/WhatsAppNotificationIcon'
import { InactivityCheckDialog } from '@/components/layout/InactivityCheckDialog'
import { useLeadNotifications } from '@/hooks/useLeadNotifications'
import { LeadAIAnalysisBackgroundPopup } from '@/components/layout/LeadAIAnalysisBackgroundPopup'
import { OrcamentosIaBackgroundPopup } from '@/components/layout/OrcamentosIaBackgroundPopup'
import { FloatingLeadAIBackgroundIcon } from '@/components/layout/FloatingLeadAIBackgroundIcon'
import { useMessageNotifications } from '@/hooks/useMessageNotifications'
import { useAuth } from '@/contexts/AuthContext'
import { isMarketingOnly } from '@/lib/app-roles'
import { usePresenceTracking } from '@/hooks/usePresenceTracking'
import { useUiPreferences } from '@/hooks/useUiPreferences'
import { floatingIconsPositionClass } from '@/lib/floating-ui-layout'
import { FLOATING_UI_ROOT_ATTR } from '@/lib/overlay-z-index'
import { useSaquePedidosAdminAlert } from '@/hooks/useSaquePedidosAdminAlert'
import { SaquePedidosAdminPopup } from '@/components/layout/SaquePedidosAdminPopup'
import { FloatingSaquePedidosIcon } from '@/components/layout/FloatingSaquePedidosIcon'

/** Dock flutuante do CRM Selletos — só nas rotas comerciais, nunca no Caixa/Obras. */
export function CrmSelletosDock() {
  useLeadNotifications()
  const { preferences } = useUiPreferences()
  const navigate = useNavigate()
  const { isSuperAdmin, userRoles } = useAuth()

  const isMarketingUser = isMarketingOnly(userRoles, isSuperAdmin)

  const messageNotifications = useMessageNotifications()
  const isMessagePopupDisabled = preferences.disableMessageNotificationsPopup
  const isFloatingPopupsHidden = preferences.hideFloatingPopups
  const saqueAlert = useSaquePedidosAdminAlert()

  useEffect(() => {
    if (isMessagePopupDisabled && messageNotifications.isOpen) {
      messageNotifications.closePopup()
    }
  }, [isMessagePopupDisabled, messageNotifications])

  useEffect(() => {
    if (!isFloatingPopupsHidden) return
    messageNotifications.closePopup()
  }, [isFloatingPopupsHidden, messageNotifications])

  const [aiBackgroundMinimized, setAiBackgroundMinimized] = useState({
    minimized: false,
    count: 0,
    activeCount: 0,
  })
  const [aiBackgroundExpandRequest, setAiBackgroundExpandRequest] = useState(0)

  const presenceTracking = usePresenceTracking()

  const handleLeadClick = (leadId: number) => {
    navigate(`/pipeline?id=${leadId}`)
  }

  const handlePhoneClick = (telefone: string) => {
    navigate(`/pipeline?search=${telefone}`)
  }

  const openPopup = () => {
    if (isMessagePopupDisabled || isFloatingPopupsHidden) return
    messageNotifications.setIsOpen(true)
  }

  const showIconsBar =
    (saqueAlert.enabled && saqueAlert.pendentesCount > 0 && !saqueAlert.isPopupOpen) ||
    !isFloatingPopupsHidden

  return (
    <>
      {showIconsBar && typeof document !== 'undefined'
        ? createPortal(
            <div
              {...{ [FLOATING_UI_ROOT_ATTR]: '' }}
              className={`${floatingIconsPositionClass} pointer-events-auto flex flex-row-reverse items-center gap-1`}
            >
              {saqueAlert.enabled &&
                !saqueAlert.isPopupOpen &&
                saqueAlert.pendentesCount > 0 && (
                  <FloatingSaquePedidosIcon
                    count={saqueAlert.pendentesCount}
                    onClick={saqueAlert.openPopup}
                  />
                )}
              {!isFloatingPopupsHidden && !isMarketingUser && !messageNotifications.isOpen && (
                <WhatsAppNotificationIcon
                  count={messageNotifications.notifications.length}
                  onClick={openPopup}
                />
              )}
              {!isMarketingUser &&
                aiBackgroundMinimized.minimized &&
                aiBackgroundMinimized.count > 0 && (
                  <FloatingLeadAIBackgroundIcon
                    count={aiBackgroundMinimized.count}
                    activeCount={aiBackgroundMinimized.activeCount}
                    onClick={() => setAiBackgroundExpandRequest((n) => n + 1)}
                  />
                )}
            </div>,
            document.body,
          )
        : null}

      {saqueAlert.enabled && saqueAlert.isPopupOpen && (
        <SaquePedidosAdminPopup alert={saqueAlert} />
      )}

      <InactivityCheckDialog
        open={presenceTracking.showInactivityCheck}
        onConfirm={presenceTracking.confirmPresence}
      />

      {!isMarketingUser && (
        <>
          <LeadAIAnalysisBackgroundPopup
            onOpenLeadAnalysis={(leadId) => navigate(`/pipeline?id=${leadId}&tab=analise-ia`)}
            onOpenLeadRender={(leadId) =>
              navigate(`/pipeline?id=${leadId}&tab=analise-ia&iaSubtab=render`)
            }
            isIconSlotTaken={showIconsBar}
            expandRequest={aiBackgroundExpandRequest}
            onMinimizedChange={(minimized, meta) => {
              setAiBackgroundMinimized({
                minimized,
                count: meta.count,
                activeCount: meta.activeCount,
              })
            }}
          />
          <OrcamentosIaBackgroundPopup />
        </>
      )}

      {!isMarketingUser && !isMessagePopupDisabled && !isFloatingPopupsHidden && (
        <MessageNotificationsPopup
          notifications={messageNotifications.notifications}
          isOpen={messageNotifications.isOpen}
          onClose={messageNotifications.closePopup}
          onClear={messageNotifications.clearNotifications}
          onRemove={messageNotifications.removeNotification}
          onLeadClick={handleLeadClick}
          onPhoneClick={handlePhoneClick}
        />
      )}
    </>
  )
}
