import { useEffect, type SyntheticEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useLeadProjetoMutations, useLeadProjetoNotas } from '@/hooks/useLeadProjetos'
import { useMarkLeadProjetoChatRead } from '@/hooks/useProjetoChatUnread'
import { ProjetoChatComposer } from '@/components/projetos/ProjetoChatComposer'
import { ProjetoChatThread } from '@/components/projetos/ProjetoChatThread'

interface LeadProjetoCanalDialogProps {
  leadId: number
  leadNome?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadProjetoCanalDialog({
  leadId,
  leadNome,
  open,
  onOpenChange,
}: LeadProjetoCanalDialogProps) {
  const { user, userRoles } = useAuth()
  const { data: notas = [] } = useLeadProjetoNotas(open ? leadId : null)
  const { adicionarNota } = useLeadProjetoMutations()
  const { markLeadChatRead, markLeadChatUnread, isMarkingUnread, lastReadByLead } =
    useMarkLeadProjetoChatRead()

  useEffect(() => {
    if (!open || !leadId) return
    markLeadChatRead(leadId)
  }, [leadId, markLeadChatRead, open])

  const stopCardEvent = (event: SyntheticEvent) => {
    event.stopPropagation()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        nested
        className="lead-atelier-dialog pointer-events-auto flex max-h-[85vh] flex-col gap-3 border-[#8d5e22]/20 bg-[#fffcf8] sm:max-w-lg"
        onClick={stopCardEvent}
        onPointerDown={stopCardEvent}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-[#8d5e22]">Canal do ateliê</DialogTitle>
          <DialogDescription>
            {leadNome
              ? `Mensagens endereçadas a você em ${leadNome}. Administradores veem todo o fio.`
              : 'Cada um vê só o que foi enviado para ele. Administradores veem tudo.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <button
            type="button"
            className="text-[11px] text-[#8a7060] hover:text-[#8d5e22] disabled:opacity-50"
            disabled={isMarkingUnread}
            onClick={() => markLeadChatUnread(leadId)}
          >
            Marcar conversa como não lida
          </button>
        </div>
        <ProjetoChatThread
          notas={notas}
          currentUserId={user?.id}
          currentUserRoles={userRoles}
          lastReadAt={lastReadByLead[leadId] ?? null}
          className="min-h-0 flex-1 max-h-[46vh]"
          markUnreadPending={isMarkingUnread}
          onMarkUnread={(nota) => markLeadChatUnread(leadId, nota.criado_em)}
        />
        <ProjetoChatComposer
          compact
          disabled={adicionarNota.isPending}
          onSend={({ mensagem, file }) => adicionarNota.mutate({ leadId, mensagem, file })}
        />
      </DialogContent>
    </Dialog>
  )
}
