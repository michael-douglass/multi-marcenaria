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
}

export function PipelineIndicatorsSection({
  allLeads,
  isLoading,
  visibleKeys = [...PIPELINE_INDICATOR_KEYS],
}: PipelineIndicatorsSectionProps) {
  const { indicators, ready, setSectionOpen, setCardOpen } =
    usePipelineIndicatorsPreferencesContext();
  const show = (key: PipelineIndicatorKey) => visibleKeys.includes(key);
  const sectionOpen = ready ? indicators.sectionOpen : false;

  return (
    <Collapsible open={sectionOpen} onOpenChange={setSectionOpen}>
      <Card className="border-border bg-muted/20">
        <div className="flex flex-col space-y-1.5 p-6 pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary shrink-0" />
              <div>
                <h3 className="text-sm font-semibold leading-none tracking-tight">
                  Indicadores da pipeline
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads por região, negócios ganhos, orçamentos, vendas por origem e ranking
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 h-8 shrink-0"
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

        <CollapsibleContent>
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
