import { Presentation } from 'lucide-react'
import { LeadModalSection } from '@/components/leads/LeadModalSection'
import { LeadOrcamentoSlidesSection } from '@/components/leads/LeadOrcamentoSlidesSection'
import { MarkupLeadSection } from '@/components/markup/MarkupLeadSection'
import { useAuth } from '@/contexts/AuthContext'

interface LeadProjetoComposicaoSectionProps {
  leadId: number
  leadNome: string
  onOrcamentoSync?: (valor: number, options?: { force?: boolean }) => boolean | void
}

export function LeadProjetoComposicaoSection({
  leadId,
  leadNome,
  onOrcamentoSync,
}: LeadProjetoComposicaoSectionProps) {
  const { userRole } = useAuth()

  return (
    <LeadModalSection
      title="Composição"
      icon={Presentation}
      description="Slides e markup sobem para o topo quando a ficha abre pelo ateliê."
    >
      <LeadOrcamentoSlidesSection leadId={leadId} />
      <div className="mt-4">
        <MarkupLeadSection
          leadId={leadId}
          leadNome={leadNome}
          onOrcamentoSync={onOrcamentoSync}
          readOnly={userRole === 'vendedor'}
        />
      </div>
    </LeadModalSection>
  )
}
