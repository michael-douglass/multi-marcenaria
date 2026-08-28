import { useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BibliotecaMedia } from '@/hooks/useBibliotecaMedias';
import { formatBibliotecaDate, formatBibliotecaFileSize, getBibliotecaOrigemLabel } from '@/lib/biblioteca-utils';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Image as ImageIcon,
  Music,
  Trash2,
  Video,
} from 'lucide-react';

interface BibliotecaDetailDialogProps {
  media: BibliotecaMedia | null;
  /** Lista atual (pasta/filtro) para navegar entre fotos/arquivos com as setas. */
  galleryItems?: BibliotecaMedia[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDelete: boolean;
  /** Se false, oculta o botão Baixar. */
  canDownload?: boolean;
  onDelete: (media: BibliotecaMedia) => void;
  onDownload: (media: BibliotecaMedia) => void;
  onNavigate?: (media: BibliotecaMedia) => void;
}

function tipoIcon(tipo: BibliotecaMedia['tipo']) {
  switch (tipo) {
    case 'video':
      return <Video className="h-4 w-4" />;
    case 'audio':
      return <Music className="h-4 w-4" />;
    case 'pdf':
      return <FileText className="h-4 w-4" />;
    default:
      return <ImageIcon className="h-4 w-4" />;
  }
}

function renderPreview(media: BibliotecaMedia, canDownload: boolean) {
  const mediaControlsList = canDownload ? undefined : 'nodownload noplaybackrate';

  if (media.tipo === 'imagem') {
    return (
      <img
        src={media.file_url}
        alt={media.titulo}
        draggable={canDownload}
        onContextMenu={canDownload ? undefined : (e) => e.preventDefault()}
        className="max-h-[62vh] w-full rounded-xl object-contain shadow-2xl"
      />
    );
  }

  if (media.tipo === 'video') {
    return (
      <video
        key={media.id}
        src={media.file_url}
        controls
        controlsList={mediaControlsList}
        disablePictureInPicture={!canDownload}
        autoPlay
        className="max-h-[62vh] w-full rounded-xl bg-black shadow-2xl"
      />
    );
  }

  if (media.tipo === 'audio') {
    return (
      <div className="flex flex-col items-center gap-6 rounded-xl border border-white/10 bg-white/5 px-8 py-12">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/30">
          <Music className="h-10 w-10 text-amber-300" />
        </div>
        <audio
          key={media.id}
          src={media.file_url}
          controls
          controlsList={mediaControlsList}
          autoPlay
          className="w-full max-w-md"
        />
      </div>
    );
  }

  return (
    <iframe
      key={media.id}
      src={media.file_url}
      title={media.titulo}
      className="h-[62vh] w-full rounded-xl border border-white/10 bg-white shadow-2xl"
    />
  );
}

export function BibliotecaDetailDialog({
  media,
  galleryItems = [],
  open,
  onOpenChange,
  canDelete,
  canDownload = true,
  onDelete,
  onDownload,
  onNavigate,
}: BibliotecaDetailDialogProps) {
  const currentIndex = media ? galleryItems.findIndex((item) => item.id === media.id) : -1;
  const hasGallery = galleryItems.length > 1 && currentIndex >= 0;
  const canGoPrev = hasGallery && currentIndex > 0;
  const canGoNext = hasGallery && currentIndex < galleryItems.length - 1;

  const goPrev = useCallback(() => {
    if (!canGoPrev || !onNavigate) return;
    onNavigate(galleryItems[currentIndex - 1]);
  }, [canGoPrev, onNavigate, galleryItems, currentIndex]);

  const goNext = useCallback(() => {
    if (!canGoNext || !onNavigate) return;
    onNavigate(galleryItems[currentIndex + 1]);
  }, [canGoNext, onNavigate, galleryItems, currentIndex]);

  useEffect(() => {
    if (!open || !hasGallery) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, hasGallery, goPrev, goNext]);

  if (!media) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-white/10 bg-[#1a1410]/95 backdrop-blur-xl">
        <DialogHeader className="space-y-3 border-b border-white/10 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <DialogTitle className="font-display text-2xl tracking-wide text-amber-100">
                {media.titulo}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
                <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-200">
                  {tipoIcon(media.tipo)}
                  {media.tipo}
                </Badge>
                {media.origem !== 'biblioteca' && (
                  <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-200">
                    {getBibliotecaOrigemLabel(media.origem)}
                  </Badge>
                )}
                {media.lead_id != null && <span>Lead #{media.lead_id}</span>}
                <span>{formatBibliotecaFileSize(media.file_size)}</span>
                <span>•</span>
                <span>{formatBibliotecaDate(media.criado_em)}</span>
                {hasGallery && (
                  <>
                    <span>•</span>
                    <span>
                      {currentIndex + 1} de {galleryItems.length}
                    </span>
                  </>
                )}
              </div>
              <p className="truncate text-xs text-white/40">{media.file_name}</p>
            </div>

            <div className="flex shrink-0 gap-2">
              {canDownload && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/15 bg-white/5 hover:bg-white/10"
                  onClick={() => onDownload(media)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar
                </Button>
              )}
              {canDelete && (
                <Button variant="destructive" size="sm" onClick={() => onDelete(media)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="relative py-4">
          {hasGallery && (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute left-0 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full border-white/20 bg-black/55 text-white hover:bg-black/75 disabled:opacity-30"
                onClick={goPrev}
                disabled={!canGoPrev}
                aria-label="Arquivo anterior"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute right-0 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full border-white/20 bg-black/55 text-white hover:bg-black/75 disabled:opacity-30"
                onClick={goNext}
                disabled={!canGoNext}
                aria-label="Próximo arquivo"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}
          <div className={hasGallery ? 'px-12' : undefined}>
            {renderPreview(media, canDownload)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
