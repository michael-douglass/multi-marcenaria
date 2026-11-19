import { LeadAIRenderTab } from '@/components/leads/LeadAIRenderTab';

interface LeadAIAnalysisTabProps {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
}

/**
 * Aba "IA" do card do lead. Hoje só tem a Renderização de projetos (a Análise visual foi removida).
 * Só é montada quando a função "IA no card lead" está liberada (LeadModal).
 */
export function LeadAIAnalysisTab({ leadId, leadName, leadOrigin }: LeadAIAnalysisTabProps) {
  return (
    <div className="focus-visible:outline-none" data-lead-section="ia-render">
      <LeadAIRenderTab leadId={leadId} leadName={leadName} leadOrigin={leadOrigin} />
    </div>
  );
}
