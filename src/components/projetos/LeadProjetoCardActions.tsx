import { type ReactNode, type SyntheticEvent, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLeadProjetoChatBoard, useProjetoPorLead } from '@/hooks/useLeadProjetos'
import { canAccessProjetosBoard } from '@/lib/app-roles'
import { canEnviarDaPipeline } from '@/lib/projetos-atelie'
import { LeadEnviarProjetoDialog } from '@/components/projetos/LeadEnviarProjetoDialog'
import { LeadProjetoCanalDialog } from '@/components/projetos/LeadProjetoCanalDialog'
import { ProjetoChatBadge } from '@/components/projetos/ProjetoChatBadge'

interface LeadProjetoCardActionsProps {
  leadId: number
  leadNome: string
  children?: ReactNode
}

export function LeadProjetoCardActions({
  leadId,
  leadNome,
  children,
}: LeadProjetoCardActionsProps) {
  const { user, userRoles, isSuperAdmin } = useAuth()
  const { projeto } = useProjetoPorLead(leadId)
  const { data: threads = [] } = useLeadProjetoChatBoard({ realtime: false })
  const [canalOpen, setCanalOpen] = useState(false)

  const canBoard = canAccessProjetosBoard(userRoles, isSuperAdmin)
  const canEnviar = canEnviarDaPipeline(userRoles, isSuperAdmin)
  const last = threads.find((thread) => thread.lead_id === leadId)?.last
  const showCanal = canBoard && Boolean(projeto)

  const stopCardEvent = (event: SyntheticEvent) => {
    event.stopPropagation()
  }

  return (
    <>
      {showCanal ? (
        <button
          type="button"
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gold hover:bg-gold/10"
          title={last && last.autor_id !== user?.id ? 'Nova mensagem no canal' : 'Canal do ateliê'}
          aria-label="Canal do ateliê"
          onClick={(event) => {
            stopCardEvent(event)
            setCanalOpen(true)
          }}
          onPointerDown={stopCardEvent}
        >
          <ProjetoChatBadge lastAutorId={last?.autor_id ?? user?.id ?? ''} currentUserId={user?.id} />
        </button>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {canEnviar ? (
          <LeadEnviarProjetoDialog
            leadId={leadId}
            variant="card"
            onEnviado={() => setCanalOpen(true)}
          />
        ) : null}
        {children}
      </div>

      <LeadProjetoCanalDialog
        leadId={leadId}
        leadNome={leadNome}
        open={canalOpen}
        onOpenChange={setCanalOpen}
      />
    </>
  )
}
