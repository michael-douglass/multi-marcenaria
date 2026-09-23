import { Lead } from '@/types/selletos';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { usePipelineIndicatorsPreferencesContext } from '@/contexts/PipelineIndicatorsPreferencesContext';
import {
  PIPELINE_INDICATOR_KEYS,
  type PipelineIndicatorKey,
} from '@/lib/pipeline-indicators-preferences';
import { OriginByMonthChart } from './OriginByMonthChart';
import { SalesStatsCard } from './SalesStatsCard';
import { OrcamentosCard } from './OrcamentosCard';
import { SalesByOriginCard } from './SalesByOriginCard';
import { VendorRankingCard } from './VendorRankingCard';

interface PipelineIndicatorsSectionProps {
  allLeads: Lead[];
  isLoading: boolean;
  /** Quais cards exibir (admin vê todos por padrão). */
  visibleKeys?: PipelineIndicatorKey[];
  onLeadClick?: (leadId: number) => void;
}

export function PipelineIndicatorsSection({
  allLeads,
  isLoading,
  visibleKeys = [...PIPELINE_INDICATOR_KEYS],
  onLeadClick,
}: PipelineIndicatorsSectionProps) {
  const { indicators, ready, setSectionOpen, setCardOpen } =
    usePipelineIndicatorsPreferencesContext();
  const show = (key: PipelineIndicatorKey) => visibleKeys.includes(key);
  const sectionOpen = ready ? indicators.sectionOpen : false;

  return (
    <Collapsible open={sectionOpen} onOpenChange={setSectionOpen}>
      <Card className="border-border bg-muted/20">
        <div className="flex flex-col space-y-1 p-2 pb-1.5 md:px-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-primary shrink-0" />
              <div className="min-w-0">
                <h3 className="text-xs font-semibold leading-none tracking-tight">
                  Indicadores da pipeline
                </h3>
                {sectionOpen ? (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Leads por região, negócios ganhos, orçamentos, vendas por origem e ranking
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 h-7 shrink-0 rounded-full border border-border/70 px-2.5 text-[11px]"
              onClick={() => setSectionOpen(!sectionOpen)}
            >
              {sectionOpen ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span className="text-xs">Recolher tudo</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span className="text-xs">Expandir tudo</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <CollapsibleContent className="data-[state=closed]:hidden">
          <div className="space-y-3 px-3 pb-3 md:px-4 md:pb-4">
            {show('origin_by_month') && (
              <OriginByMonthChart
                leads={allLeads}
                isLoading={isLoading}
                open={ready ? indicators.cards.origin_by_month : false}
                onOpenChange={(open) => setCardOpen('origin_by_month', open)}
              />
            )}
            {show('sales_stats') && (
              <SalesStatsCard
                allLeads={allLeads}
                isLoading={isLoading}
                open={ready ? indicators.cards.sales_stats : false}
                onOpenChange={(open) => setCardOpen('sales_stats', open)}
              />
            )}
            {show('orcamentos') && (
              <OrcamentosCard
                allLeads={allLeads}
                isLoading={isLoading}
                open={ready ? indicators.cards.orcamentos : false}
                onOpenChange={(open) => setCardOpen('orcamentos', open)}
                onLeadClick={onLeadClick}
              />
            )}
            {show('sales_by_origin') && (
              <SalesByOriginCard
                allLeads={allLeads}
                isLoading={isLoading}
                open={ready ? indicators.cards.sales_by_origin : false}
                onOpenChange={(open) => setCardOpen('sales_by_origin', open)}
              />
            )}
            {show('vendor_ranking') && (
              <VendorRankingCard
                allLeads={allLeads}
                isLoading={isLoading}
                open={ready ? indicators.cards.vendor_ranking : false}
                onOpenChange={(open) => setCardOpen('vendor_ranking', open)}
              />
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
