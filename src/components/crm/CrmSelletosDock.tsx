import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { addDays, isBefore, isFuture, isToday, parseISO } from 'date-fns'
import { MessageNotificationsPopup } from '@/components/layout/MessageNotificationsPopup'
import { WhatsAppNotificationIcon } from '@/components/layout/WhatsAppNotificationIcon'
import { FloatingMarketingCalendarIcon } from '@/components/layout/FloatingMarketingCalendarIcon'
import { FloatingMarketingCalendarPopup } from '@/components/layout/FloatingMarketingCalendarPopup'
import { FloatingApprovalIcon } from '@/components/layout/FloatingApprovalIcon'
import { FloatingPresenceIcon } from '@/components/layout/FloatingPresenceIcon'
import { PresencePopup } from '@/components/layout/PresencePopup'
import { InactivityCheckDialog } from '@/components/layout/InactivityCheckDialog'
import { MarketingApprovalPopup } from '@/components/marketing-conteudo/MarketingApprovalPopup'
import { useLeadNotifications } from '@/hooks/useLeadNotifications'
import { useLeadSinalizacoes } from '@/hooks/useLeadSinalizacoes'
import { LeadSinalizacoesPopup } from '@/components/layout/LeadSinalizacoesPopup'
import { LeadAIAnalysisBackgroundPopup } from '@/components/layout/LeadAIAnalysisBackgroundPopup'
import { FloatingLeadAIBackgroundIcon } from '@/components/layout/FloatingLeadAIBackgroundIcon'
import { FloatingLeadSinalizacoesIcon } from '@/components/layout/FloatingLeadSinalizacoesIcon'
import { useMessageNotifications } from '@/hooks/useMessageNotifications'
import { useMarketingTasks } from '@/hooks/useMarketingTasks'
import { useMarketingApprovalNotifications } from '@/hooks/useMarketingApprovalNotifications'
import { useMarketingColumns, useMarketingContentCards } from '@/hooks/useMarketingConteudo'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { isMarketingOnly, isVendedorRestricted } from '@/lib/app-roles'
import { usePresenceTracking } from '@/hooks/usePresenceTracking'
import { useOnlineUsers } from '@/hooks/useOnlineUsers'
import { useUiPreferences } from '@/hooks/useUiPreferences'
import { floatingIconsPositionClass } from '@/lib/floating-ui-layout'
import { FLOATING_UI_ROOT_ATTR } from '@/lib/overlay-z-index'
import { useSaquePedidosAdminAlert } from '@/hooks/useSaquePedidosAdminAlert'
import { SaquePedidosAdminPopup } from '@/components/layout/SaquePedidosAdminPopup'
import { FloatingSaquePedidosIcon } from '@/components/layout/FloatingSaquePedidosIcon'

