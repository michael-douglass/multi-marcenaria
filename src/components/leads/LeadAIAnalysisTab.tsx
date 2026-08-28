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
}

export function LeadAIAnalysisTab({
  leadId,
  leadName,
  leadOrigin,
  defaultSubtab = 'visual',
}: LeadAIAnalysisTabProps) {
  const [subtab, setSubtab] = useState(defaultSubtab);

  useEffect(() => {
    setSubtab(defaultSubtab);
  }, [defaultSubtab, leadId]);

  return (
    <Tabs value={subtab} onValueChange={(v) => setSubtab(v as 'visual' | 'render')} className="space-y-4">
      <TabsList className="grid h-10 w-full max-w-lg grid-cols-2 bg-mahogany-muted/50 p-1 border border-gold-border-subtle/20">
        <TabsTrigger
          value="visual"
          className="flex items-center gap-2 data-[state=active]:bg-gold/15 data-[state=active]:text-gold"
        >
          <Sparkles className="h-4 w-4" />
          Análise visual
        </TabsTrigger>
        <TabsTrigger
          value="render"
          className="flex items-center gap-2 data-[state=active]:bg-gold/15 data-[state=active]:text-gold"
        >
          <ImageIcon className="h-4 w-4" />
          Renderização de projetos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="visual" className="mt-0 focus-visible:outline-none">
        <LeadAIAnalysisVisualTab leadId={leadId} leadName={leadName} leadOrigin={leadOrigin} />
      </TabsContent>

      <TabsContent value="render" className="mt-0 focus-visible:outline-none">
        <LeadAIRenderTab leadId={leadId} leadName={leadName} leadOrigin={leadOrigin} />
      </TabsContent>
    </Tabs>
  );
}
