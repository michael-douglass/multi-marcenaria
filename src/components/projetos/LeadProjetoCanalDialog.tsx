import { type SyntheticEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useLeadProjetoMutations, useLeadProjetoNotas } from '@/hooks/useLeadProjetos'
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
  const { user } = useAuth()
  const { data: notas = [] } = useLeadProjetoNotas(open ? leadId : null)
  const { adicionarNota } = useLeadProjetoMutations()

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
              ? `Titular e projetista no mesmo fio de ${leadNome}. Não é WhatsApp.`
              : 'Titular e projetista no mesmo fio. Não é WhatsApp.'}
          </DialogDescription>
        </DialogHeader>
        <ProjetoChatThread notas={notas} currentUserId={user?.id} className="min-h-0 flex-1 max-h-[46vh]" />
        <ProjetoChatComposer
          compact
          disabled={adicionarNota.isPending}
          onSend={({ mensagem, file }) => adicionarNota.mutate({ leadId, mensagem, file })}
        />
      </DialogContent>
    </Dialog>
  )
}
