import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, ImageIcon } from 'lucide-react';
import { LeadAIAnalysisVisualTab } from '@/components/leads/LeadAIAnalysisVisualTab';
import { LeadAIRenderTab } from '@/components/leads/LeadAIRenderTab';

interface LeadAIAnalysisTabProps {
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  defaultSubtab?: 'visual' | 'render';
  subtab?: 'visual' | 'render';
  onSubtabChange?: (value: 'visual' | 'render') => void;
}

export function LeadAIAnalysisTab({
  leadId,
  leadName,
  leadOrigin,
  defaultSubtab = 'visual',
  subtab: controlledSubtab,
  onSubtabChange,
}: LeadAIAnalysisTabProps) {
  const [internalSubtab, setInternalSubtab] = useState(defaultSubtab);
  const subtab = controlledSubtab ?? internalSubtab;

  useEffect(() => {
    if (controlledSubtab) return;
    setInternalSubtab(defaultSubtab);
  }, [controlledSubtab, defaultSubtab, leadId]);

  const setSubtab = (value: 'visual' | 'render') => {
    onSubtabChange?.(value);
    if (controlledSubtab == null) setInternalSubtab(value);
  };

  return (
    <Tabs value={subtab} onValueChange={(v) => setSubtab(v as 'visual' | 'render')} className="space-y-4">
      <TabsList className="grid h-10 w-full max-w-lg grid-cols-2 bg-[color:var(--lead-inset)] p-1 border border-[color:var(--lead-line)]">
        <TabsTrigger
          value="visual"
          className="flex items-center gap-2 text-[color:var(--lead-muted)] data-[state=active]:bg-[color:var(--lead-gold)]/15 data-[state=active]:text-[color:var(--lead-gold)]"
        >
          <Sparkles className="h-4 w-4" />
          Análise visual
        </TabsTrigger>
        <TabsTrigger
          value="render"
          className="flex items-center gap-2 text-[color:var(--lead-muted)] data-[state=active]:bg-[color:var(--lead-gold)]/15 data-[state=active]:text-[color:var(--lead-gold)]"
        >
          <ImageIcon className="h-4 w-4" />
          Renderização de projetos
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="visual"
        className="mt-0 focus-visible:outline-none"
        data-lead-section="ia-visual"
      >
        <LeadAIAnalysisVisualTab leadId={leadId} leadName={leadName} leadOrigin={leadOrigin} />
      </TabsContent>

      <TabsContent
        value="render"
        className="mt-0 focus-visible:outline-none"
        data-lead-section="ia-render"
      >
        <LeadAIRenderTab leadId={leadId} leadName={leadName} leadOrigin={leadOrigin} />
      </TabsContent>
    </Tabs>
  );
}
