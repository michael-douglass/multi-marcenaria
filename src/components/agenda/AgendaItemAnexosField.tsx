import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Maximize2,
  Minus,
  Paperclip,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AgendaAnexoPreview, useAgendaItemAnexosDraft } from '@/hooks/useAgendaItemAnexosDraft';
import type { AgendaItemAnexosAccept } from '@/lib/agenda-item-anexos';
import {
  useInlineImageZoom,
  useZoomContainerBinding,
} from '@/components/leads/use-inline-image-zoom';

interface AgendaItemAnexosFieldProps {
  draft: ReturnType<typeof useAgendaItemAnexosDraft>;
  accept: AgendaItemAnexosAccept;
  readOnly?: boolean;
  floatingLayer?: boolean;
  title?: string;
  hint?: string;
}

const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';
const ACCEPT_IMAGES_AND_PDFS = `${ACCEPT_IMAGES},application/pdf,.pdf`;

function Lightbox({
  items,
  index,
  open,
  onOpenChange,
  floatingLayer,
}: {
  items: AgendaAnexoPreview[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floatingLayer?: boolean;
}) {
  const [page, setPage] = useState(index);
  useEffect(() => {
    if (open) setPage(index);
  }, [open, index]);

  const current = items[page];
  const hasMultiple = items.length > 1;
  const zoomKey = open ? `${current?.key ?? ''}:${current?.previewUrl ?? ''}` : null;
  const {
    scale,
    position,
    resetView,
    zoomIn,
    zoomOut,
    toggleZoom,
    bindZoomContainer,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isZoomed,
    canZoomIn,
    canZoomOut,
  } = useInlineImageZoom(zoomKey);
  const canZoom = !!current?.previewUrl;
  const containerRef = useZoomContainerBinding(bindZoomContainer, open && canZoom);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetView();
        onOpenChange(next);
      }}
    >
      <DialogContent
        floatingLayer={floatingLayer}
        className="flex h-[min(92vh,56rem)] max-h-[92vh] w-[min(96vw,80rem)] max-w-[min(96vw,80rem)] flex-col gap-3 border-primary/30 bg-[#1c100c]/95 p-3 sm:p-4"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{current?.name || 'Anexo'}</DialogTitle>

        <div className="flex items-center justify-between gap-2 pr-8">
          <p className="min-w-0 truncate text-xs text-[#f2d892]">
            {current?.name}
            {current?.badge ? ` · ${current.badge}` : ''}
            {hasMultiple ? ` · ${page + 1}/${items.length}` : ''}
          </p>
          {canZoom && (
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[#f2d892]/35 bg-[#2a1812]/80 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={zoomOut}
                disabled={!canZoomOut}
                className="h-8 w-8 text-[#edd9c4] hover:text-[#f2d892]"
                aria-label="Diminuir zoom"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <button
                type="button"
                onClick={resetView}
                className="min-w-[3.25rem] px-1 text-center text-[11px] tabular-nums text-[#f2d892] hover:text-[#f5e0a8]"
                aria-label="Restaurar zoom"
                title="Restaurar zoom"
              >
                {Math.round(scale * 100)}%
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={zoomIn}
                disabled={!canZoomIn}
                className="h-8 w-8 text-[#edd9c4] hover:text-[#f2d892]"
                aria-label="Aumentar zoom"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              {isZoomed && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={resetView}
                  className="h-8 w-8 text-[#edd9c4] hover:text-[#f2d892]"
                  aria-label="Restaurar visualização"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>

        {current?.previewUrl ? (
          <div
            ref={containerRef}
            className={cn(
              'relative min-h-0 flex-1 overflow-hidden rounded-md bg-black/50 touch-none',
              isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
            )}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={toggleZoom}
          >
            <div className="flex h-full w-full items-center justify-center p-2">
              <img
                src={current.previewUrl}
                alt={current.name}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain will-change-transform motion-reduce:transition-none"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Sem prévia
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-1">
          <p className="min-w-0 text-[10px] leading-snug text-[#d4bc9f]">
            Scroll, pinça ou + / − para zoom · duplo clique · arraste quando ampliada
          </p>
          {hasMultiple && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 border-primary/40"
                disabled={page <= 0}
                onClick={() => setPage((i) => Math.max(0, i - 1))}
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 border-primary/40"
                disabled={page >= items.length - 1}
                onClick={() => setPage((i) => Math.min(items.length - 1, i + 1))}
                aria-label="Próxima"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PolaroidFrame({
  item,
  index,
  readOnly,
  onOpen,
  onRemove,
}: {
  item: AgendaAnexoPreview;
  index: number;
  readOnly?: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        'group relative w-[7.25rem] shrink-0 rounded-[3px] bg-[#faf2ea] p-1.5 pb-7 shadow-[0_10px_22px_rgba(0,0,0,0.38)] ring-1 ring-[#f2d892]/55 transition-transform duration-200',
        'hover:-translate-y-1 hover:rotate-[-1.2deg]',
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={!item.previewUrl}
        className="relative block h-20 w-full overflow-hidden rounded-[1px] bg-[#2a1812] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d892]"
        aria-label={`Ampliar ${item.name}`}
      >
        {item.converting ? (
          <span className="flex h-full items-center justify-center gap-1 text-[10px] text-[#f2d892]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            PDF
          </span>
        ) : item.error ? (
          <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-destructive">
            Falhou
          </span>
        ) : (
          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#1c100c]/90 px-2 py-0.5 text-[10px] font-medium text-[#f2d892]">
            <Maximize2 className="h-3 w-3" />
            Ver
          </span>
        </span>
      </button>
      <p className="absolute bottom-1.5 left-1.5 right-1.5 truncate font-display text-[9px] uppercase tracking-wide text-[#2a1812]">
        {item.badge || item.name}
      </p>
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2a1812] text-[#f2d892] opacity-0 shadow ring-1 ring-[#f2d892]/50 transition-opacity group-hover:opacity-100 focus:opacity-100 focus:outline-none"
          aria-label={`Remover ${item.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function AgendaItemAnexosField({
  draft,
  accept,
  readOnly = false,
  floatingLayer,
  title = 'Anexos',
  hint,
}: AgendaItemAnexosFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const acceptAttr = accept === 'images-and-pdfs' ? ACCEPT_IMAGES_AND_PDFS : ACCEPT_IMAGES;
  const defaultHint =
    accept === 'images-and-pdfs'
      ? 'Fotos e PDFs. O PDF vira fotos, página por página, só neste item.'
      : 'Só fotos. Elas ficam neste lembrete — não entram no card do lead.';

  const viewable = draft.previews.filter((item) => item.previewUrl);

  if (readOnly && draft.previews.length === 0) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files?.length || readOnly) return;
    void draft.addFiles(files);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (!readOnly) setDragOver(true);
  };

  return (
    <section
      className="space-y-2 rounded-xl border border-[#f2d892]/25 bg-[linear-gradient(180deg,rgba(88,60,46,0.42),rgba(42,24,18,0.28))] p-3"
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-sm uppercase tracking-[0.18em] text-[#f2d892]">
            {title}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-[#edd9c4]">{hint ?? defaultHint}</p>
        </div>
        <span className="shrink-0 rounded-full border border-[#f2d892]/30 px-2 py-0.5 text-[10px] text-[#f2d892]">
          {draft.currentCount}/{draft.maxCount}
        </span>
      </div>

      <div
        className={cn(
          'flex gap-3 overflow-x-auto pb-1 pt-1 [scrollbar-width:thin]',
          dragOver && 'ring-2 ring-[#f2d892]/70 rounded-lg',
        )}
      >
        {draft.previews.map((item, index) => (
          <PolaroidFrame
            key={item.key}
            item={item}
            index={index}
            readOnly={readOnly}
            onOpen={() => {
              const viewIndex = viewable.findIndex((v) => v.key === item.key);
              if (viewIndex >= 0) setLightboxIndex(viewIndex);
            }}
            onRemove={() => draft.removePreview(item.key)}
          />
        ))}

        {!readOnly && draft.currentCount < draft.maxCount && (
          <label
            htmlFor={inputId}
            className={cn(
              'flex h-[7.25rem] w-[7.25rem] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[3px] border border-dashed border-[#f2d892]/45 bg-[#2a1812]/40 text-center transition-colors',
              'hover:border-[#f2d892] hover:bg-[#2a1812]/70',
              dragOver && 'border-[#f2d892] bg-[#2a1812]/80',
            )}
          >
            {draft.converting ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#f2d892]" />
            ) : (
              <ImagePlus className="h-5 w-5 text-[#f2d892]" />
            )}
            <span className="px-2 font-display text-[10px] uppercase tracking-wide text-[#f2d892]">
              {accept === 'images-and-pdfs' ? 'Foto ou PDF' : 'Soltar foto'}
            </span>
          </label>
        )}
      </div>

      {!readOnly && (
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={acceptAttr}
          multiple
          onChange={(event) => handleFiles(event.target.files)}
        />
      )}

      <Lightbox
        items={viewable}
        index={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onOpenChange={(open) => {
          if (!open) setLightboxIndex(null);
        }}
        floatingLayer={floatingLayer}
      />
    </section>
  );
}

export function AgendaItemAnexosBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-[#f2d892]/35 bg-[#2a1812]/40 px-1.5 py-0.5 text-[10px] text-[#f2d892]',
        className,
      )}
    >
      <Paperclip className="h-3 w-3" />
      {count}
    </span>
  );
}

export function AgendaItemAnexosMiniStrip({
  urls,
  className,
}: {
  urls: string[];
  className?: string;
}) {
  if (urls.length === 0) return null;
  return (
    <div className={cn('mt-1.5 flex items-center gap-1', className)}>
      {urls.slice(0, 3).map((url) => (
        <img
          key={url}
          src={url}
          alt=""
          className="h-7 w-7 rounded-[2px] object-cover ring-1 ring-[#f2d892]/40"
        />
      ))}
      {urls.length > 3 && (
        <span className="text-[10px] text-[#f2d892]">+{urls.length - 3}</span>
      )}
    </div>
  );
}
