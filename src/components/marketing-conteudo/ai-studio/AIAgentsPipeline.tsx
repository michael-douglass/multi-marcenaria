import { ArrowRight, Search, PenLine } from 'lucide-react';
import { useMarketingAIStudio } from '@/hooks/useMarketingAIStudio';
import { StudioSection } from './StudioMotionStyles';
import { AIAgentEditor } from './AIAgentEditor';

export function AIAgentsPipeline() {
  const { agents, isLoadingAgents } = useMarketingAIStudio();
  const pesquisa = agents.find((a) => a.slug === 'pesquisa');
  const copy = agents.find((a) => a.slug === 'copy');

  return (
    <StudioSection
      title="Esteira de agentes"
      description="Pesquisa prepara o briefing; a voz de copy escreve o roteiro. Edite o agente de pesquisa aqui — as vozes ficam nas personalidades."
      delayMs={120}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <div className="flex items-center gap-2 rounded-full border border-amber-900/15 bg-amber-950/[0.03] px-3 py-1.5 dark:border-amber-100/15">
          <Search className="h-3.5 w-3.5 text-amber-800 dark:text-amber-300" />
          Pesquisa
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div className="flex items-center gap-2 rounded-full border border-amber-900/15 bg-amber-950/[0.03] px-3 py-1.5 dark:border-amber-100/15">
          <PenLine className="h-3.5 w-3.5 text-amber-800 dark:text-amber-300" />
          Copy (personalidade)
        </div>
      </div>

      {isLoadingAgents ? (
        <p className="text-sm text-muted-foreground">Carregando agentes…</p>
      ) : (
        <div className="space-y-4">
          {pesquisa ? <AIAgentEditor agent={pesquisa} /> : null}
          {copy ? (
            <p className="text-xs text-muted-foreground">
              O agente <strong>copy</strong> serve só como fallback se nenhuma
              personalidade estiver ativa. Preferência: edite as vozes na seção
              abaixo.
            </p>
          ) : null}
        </div>
      )}
    </StudioSection>
  );
}
