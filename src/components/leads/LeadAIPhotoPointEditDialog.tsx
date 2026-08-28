import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LeadAIRenderPointPicker } from '@/components/leads/LeadAIRenderPointPicker';
import { useLeadAIRenderBackground } from '@/contexts/LeadAIRenderBackgroundContext';
import type { LeadAIRender } from '@/hooks/useLeadAIRenders';
import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';
import {
  imageElementToPngBase64,
  loadImageForMarkers,
  prepareSurgicalEditImages,
  type LeadAIRenderEditPonto,
} from '@/lib/lead-ai-render-edit-markers';
import { cn } from '@/lib/utils';
import { ArrowLeft, Loader2, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface LeadAIPhotoPointEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadName?: string;
  imageUrl: string;
  imageLabel: string;
  inputSnapshot: LeadAIAnalysisItemPayload;
  onSuccess?: (render: LeadAIRender) => void;
}

export function LeadAIPhotoPointEditDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  imageUrl,
  imageLabel,
  inputSnapshot,
}: LeadAIPhotoPointEditDialogProps) {
  const [points, setPoints] = useState<LeadAIRenderEditPonto[]>([]);
  const [notas, setNotas] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);
  const { startBackgroundEdit, isEditingLead } = useLeadAIRenderBackground();

  const editInProgress = isEditingLead(leadId);

  useEffect(() => {
    if (open) {
      setPoints([]);
      setNotas('');
    }
  }, [open, imageUrl]);

  const canSubmit =
    points.length >= 1 && notas.trim().length >= 5 && !isPreparing && !editInProgress;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsPreparing(true);
    try {
      const image = await loadImageForMarkers(imageUrl);
      const { maskImageBase64, markedImageBase64 } = prepareSurgicalEditImages(image, points);
      const sourceImageBase64 = imageElementToPngBase64(image);

      const started = await startBackgroundEdit({
        leadId,
        leadName,
        imageLabel,
        pontoCount: points.length,
        thumbnailUrl: imageUrl,
        editPayload: {
          editNotas: notas.trim(),
          editPontos: points,
          maskImageBase64,
          markedImageBase64,
          sourceImageBase64,
          inputSnapshot: {
            ...inputSnapshot,
            imageUrl: inputSnapshot.imageUrl ?? imageUrl,
          },
        },
      });

      if (started) {
        onOpenChange(false);
      }
    } catch (err) {
      toast.error('Não foi possível iniciar a edição', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsPreparing(false);
    }
  }, [
    canSubmit,
    imageLabel,
    imageUrl,
    inputSnapshot,
    leadId,
    leadName,
    notas,
    onOpenChange,
    points,
    startBackgroundEdit,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[96dvh] w-[min(920px,calc(100vw-1rem))] flex-col gap-0 overflow-hidden p-0',
          'border-gold-border-subtle/30 bg-mahogany-panel',
        )}
      >
        <div className="relative shrink-0 border-b border-gold-border-subtle/30 bg-gradient-to-r from-mahogany-elevated via-mahogany-card to-mahogany-elevated px-5 py-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent" />
          <DialogHeader className="space-y-1 text-left">
            <div className="flex items-center gap-2 text-gold">
              <Sparkles className="h-4 w-4" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">
                Edição pontual
              </span>
            </div>
            <DialogTitle className="font-display text-xl uppercase tracking-wide text-primary">
              Editar foto por pontos
            </DialogTitle>
            <DialogDescription className="text-xs text-cream-muted">
              {imageLabel} — marque os pontos e descreva o que a IA deve alterar.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-gold/25 bg-gradient-to-r from-gold/8 via-gold/4 to-transparent px-3.5 py-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <Zap className="h-4 w-4 text-gold" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium text-foreground">Roda em segundo plano</p>
              <p className="text-[11px] leading-relaxed text-cream-muted">
                Ao aplicar, este painel pode ser fechado. Acompanhe o progresso no canto inferior
                direito enquanto usa o resto do CRM.
              </p>
            </div>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_min(280px,34%)]">
            <div className="min-w-0 space-y-2">
              <Label className="text-xs uppercase tracking-wider text-cream-muted">
                Marque os pontos na foto
              </Label>
              <LeadAIRenderPointPicker
                key={imageUrl}
                imageUrl={imageUrl}
                points={points}
                onPointsChange={setPoints}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-gold-border-subtle/25 bg-mahogany-card/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cream-muted">
                  Foto selecionada
                </p>
                <img
                  src={imageUrl}
                  alt={imageLabel}
                  className="mt-2 aspect-[4/3] w-full rounded-lg border border-gold-border-subtle/20 bg-mahogany-base object-contain"
                />
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <Label
                  htmlFor="photo-edit-notas"
                  className="text-xs uppercase tracking-wider text-cream-muted"
                >
                  O que alterar
                </Label>
                <Textarea
                  id="photo-edit-notas"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ex.: Ponto 1 — trocar a cor desta porta para branco fosco; Ponto 2 — adicionar puxador embutido."
                  rows={6}
                  className="min-h-[120px] resize-none border-gold-border-subtle/30 bg-mahogany-elevated/60 text-sm"
                  disabled={isPreparing}
                />
                <p className="text-[10px] text-cream-faint">
                  Mencione o número de cada ponto. O resultado será salvo no histórico e nos anexos.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-gold-border-subtle/20 px-5 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPreparing}
            className="text-cream-muted hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Fechar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="min-w-[200px] bg-gold/90 text-mahogany-base shadow-[0_0_24px_-6px_hsl(var(--gold)/0.55)] hover:bg-gold"
          >
            {isPreparing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparando…
              </>
            ) : editInProgress ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Edição em andamento…
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Aplicar em segundo plano
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
