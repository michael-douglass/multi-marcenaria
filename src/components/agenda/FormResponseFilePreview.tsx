import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, FileText, Loader2, Maximize2, Play } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  parseAgendaFormUploadFieldValue,
  type AgendaFormUploadedFile,
} from '@/lib/agenda-form-uploads';
import { usePdfPageImages } from '@/hooks/usePdfPageImages';
import type { PdfPageImage } from '@/lib/pdf-render';

interface FormResponseFilePreviewProps {
  raw: string;
  className?: string;
}

function isImage(file: AgendaFormUploadedFile): boolean {
  return file.mime_type.toLowerCase().startsWith('image/');
}

function isVideo(file: AgendaFormUploadedFile): boolean {
  return file.mime_type.toLowerCase().startsWith('video/');
}

function isPdf(file: AgendaFormUploadedFile): boolean {
  const mime = file.mime_type.toLowerCase();
  return mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function ImageLightbox({
  src,
  alt,
  open,
  onOpenChange,
}: {
  src: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[min(96vw,56rem)] p-2 sm:p-4" aria-describedby={undefined}>
        <img src={src} alt={alt} className="w-full max-h-[80vh] object-contain rounded-md bg-muted" />
        <p className="text-xs text-muted-foreground text-center truncate px-2">{alt}</p>
      </DialogContent>
    </Dialog>
  );
}

function VideoLightbox({
  file,
  open,
  onOpenChange,
}: {
  file: AgendaFormUploadedFile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[min(96vw,56rem)] p-2 sm:p-4" aria-describedby={undefined}>
        <video src={file.url} controls autoPlay className="w-full max-h-[80vh] rounded-md bg-black">
          Seu navegador não suporta reprodução de vídeo.
        </video>
        <p className="text-xs text-muted-foreground text-center truncate px-2">{file.name}</p>
      </DialogContent>
    </Dialog>
  );
}

function PdfPagesLightbox({
  file,
  pages,
  initialPage,
  open,
  onOpenChange,
}: {
  file: AgendaFormUploadedFile;
  pages: PdfPageImage[];
  initialPage: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pageIndex, setPageIndex] = useState(initialPage);

  useEffect(() => {
    if (open) setPageIndex(initialPage);
  }, [open, initialPage]);

  const current = pages[pageIndex];
  const hasMultiple = pages.length > 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setPageIndex(initialPage);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-4xl w-[min(96vw,56rem)] p-2 sm:p-4" aria-describedby={undefined}>
        {current && (
          <img
            src={current.src}
            alt={`${file.name} — página ${current.pageNumber}`}
            className="w-full max-h-[80vh] object-contain rounded-md bg-muted"
          />
        )}
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted-foreground truncate min-w-0">
            {file.name}
            {hasMultiple && ` — página ${pageIndex + 1} de ${pages.length}`}
          </p>
          {hasMultiple && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={pageIndex <= 0}
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={pageIndex >= pages.length - 1}
                onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
                aria-label="Próxima página"
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

function ImageThumbnail({ file, onOpen }: { file: AgendaFormUploadedFile; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded-md border bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img src={file.url} alt={file.name} className="w-full h-28 sm:h-32 object-cover" loading="lazy" />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors">
        <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-background/90 text-foreground text-[10px] font-medium px-2 py-1 rounded-full shadow">
          <Maximize2 className="h-3 w-3" />
          Ampliar
        </span>
      </span>
    </button>
  );
}

function VideoThumbnail({ file, onOpen }: { file: AgendaFormUploadedFile; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded-md border bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <video src={file.url} className="w-full h-28 sm:h-32 object-cover pointer-events-none" muted preload="metadata" />
      <span className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/45 transition-colors">
        <span className="flex items-center gap-1.5 bg-background/90 text-foreground text-[10px] font-medium px-2.5 py-1 rounded-full shadow">
          <Play className="h-3 w-3 fill-current" />
          Reproduzir
        </span>
      </span>
    </button>
  );
}

function PdfThumbnail({
  file,
  pages,
  loading,
  error,
  onOpenPage,
}: {
  file: AgendaFormUploadedFile;
  pages: PdfPageImage[];
  loading: boolean;
  error: string | null;
  onOpenPage: (pageIndex: number) => void;
}) {
  if (loading) {
    return <Skeleton className="w-full h-28 sm:h-32 rounded-md" />;
  }

  if (error || pages.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">{error ?? `Não foi possível converter ${file.name}`}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={cn('grid gap-2', pages.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {pages.map((page, index) => (
          <button
            key={page.pageNumber}
            type="button"
            onClick={() => onOpenPage(index)}
            className="group relative block w-full overflow-hidden rounded-md border bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={page.src}
              alt={`${file.name} — página ${page.pageNumber}`}
              className="w-full h-28 sm:h-32 object-cover object-top bg-white"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors">
              <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-background/90 text-foreground text-[10px] font-medium px-2 py-1 rounded-full shadow">
                <Maximize2 className="h-3 w-3" />
                Página {page.pageNumber}
              </span>
            </span>
            {pages.length > 1 && (
              <span className="absolute top-1.5 right-1.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[9px] font-semibold shadow">
                {page.pageNumber}/{pages.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground truncate px-0.5">
        {file.name}
        {pages.length > 1 ? ` (${pages.length} páginas convertidas)` : ' (PDF convertido em imagem)'}
      </p>
    </div>
  );
}

type LightboxState =
  | { kind: 'image'; file: AgendaFormUploadedFile }
  | { kind: 'video'; file: AgendaFormUploadedFile }
  | { kind: 'pdf'; file: AgendaFormUploadedFile; pageIndex: number };

function FilePreviewItem({ file }: { file: AgendaFormUploadedFile }) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const pdfPages = usePdfPageImages(isPdf(file) ? file.url : null);

  if (isImage(file)) {
    return (
      <>
        <div className="space-y-1 min-w-0">
          <ImageThumbnail file={file} onOpen={() => setLightbox({ kind: 'image', file })} />
          <p className="text-[10px] text-muted-foreground truncate px-0.5">{file.name}</p>
        </div>
        <ImageLightbox
          src={file.url}
          alt={file.name}
          open={lightbox?.kind === 'image'}
          onOpenChange={(open) => !open && setLightbox(null)}
        />
      </>
    );
  }

  if (isVideo(file)) {
    return (
      <>
        <div className="space-y-1 min-w-0">
          <VideoThumbnail file={file} onOpen={() => setLightbox({ kind: 'video', file })} />
          <p className="text-[10px] text-muted-foreground truncate px-0.5">{file.name}</p>
        </div>
        <VideoLightbox
          file={file}
          open={lightbox?.kind === 'video'}
          onOpenChange={(open) => !open && setLightbox(null)}
        />
      </>
    );
  }

  if (isPdf(file)) {
    return (
      <>
        <PdfThumbnail
          file={file}
          pages={pdfPages.pages}
          loading={pdfPages.loading}
          error={pdfPages.error}
          onOpenPage={(pageIndex) => setLightbox({ kind: 'pdf', file, pageIndex })}
        />
        <PdfPagesLightbox
          file={file}
          pages={pdfPages.pages}
          initialPage={lightbox?.kind === 'pdf' ? lightbox.pageIndex : 0}
          open={lightbox?.kind === 'pdf'}
          onOpenChange={(open) => !open && setLightbox(null)}
        />
      </>
    );
  }

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm hover:bg-muted transition-colors"
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{file.name}</span>
    </a>
  );
}

export function FormResponseFilePreview({ raw, className }: FormResponseFilePreviewProps) {
  const files = parseAgendaFormUploadFieldValue(raw);

  if (files.length === 0) return null;

  const gridFiles = files.filter((file) => isImage(file) || isVideo(file));
  const blockFiles = files.filter((file) => !isImage(file) && !isVideo(file));

  return (
    <div className={cn('space-y-2', className)}>
      {gridFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {gridFiles.map((file) => (
            <FilePreviewItem key={`${file.url}-${file.name}`} file={file} />
          ))}
        </div>
      )}
      {blockFiles.length > 0 && (
        <div className="space-y-2">
          {blockFiles.map((file) => (
            <FilePreviewItem key={`${file.url}-${file.name}`} file={file} />
          ))}
        </div>
      )}
    </div>
  );
}
