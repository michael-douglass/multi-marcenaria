import { MessageSquare } from 'lucide-react'
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

interface LeadProjetoNotasSectionProps {
  leadId: number
}

export function LeadProjetoNotasSection({ leadId }: LeadProjetoNotasSectionProps) {
  const { user } = useAuth()
  const { projeto } = useProjetoPorLead(leadId)
  const { data: notas = [] } = useLeadProjetoNotas(leadId)
  const { adicionarNota } = useLeadProjetoMutations()

  if (!projeto && notas.length === 0) return null

  return (
    <LeadModalSection
      title="Canal do ateliê"
      icon={MessageSquare}
      badge={<ProjetoNotasAura className="h-8 w-8" />}
      description="Titular e projetista no mesmo fio. Não é WhatsApp."
    >
      <ProjetoChatThread notas={notas} currentUserId={user?.id} className="max-h-64" />
      <div className="mt-3">
        <ProjetoChatComposer
          disabled={adicionarNota.isPending}
          onSend={({ mensagem, file }) => adicionarNota.mutate({ leadId, mensagem, file })}
        />
      </div>
    </LeadModalSection>
  )
}
