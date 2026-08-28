import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LeadAIRenderPointPicker } from '@/components/leads/LeadAIRenderPointPicker';
import { LeadAIRenderVersionNavigator } from '@/components/leads/LeadAIRenderVersionNavigator';
import { LeadAIRenderHistoryPanel } from '@/components/leads/LeadAIRenderHistoryPanel';
import { LeadAIImageFullscreenDialog } from '@/components/leads/LeadAIImageFullscreenDialog';
import { useDeleteLeadAIRender, type LeadAIRender } from '@/hooks/useLeadAIRenders';
import { useLeadAIRenderBackground } from '@/contexts/LeadAIRenderBackgroundContext';
import {
  prepareSurgicalEditImages,
  loadImageForMarkers,
  type LeadAIRenderEditPonto,
} from '@/lib/lead-ai-render-edit-markers';
import { getRelatedVersionChain } from '@/lib/lead-ai-render-version-chain';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Loader2, Maximize2, Sparkles, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface LeadAIRenderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadName?: string;
  parentRender: LeadAIRender;
  historico?: LeadAIRender[];
  onSuccess?: (render: LeadAIRender) => void;
  onSelectVersion?: (render: LeadAIRender) => void;
  onDeleteVersion?: (render: LeadAIRender) => void;
}

export function LeadAIRenderEditDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  parentRender,
  historico = [],
  onSelectVersion,
  onDeleteVersion,
}: LeadAIRenderEditDialogProps) {
  const [points, setPoints] = useState<LeadAIRenderEditPonto[]>([]);
  const [notas, setNotas] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState(parentRender.id);
  const [previewFullscreenOpen, setPreviewFullscreenOpen] = useState(false);
  const [historyFullscreenRender, setHistoryFullscreenRender] = useState<LeadAIRender | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadAIRender | null>(null);
  const { startBackgroundEdit, isEditingLead } = useLeadAIRenderBackground();
  const deleteMutation = useDeleteLeadAIRender(leadId);
  const editInProgress = isEditingLead(leadId);

  const sortedHistorico = useMemo(
    () =>
      [...(historico.length > 0 ? historico : [parentRender])].sort(
        (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
      ),
    [historico, parentRender],
  );

  const versionChain = useMemo(
    () => getRelatedVersionChain(historico.length > 0 ? historico : [parentRender], parentRender.id),
    [historico, parentRender],
  );

  const selectedVersion = useMemo(
    () => sortedHistorico.find((r) => r.id === selectedVersionId) ?? parentRender,
    [sortedHistorico, selectedVersionId, parentRender],
  );

  useEffect(() => {
    if (open) {
      setSelectedVersionId(parentRender.id);
      setPoints([]);
      setNotas('');
      setDeleteTarget(null);
      setHistoryFullscreenRender(null);
    }
  }, [open, parentRender.id]);

  const handleSelectVersion = useCallback(
    (render: LeadAIRender) => {
      setSelectedVersionId(render.id);
      setPoints([]);
      onSelectVersion?.(render);
    },
    [onSelectVersion],
  );

  const canSubmit =
    points.length >= 1 && notas.trim().length >= 5 && !isPreparing && !editInProgress;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsPreparing(true);
    try {
      const image = await loadImageForMarkers(selectedVersion.outputPublicUrl);
      const { maskImageBase64, markedImageBase64 } = prepareSurgicalEditImages(image, points);

      const started = await startBackgroundEdit({
        leadId,
        leadName,
        imageLabel: `Edição · ${selectedVersion.inputSnapshot?.label ?? 'Render'}`,
        pontoCount: points.length,
        thumbnailUrl: selectedVersion.outputPublicUrl,
        editPayload: {
          parentRenderId: selectedVersion.id,
          editNotas: notas.trim(),
          editPontos: points,
          maskImageBase64,
          markedImageBase64,
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
    leadId,
    leadName,
    notas,
    onOpenChange,
    points,
    selectedVersion.id,
    selectedVersion.inputSnapshot?.label,
    selectedVersion.outputPublicUrl,
    startBackgroundEdit,
  ]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    const chainIndex = versionChain.findIndex((r) => r.id === deleteTarget.id);
    const fallback = versionChain[chainIndex + 1] ?? versionChain[chainIndex - 1] ?? null;

    try {
      await deleteMutation.mutateAsync(deleteTarget);
      onDeleteVersion?.(deleteTarget);
      setDeleteTarget(null);

      if (deleteTarget.id === selectedVersionId) {
        if (fallback) {
          handleSelectVersion(fallback);
        } else {
          onOpenChange(false);
        }
      } else if (!versionChain.some((r) => r.id === selectedVersionId && r.id !== deleteTarget.id)) {
        handleSelectVersion(fallback ?? parentRender);
      }
    } catch {
      // toast no hook
    }
  }, [
    deleteMutation,
    deleteTarget,
    handleSelectVersion,
    onDeleteVersion,
    onOpenChange,
    parentRender,
    selectedVersionId,
    versionChain,
  ]);

  const isEditingLatest =
    versionChain.length > 0 && versionChain[versionChain.length - 1]?.id === selectedVersion.id;

  const fullscreenRender = historyFullscreenRender ?? selectedVersion;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            'flex max-h-[96dvh] w-[min(1024px,calc(100vw-1rem))] flex-col gap-0 overflow-hidden p-0',
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
                Ajustar renderização
              </DialogTitle>
              <DialogDescription className="text-xs text-cream-muted">
                Histórico, versões anteriores e ajustes pontuais — tudo neste painel.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto">
            <div className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-gold/25 bg-gradient-to-r from-gold/8 via-gold/4 to-transparent px-3.5 py-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                <Zap className="h-4 w-4 text-gold" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-medium text-foreground">Edição em segundo plano</p>
                <p className="text-[11px] leading-relaxed text-cream-muted">
                  Feche este painel quando quiser — o retorno da IA aparece no canto inferior direito.
                </p>
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_min(300px,36%)]">
              <div className="min-w-0 space-y-3">
                {versionChain.length > 1 && (
                  <LeadAIRenderVersionNavigator
                    chain={versionChain}
                    currentId={selectedVersion.id}
                    onSelect={handleSelectVersion}
                  />
                )}

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-cream-muted">
                    Selecione o objeto na versão escolhida
                  </Label>
                  <LeadAIRenderPointPicker
                    key={selectedVersion.id}
                    imageUrl={selectedVersion.outputPublicUrl}
                    points={points}
                    onPointsChange={setPoints}
                  />
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                <div className="rounded-xl border border-gold-border-subtle/25 bg-mahogany-card/50 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cream-muted">
                        Versão selecionada
                      </p>
                      <p className="mt-0.5 text-[11px] text-cream-faint">
                        {format(new Date(selectedVersion.criadoEm), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                        {selectedVersion.parentRenderId ? ' · Edição' : ' · Original'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-cream-muted hover:bg-gold/10 hover:text-gold"
                        aria-label="Ver em tela cheia"
                        onClick={() => {
                          setHistoryFullscreenRender(null);
                          setPreviewFullscreenOpen(true);
                        }}
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-cream-muted hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Excluir versão"
                        disabled={deleteMutation.isPending}
                        onClick={() => setDeleteTarget(selectedVersion)}
                      >
                        {deleteMutation.isPending && deleteTarget?.id === selectedVersion.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setHistoryFullscreenRender(null);
                      setPreviewFullscreenOpen(true);
                    }}
                    className="group/preview w-full overflow-hidden rounded-lg border border-gold-border-subtle/20 bg-mahogany-base transition-opacity hover:opacity-95"
                  >
                    <img
                      src={selectedVersion.outputPublicUrl}
                      alt="Versão selecionada"
                      className="aspect-[4/3] w-full object-contain"
                    />
                    <span className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-gold opacity-0 transition-opacity group-hover/preview:opacity-100">
                      <Maximize2 className="h-3 w-3" />
                      Abrir em tela cheia
                    </span>
                  </button>

                  {selectedVersion.editNotas && (
                    <p className="mt-2 text-[11px] leading-relaxed text-cream-muted line-clamp-4">
                      Nota desta versão: {selectedVersion.editNotas}
                    </p>
                  )}

                  {!isEditingLatest && (
                    <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-amber-100/90">
                      Você está editando uma versão anterior. A nova edição será salva como ramificação a partir dela.
                    </p>
                  )}
                </div>

                <LeadAIRenderHistoryPanel
                  historico={sortedHistorico}
                  selectedId={selectedVersion.id}
                  onSelect={handleSelectVersion}
                  onFullscreen={(render) => {
                    setHistoryFullscreenRender(render);
                    setPreviewFullscreenOpen(true);
                  }}
                  onDelete={setDeleteTarget}
                  deletingId={deleteMutation.isPending ? deleteTarget?.id : null}
                />

                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="edit-notas" className="text-xs uppercase tracking-wider text-cream-muted">
                    Nota de edição
                  </Label>
                  <Textarea
                    id="edit-notas"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Ex.: Ponto 1 — adicionar um nicho embutido nesta superfície da geladeira, na mesma cor do móvel."
                    rows={5}
                    className="min-h-[100px] resize-none border-gold-border-subtle/30 bg-mahogany-elevated/60 text-sm"
                    disabled={isPreparing}
                  />
                  <p className="text-[10px] text-cream-faint">
                    Mencione o número do ponto (ex.: “Ponto 1 — …”). A IA usa o marcador dourado e o círculo vermelho como referência exata.
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

      <LeadAIImageFullscreenDialog
        open={previewFullscreenOpen}
        onOpenChange={(open) => {
          setPreviewFullscreenOpen(open);
          if (!open) setHistoryFullscreenRender(null);
        }}
        src={fullscreenRender.outputPublicUrl}
        alt="Versão da renderização"
        title="Versão da renderização"
        subtitle={format(new Date(fullscreenRender.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        outputUrl={fullscreenRender.outputPublicUrl}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-gold-border-subtle/30 bg-mahogany-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta versão?</AlertDialogTitle>
            <AlertDialogDescription>
              A imagem será removida permanentemente do histórico. Versões derivadas desta permanecem salvas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {deleteMutation.isPending ? 'Excluindo…' : 'Excluir versão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