/** Dock flutuante do CRM Selletos — só nas rotas comerciais, nunca no Caixa/Obras. */
export function CrmSelletosDock() {
  useLeadNotifications()
  const { preferences, updatePreferences, loading: uiPreferencesLoading } = useUiPreferences()
  const isLeadSinalizacoesMinimized = preferences.minimizeLeadSinalizacoesPopup
  const leadSinalizacoes = useLeadSinalizacoes({
    isMinimizedPreference: isLeadSinalizacoesMinimized,
    preferencesReady: !uiPreferencesLoading,
    onNewSinalizacaoOpen: () => {
      void updatePreferences({ minimizeLeadSinalizacoesPopup: false })
    },
  })
  const navigate = useNavigate()
  const { isSuperAdmin, userRoles, hasRole } = useAuth()

  const isMarketingUser = isMarketingOnly(userRoles, isSuperAdmin)
  const isVendedor = isVendedorRestricted(userRoles, isSuperAdmin)

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
    setIsMarketingCalendarOpen(false)
    setIsApprovalPopupOpen(false)
    setIsPresenceOpen(false)
    messageNotifications.closePopup()
  }, [isFloatingPopupsHidden, messageNotifications])

  const [aiBackgroundMinimized, setAiBackgroundMinimized] = useState({
    minimized: false,
    count: 0,
    activeCount: 0,
  })
  const [aiBackgroundExpandRequest, setAiBackgroundExpandRequest] = useState(0)

  const { tasks: marketingTasks, completeTask, deleteTask } = useMarketingTasks()
  const [isMarketingCalendarOpen, setIsMarketingCalendarOpen] = useState(false)

  const isAdmin = hasRole('admin') || isSuperAdmin
  const approvalNotifications = useMarketingApprovalNotifications()
  const { columns: marketingColumns } = useMarketingColumns()
  const { cards: marketingCards, updateCard: updateMarketingCard } = useMarketingContentCards()
  const [isApprovalPopupOpen, setIsApprovalPopupOpen] = useState(false)
  const { toast } = useToast()

  const presenceTracking = usePresenceTracking()
  const { onlineUsers, count: onlineCount } = useOnlineUsers()
  const [isPresenceOpen, setIsPresenceOpen] = useState(false)

  const marketingTasksCount = useMemo(() => {
    const today = new Date()
    const nextWeek = addDays(today, 7)
    return marketingTasks.filter((task) => {
      const taskDate = parseISO(task.data_agendada)
      return (
        (task.status === 'pendente' || task.status === 'em_andamento') &&
        (isToday(taskDate) || (isFuture(taskDate) && isBefore(taskDate, nextWeek)))
      )
    }).length
  }, [marketingTasks])

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

  const handleApproveCardFromPopup = (cardId: string) => {
    const approvedColumn = marketingColumns.find(
      (c) =>
        c.nome.toLowerCase().includes('aprovados') &&
        !c.nome.toLowerCase().includes('enviados'),
    )

    if (!approvedColumn) {
      toast({
        title: 'Erro',
        description: 'Coluna "Aprovados" não encontrada',
        variant: 'destructive',
      })
      return
    }

    updateMarketingCard({ id: cardId, column_id: approvedColumn.id })
    toast({
      title: 'Conteúdo aprovado!',
      description: 'O conteúdo foi movido para a coluna de aprovados',
    })
  }

  const handleViewCard = (cardId: string) => {
    navigate(`/marketing-conteudo?card=${cardId}`)
    setIsApprovalPopupOpen(false)
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
              {!isFloatingPopupsHidden && isAdmin && !isPresenceOpen && (
                <FloatingPresenceIcon
                  count={onlineCount}
                  onClick={() => setIsPresenceOpen(true)}
                />
              )}
              {!isFloatingPopupsHidden && isAdmin && !isApprovalPopupOpen && (
                <FloatingApprovalIcon
                  count={approvalNotifications.unreadCount}
                  onClick={() => setIsApprovalPopupOpen(true)}
                />
              )}
              {!isFloatingPopupsHidden && !isVendedor && !isMarketingCalendarOpen && (
                <FloatingMarketingCalendarIcon
                  count={marketingTasksCount}
                  onClick={() => setIsMarketingCalendarOpen(true)}
                />
              )}
              {!isMarketingUser &&
                !leadSinalizacoes.isPopupOpen &&
                leadSinalizacoes.unreadCount > 0 && (
                  <FloatingLeadSinalizacoesIcon
                    count={leadSinalizacoes.unreadCount}
                    onClick={() => {
                      void updatePreferences({ minimizeLeadSinalizacoesPopup: false })
                      leadSinalizacoes.openPopup()
                    }}
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

      {!isVendedor && !isFloatingPopupsHidden && (
        <FloatingMarketingCalendarPopup
          isOpen={isMarketingCalendarOpen}
          onClose={() => setIsMarketingCalendarOpen(false)}
          tasks={marketingTasks}
          onCompleteTask={completeTask}
          onDeleteTask={deleteTask}
        />
      )}

      {saqueAlert.enabled && saqueAlert.isPopupOpen && (
        <SaquePedidosAdminPopup alert={saqueAlert} />
      )}

      {isAdmin && !isFloatingPopupsHidden && (
        <MarketingApprovalPopup
          isOpen={isApprovalPopupOpen}
          onClose={() => setIsApprovalPopupOpen(false)}
          notifications={approvalNotifications.notifications}
          cards={marketingCards}
          columns={marketingColumns}
          onMarkAsRead={approvalNotifications.markAsRead}
          onClearAll={approvalNotifications.clearAll}
          onViewCard={handleViewCard}
          onApproveCard={handleApproveCardFromPopup}
        />
      )}

      {isAdmin && !isFloatingPopupsHidden && (
        <PresencePopup
          isOpen={isPresenceOpen}
          onClose={() => setIsPresenceOpen(false)}
          onlineUsers={onlineUsers}
        />
      )}

      <InactivityCheckDialog
        open={presenceTracking.showInactivityCheck}
        onConfirm={presenceTracking.confirmPresence}
      />

      {!isMarketingUser && (
        <>
          <LeadSinalizacoesPopup
            sinalizacoes={leadSinalizacoes.pendentes}
            isOpen={leadSinalizacoes.isPopupOpen}
            onMinimize={() => {
              leadSinalizacoes.closePopup()
              void updatePreferences({ minimizeLeadSinalizacoesPopup: true })
            }}
            onFechar={(id) => void leadSinalizacoes.fecharSinalizacao.mutate(id)}
            onFecharTodas={() => void leadSinalizacoes.fecharTodas.mutate()}
            onAbrirLead={(leadId) => navigate(`/pipeline?id=${leadId}`)}
          />
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
