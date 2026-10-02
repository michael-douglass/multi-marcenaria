import { MessageSquare } from 'lucide-react'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LeadModalSection } from '@/components/leads/LeadModalSection'
import { ProjetoNotasAura } from '@/components/projetos/ProjetoNotasAura'
import { ProjetoChatThread } from '@/components/projetos/ProjetoChatThread'
import { ProjetoChatComposer } from '@/components/projetos/ProjetoChatComposer'
import {
  useLeadProjetoMutations,
  useLeadProjetoNotas,
  useProjetoPorLead,
} from '@/hooks/useLeadProjetos'
import { useMarkLeadProjetoChatRead } from '@/hooks/useProjetoChatUnread'

interface LeadProjetoNotasSectionProps {
  leadId: number
}

export function LeadProjetoNotasSection({ leadId }: LeadProjetoNotasSectionProps) {
  const { user, userRoles } = useAuth()
  const { projeto } = useProjetoPorLead(leadId)
  const { data: notas = [] } = useLeadProjetoNotas(leadId)
  const { adicionarNota } = useLeadProjetoMutations()
  const { markLeadChatRead, markLeadChatUnread, isMarkingUnread, lastReadByLead } =
    useMarkLeadProjetoChatRead()

  useEffect(() => {
    if (!leadId) return
    if (!projeto && notas.length === 0) return
    markLeadChatRead(leadId)
  }, [leadId, markLeadChatRead, notas.length, projeto])

  if (!projeto && notas.length === 0) return null

  return (
    <LeadModalSection
      title="Canal do ateliê"
      icon={MessageSquare}
      badge={<ProjetoNotasAura className="h-8 w-8" />}
      description="Cada um vê só as mensagens enviadas para ele. Administradores veem tudo."
    >
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          className="text-[11px] text-[#8a7060] hover:text-[#8d5e22] disabled:opacity-50"
          disabled={isMarkingUnread}
          onClick={() => markLeadChatUnread(leadId)}
        >
          Marcar como não lida
        </button>
      </div>
      <ProjetoChatThread
        notas={notas}
        currentUserId={user?.id}
        currentUserRoles={userRoles}
        lastReadAt={lastReadByLead[leadId] ?? null}
        className="max-h-64"
        markUnreadPending={isMarkingUnread}
        onMarkUnread={(nota) => markLeadChatUnread(leadId, nota.criado_em)}
      />
      <div className="mt-3">
        <ProjetoChatComposer
          disabled={adicionarNota.isPending}
          onSend={({ mensagem, file }) => adicionarNota.mutate({ leadId, mensagem, file })}
        />
      </div>
    </LeadModalSection>
  )
}
