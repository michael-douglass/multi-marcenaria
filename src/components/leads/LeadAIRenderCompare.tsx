import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LeadAIFormattedContent } from '@/lib/lead-ai-formatted-content';
import { LeadAIRenderThinkingState } from '@/components/leads/LeadAIRenderThinkingState';
import {
  LeadAIRenderFullscreenDialog,
  RenderImageFrame,
} from '@/components/leads/LeadAIRenderFullscreenDialog';
import { LeadAIImageFullscreenDialog } from '@/components/leads/LeadAIImageFullscreenDialog';
import { LeadAIRenderDownloadMenu } from '@/components/leads/LeadAIRenderDownloadMenu';
import { LeadAIRenderEditDialog } from '@/components/leads/LeadAIRenderEditDialog';
import { LeadAIRenderWipeStage } from '@/components/leads/LeadAIRenderWipeStage';
import { LeadAIRenderExportStudio } from '@/components/leads/LeadAIRenderExportStudio';
import type { LeadAIRender } from '@/hooks/useLeadAIRenders';
import { cn } from '@/lib/utils';
import { FileDown, Maximize2 } from 'lucide-react';

interface LeadAIRenderCompareProps {
  sketchUrl: string | null;
  sketchLabel?: string;
  outputUrl: string | null;
  analiseTexto?: string | null;
  isLoading?: boolean;
  className?: string;
  leadId?: number;
  leadName?: string | null;
  activeRender?: LeadAIRender | null;
  historico?: LeadAIRender[];
  onEditSuccess?: (render: LeadAIRender) => void;
  onSelectVersion?: (render: LeadAIRender) => void;
  onDeleteVersion?: (render: LeadAIRender) => void;
  onRequestDelete?: () => void;
  /** Seleciona o resultado como nova imagem de entrada na grade de esboços. */
  onUseAsSketch?: () => void;
}

export function LeadAIRenderCompare({
  sketchUrl,
  sketchLabel = 'Esboço',
  outputUrl,
  analiseTexto,
  isLoading = false,
  className,
  leadId,
  leadName,
  activeRender,
  historico = [],
  onEditSuccess,
  onSelectVersion,
  onDeleteVersion,
  onRequestDelete,
  onUseAsSketch,
}: LeadAIRenderCompareProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [renderSingleOpen, setRenderSingleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const canExpand = Boolean(sketchUrl || outputUrl);
  const canEdit = Boolean(outputUrl && activeRender && leadId);
  const canExport = Boolean(sketchUrl || outputUrl);

  if (isLoading) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-gold-border-subtle/30 bg-mahogany-card/50',
          className,
        )}
      >
        <LeadAIRenderThinkingState />
      </div>
    );
  }

  return (
    <>
      <div className={cn('space-y-4', className)}>
        {canExpand && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canExport && (
              <Button
                type="button"
                size="sm"
                onClick={() => setExportOpen(true)}
                className="h-9 bg-[#f2d892] text-xs font-semibold text-[#2a1812] hover:bg-[#e8d09a]"
              >
                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                Exportar PDF e PNG
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFullscreenOpen(true)}
              className="h-9 border-gold-border-subtle/40 bg-mahogany-elevated/60 text-xs text-cream-secondary hover:border-gold/40 hover:bg-gold/10 hover:text-gold"
            >
              <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
              Comparar em tela cheia
            </Button>
          </div>
        )}

        {sketchUrl && outputUrl && (
          <LeadAIRenderWipeStage
            beforeUrl={sketchUrl}
            afterUrl={outputUrl}
            beforeLabel={sketchLabel}
            afterLabel="Render"
            onExport={() => setExportOpen(true)}
          />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <RenderImageFrame
            src={sketchUrl}
            alt={sketchLabel}
            label={`Antes — ${sketchLabel}`}
            variant="before"
            onExpand={canExpand ? () => setFullscreenOpen(true) : undefined}
          />

          <RenderImageFrame
            src={outputUrl}
            alt="Render fotorrealista"
            label="Depois — Render fotorrealista"
            variant="after"
            toolbarCompact
            onExpand={canExpand ? () => setFullscreenOpen(true) : undefined}
            onExpandSingle={outputUrl ? () => setRenderSingleOpen(true) : undefined}
            onEdit={canEdit ? () => setEditOpen(true) : undefined}
            onDelete={onRequestDelete}
            onUseAsSketch={outputUrl && onUseAsSketch ? onUseAsSketch : undefined}
            headerAction={
              <LeadAIRenderDownloadMenu
                outputUrl={outputUrl}
                sketchUrl={sketchUrl}
                sketchLabel={sketchLabel}
                leadName={leadName}
                leadId={leadId}
                iconOnly
                triggerClassName="text-gold hover:text-gold"
                onOpenStudio={() => setExportOpen(true)}
              />
            }
          />
        </div>

        {analiseTexto?.trim() && (
          <div className="rounded-xl border border-gold-border-subtle/25 bg-mahogany-panel/40 p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cream-muted">
              Análise técnica do esboço
            </p>
            <ScrollArea className="max-h-48">
              <LeadAIFormattedContent content={analiseTexto} className="text-sm text-cream-secondary" />
            </ScrollArea>
          </div>
        )}
      </div>

      {fullscreenOpen && (
        <LeadAIRenderFullscreenDialog
          open={fullscreenOpen}
          onOpenChange={setFullscreenOpen}
          sketchUrl={sketchUrl}
          sketchLabel={sketchLabel}
          outputUrl={outputUrl}
        />
      )}

      {renderSingleOpen && (
        <LeadAIImageFullscreenDialog
          open={renderSingleOpen}
          onOpenChange={setRenderSingleOpen}
          src={outputUrl}
          alt="Render fotorrealista"
          title="Render fotorrealista"
          subtitle="Somente a imagem renderizada"
          outputUrl={outputUrl}
          sketchUrl={sketchUrl}
          sketchLabel={sketchLabel}
        />
      )}

      {editOpen && activeRender && leadId && (
        <LeadAIRenderEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          leadId={leadId}
          parentRender={activeRender}
          historico={historico}
          onSuccess={onEditSuccess}
          onSelectVersion={onSelectVersion}
          onDeleteVersion={onDeleteVersion}
        />
      )}
      {exportOpen && (
        <LeadAIRenderExportStudio
          open={exportOpen}
          onOpenChange={setExportOpen}
          sketchUrl={sketchUrl}
          sketchLabel={sketchLabel}
          outputUrl={outputUrl}
          leadName={leadName}
          leadId={leadId}
        />
      )}
    </>
  );
}

