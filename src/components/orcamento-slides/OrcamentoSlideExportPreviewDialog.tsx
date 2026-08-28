import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OrcamentoSlideApresentacao } from '@/components/orcamento-slides/OrcamentoSlideApresentacao';
import type { OrcamentoSlideApresentacaoProps } from '@/components/orcamento-slides/orcamento-slide-apresentacao-props';
import type { OrcamentoExportViewport } from '@/lib/orcamento-slide-export';
import { resolveExportPageSize } from '@/lib/orcamento-slide-export';

type PresentationProps = Omit<
  OrcamentoSlideApresentacaoProps,
  'ref' | 'className' | 'embeddedInLayout' | 'viewport' | 'previewMode' | 'faithfulPreview'
>;

interface OrcamentoSlideExportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewport: OrcamentoExportViewport;
  titulo: string;
  presentationProps: PresentationProps;
  previewRef: React.RefObject<HTMLDivElement | null>;
  onConfirmExport: () => void;
  isExporting?: boolean;
}

const VIEWPORT_META: Record<
  OrcamentoExportViewport,
  { label: string; Icon: typeof Monitor; dimensoes: string }
> = {
  desktop: {
    label: 'Computador',
    Icon: Monitor,
    dimensoes: '1920×1080',
  },
  mobile: {
    label: 'Celular',
    Icon: Smartphone,
    dimensoes: '1080×1920',
  },
};

export function OrcamentoSlideExportPreviewDialog({
  open,
  onOpenChange,
  viewport,
  titulo,
  presentationProps,
  previewRef,
  onConfirmExport,
  isExporting = false,
}: OrcamentoSlideExportPreviewDialogProps) {
  const pageSize = resolveExportPageSize(viewport);
  const meta = VIEWPORT_META[viewport];
  const formatoPagina = viewport === 'desktop' ? 'A4 paisagem' : 'A4 retrato';
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  const [contentHeight, setContentHeight] = useState(pageSize.height);

  const atualizarEscala = useCallback(() => {
    const area = scrollRef.current;
    if (!area) return;

    const padding = 24;
    const larguraUtil = Math.max(area.clientWidth - padding, 200);
    const alturaUtil = Math.max(area.clientHeight - padding, 200);
    const escalaLargura = larguraUtil / pageSize.width;
    const escalaAltura = alturaUtil / pageSize.height;
    setScale(Math.min(escalaLargura, escalaAltura, 1));
  }, [pageSize.width, pageSize.height]);

  useEffect(() => {
    if (!open) return;
    atualizarEscala();
    const area = scrollRef.current;
    if (!area) return;

    const observer = new ResizeObserver(atualizarEscala);
    observer.observe(area);
    return () => observer.disconnect();
  }, [open, atualizarEscala]);

  useEffect(() => {
    if (!open) return;

    const medir = () => {
      const root = previewRef.current;
      if (!root) return;
      setContentHeight(Math.max(root.scrollHeight, pageSize.height));
    };

    medir();
    const root = previewRef.current;
    if (!root) return;

    const observer = new ResizeObserver(medir);
    observer.observe(root);
    return () => observer.disconnect();
  }, [open, previewRef, pageSize.height, presentationProps]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-[min(96vw,1200px)] max-w-none flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-4 text-left">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20">
              <meta.Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-white">
                Pré-visualização do PDF
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-white/60">
                {meta.label} · {meta.dimensoes} — confira se está igual à apresentação antes de salvar.
              </DialogDescription>
              <p className="mt-1 truncate text-xs text-amber-400/80">{titulo}</p>
            </div>
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto bg-[#1a100c] px-4 py-5"
        >
          <div
            className="mx-auto"
            style={{
              width: pageSize.width * scale,
              height: contentHeight * scale,
            }}
          >
            <div
              style={{
                width: pageSize.width,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              <div
                className="overflow-hidden ring-1 ring-white/10"
                style={{
                  width: pageSize.width,
                  boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
                  borderRadius: 8,
                }}
              >
                <OrcamentoSlideApresentacao
                  ref={previewRef}
                  {...presentationProps}
                  viewport={viewport}
                  previewMode
                  faithfulPreview
                  className="h-full w-full overflow-y-auto overflow-x-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-white/10 px-6 py-4 sm:justify-between">
          <p className="hidden text-xs text-white/45 sm:block">
            Cada dobra vira uma página {formatoPagina} — o conteúdo ({meta.dimensoes}) aparece inteiro, igual à pré-visualização.
          </p>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={isExporting}
              onClick={() => onOpenChange(false)}
              className="border-white/15 bg-transparent text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isExporting}
              onClick={onConfirmExport}
              className="gap-2 bg-amber-600 text-white hover:bg-amber-700"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isExporting ? 'Gerando PDF…' : 'Baixar PDF'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
