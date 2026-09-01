import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ProjectImageStudio,
  type ProjectImageStudioHandle,
} from '@/components/leads/whiteboard/ProjectImageStudio';
import { setProjectImagePickerOpenFlag, swallowClickThroughAfterDialogClose } from '@/lib/dialog-outside-guard';
import { leadFullscreenNestedContentClass, leadFullscreenNestedOverlayClass } from '@/lib/overlay-z-index';
import { cn } from '@/lib/utils';

interface AmbientePhotoStudioDialogProps {
  open: boolean;
  sourceUrl: string | null;
  photoLabel?: string;
  startInCrop?: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (bakedUrl: string) => void | Promise<void>;
}

/**
 * Bancada de retoque para uma foto já na lousa — recorte, fundo, luz e cor.
 */
export function AmbientePhotoStudioDialog({
  open,
  sourceUrl,
  photoLabel,
  startInCrop = false,
  onOpenChange,
  onApply,
}: AmbientePhotoStudioDialogProps) {
  const studioRef = useRef<ProjectImageStudioHandle>(null);
  const [isBaking, setIsBaking] = useState(false);

  useEffect(() => {
    setProjectImagePickerOpenFlag(open);
    return () => setProjectImagePickerOpenFlag(false);
  }, [open]);

  useEffect(() => {
    if (!open) setIsBaking(false);
  }, [open]);

  const handleApply = async () => {
    if (!sourceUrl || isBaking) return;
    setIsBaking(true);
    try {
      let bakedUrl = sourceUrl;
      if (studioRef.current?.hasEdits()) {
        bakedUrl = await Promise.race([
          studioRef.current.bake(),
          new Promise<string>((_, reject) => {
            window.setTimeout(() => reject(new Error('O retoque demorou demais')), 8000);
          }),
        ]);
        bakedUrl = bakedUrl || sourceUrl;
      }
      await onApply(bakedUrl);
      swallowClickThroughAfterDialogClose();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível aplicar a edição da foto');
    } finally {
      setIsBaking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        nested
        data-ambiente-photo-studio=""
        portalContainer={typeof document !== 'undefined' ? document.body : undefined}
        overlayClassName={cn(leadFullscreenNestedOverlayClass, 'ambiente-project-picker-overlay')}
        className={cn(
          'flex h-[min(90dvh,880px)] min-h-[min(62dvh,480px)] max-h-[min(94dvh,960px)] flex-col gap-0 overflow-hidden p-0',
          'border-gold-border-subtle/40 bg-mahogany-panel sm:max-w-6xl',
          leadFullscreenNestedContentClass,
        )}
        onPointerDownOutside={(event) => event.stopPropagation()}
        onInteractOutside={(event) => event.stopPropagation()}
        onFocusOutside={(event) => event.stopPropagation()}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-gold-border-subtle/20 bg-mahogany-elevated/80 px-4 py-4 sm:px-5">
          <DialogTitle className="font-display text-left text-base tracking-wide text-cream-secondary sm:text-lg">
            {startInCrop ? 'Recortar foto' : 'Bancada de retoque'}
          </DialogTitle>
          <DialogDescription className="text-left text-xs text-cream-muted sm:text-sm">
            {photoLabel
              ? `Edite “${photoLabel}” e aplique na lousa. O arquivo original do lead permanece igual.`
              : 'Recorte, tire o fundo e ajuste a luz. O arquivo original do lead permanece igual.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {open && sourceUrl ? (
            <ProjectImageStudio
              key={`${sourceUrl}-${startInCrop ? 'crop' : 'retouch'}`}
              ref={studioRef}
              sourceUrl={sourceUrl}
              disabled={isBaking}
              initialCropMode={startInCrop}
            />
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-gold-border-subtle/20 bg-mahogany-elevated/80 px-4 py-3 sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="border-gold-border-subtle/40"
            disabled={isBaking}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isBaking || !sourceUrl}
            onClick={() => void handleApply()}
            className="bg-gold text-gold-on hover:bg-gold/90"
          >
            {isBaking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Aplicar na lousa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
