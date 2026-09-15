import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type DragEvent,
  type ReactNode,
  type TouchEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
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
import { Trash2, FileText, Upload, Loader2, Maximize2, X, Download, Image, Video, Play, CheckSquare, ChevronLeft, ChevronRight, FolderOpen, FolderPlus, FolderInput, Pencil } from 'lucide-react';
import {
  useLeadPDFs,
  getLeadAttachmentViewKind,
  type LeadPDF,
  type PendingLeadPDF,
} from '@/hooks/useLeadPDFs';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { usePermissions } from '@/hooks/usePermissions';
import type { PdfPageImage } from '@/lib/pdf-render';
import {
  getCachedPdfPages,
  getCachedPdfThumbnail,
  pdfCacheKeyForMedia,
  pdfCacheKeyForPending,
  prewarmPdfImages,
  prewarmPdfThumbnail,
  PDF_PREVIEW_WIDTH_PX,
} from '@/lib/pdf-image-cache';
import { downloadFileFromUrl } from '@/lib/download-file';
import { runWithFilePickerGuard } from '@/lib/dialog-outside-guard';
import { toast } from 'sonner';
import type { LeadPrestadorPermissao } from '@/hooks/useLeadPrestadorPermissoes';
import { filtrarAnexosParaPrestador } from '@/lib/prestador-visibilidade';
import { useLeadAIRenders, useDeleteLeadAIRender } from '@/hooks/useLeadAIRenders';
import { useLeadMediaFolders } from '@/hooks/useLeadMediaFolders';
import {
  LEAD_UNFILED_FOLDER_ID,
  countFolderFiles,
  findFolderByName,
  getFolderCoverUrls,
  isAttachmentInLeadFolder,
  isLeadUnfiledFolderId,
  normalizeFolderName,
} from '@/lib/lead-media-folders';
import {
  canDeleteLeadAttachments,
  canManageLeadAttachments,
} from '@/lib/lead-attachments-access';
import { LeadFolderPickDialog } from '@/components/leads/LeadFolderPickDialog';
import { LeadAttachmentFolderCard } from '@/components/leads/LeadAttachmentFolderCard';
import { requestLeadWhiteboardImport } from '@/lib/lead-whiteboard-import';
import { Checkbox } from '@/components/ui/checkbox';
import {
  buildLeadFotosPdfFile,
  openLeadFotosPdfPrint,
} from '@/lib/lead-fotos-pdf-export';
import {
  LeadFotosExportDialog,
  type LeadFotosExportAction,
} from '@/components/leads/LeadFotosExportDialog';
import { LeadAttachmentDownloadMenu } from '@/components/leads/LeadAttachmentDownloadMenu';
import {
  aiRenderToLeadPDF,
  isAiRenderAttachmentId,
  listUnsyncedAiRenders,
  resolveAiRenderIdFromAttachment,
} from '@/lib/lead-ai-render-attachments';
import { useLeadFormUploadAttachments } from '@/hooks/useLeadFormUploadAttachments';
import {
  isFormUploadAttachmentId,
  mergeLeadAttachmentsDedupeByUrl,
} from '@/lib/lead-form-upload-attachments';

// ─── Miniatura de imagem ─────────────────────────────────────────────────────

interface ImageThumbnailProps {
  fileUrl: string;
  fileName: string;
}

function ImageThumbnail({ fileUrl, fileName }: ImageThumbnailProps) {
  return (
    <div className="relative w-full group/thumb pointer-events-none">
      <img
        src={fileUrl}
        alt={`Prévia de ${fileName}`}
        className="w-full h-auto max-h-48 rounded object-contain bg-white"
        loading="lazy"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/thumb:bg-black/20 transition-colors rounded">
        <span className="opacity-0 group-hover/thumb:opacity-100 flex items-center gap-1.5 bg-background/90 text-foreground text-xs font-medium px-2.5 py-1.5 rounded-full shadow">
          <Maximize2 className="h-3.5 w-3.5" />
          Ampliar
        </span>
      </div>
    </div>
  );
}

// ─── PDF Thumbnail (1ª página como imagem) ───────────────────────────────────

interface PDFThumbnailProps {
  cacheKey: string;
  fileUrl: string;
  fileName: string;
  file?: File;
}

function PDFThumbnail({ cacheKey, fileUrl, fileName, file }: PDFThumbnailProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const cached = getCachedPdfThumbnail(cacheKey);
    if (cached) {
      setImageSrc(cached);
      setLoading(false);
      return;
    }

    const source = file ? { file } : { url: fileUrl };
    const timeout = new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), 8000);
    });
    Promise.race([prewarmPdfThumbnail(cacheKey, source), timeout])
      .then((src) => {
        if (!cancelled) {
          setImageSrc(src);
          setLoading(false);
          if (!src) setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, fileUrl, file]);

  if (loading) {
    return <Skeleton className="w-full aspect-[3/4]" />;
  }

  if (error || !imageSrc) {
    return (
      <div className="w-full aspect-[3/4] flex flex-col items-center justify-center bg-muted rounded gap-2">
        <FileText className="h-10 w-10 text-muted-foreground" />
        <span className="text-xs text-muted-foreground px-2 text-center">
          Clique para abrir em tela cheia
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full group/thumb pointer-events-none">
      <img
        src={imageSrc}
        alt={`Prévia de ${fileName}`}
        className="w-full h-auto rounded object-contain bg-white"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/thumb:bg-black/20 transition-colors rounded">
        <span className="opacity-0 group-hover/thumb:opacity-100 flex items-center gap-1.5 bg-background/90 text-foreground text-xs font-medium px-2.5 py-1.5 rounded-full shadow">
          <Maximize2 className="h-3.5 w-3.5" />
          Tela cheia
        </span>
      </div>
    </div>
  );
}

// ─── Miniatura de vídeo ───────────────────────────────────────────────────────

interface VideoThumbnailProps {
  fileUrl: string;
  fileName: string;
}

function VideoThumbnail({ fileUrl, fileName }: VideoThumbnailProps) {
  return (
    <div className="relative w-full aspect-video bg-black rounded overflow-hidden pointer-events-none">
      <video
        src={fileUrl}
        className="w-full h-full object-contain"
        muted
        playsInline
        preload="metadata"
        aria-label={`Prévia de ${fileName}`}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background/90 shadow">
          <Play className="h-5 w-5 text-foreground ml-0.5" />
        </span>
      </div>
    </div>
  );
}

interface AttachmentThumbnailProps {
  cacheKey: string;
  fileUrl: string;
  fileName: string;
  file?: File;
  tipo: 'pdf' | 'imagem' | 'video';
}

function AttachmentThumbnail({ cacheKey, fileUrl, fileName, file, tipo }: AttachmentThumbnailProps) {
  if (tipo === 'imagem') {
    return <ImageThumbnail fileUrl={fileUrl} fileName={fileName} />;
  }
  if (tipo === 'video') {
    return <VideoThumbnail fileUrl={fileUrl} fileName={fileName} />;
  }
  return (
    <PDFThumbnail cacheKey={cacheKey} fileUrl={fileUrl} fileName={fileName} file={file} />
  );
}

/** Camada acima de modais do prestador (z-60) e do menu (z-50) */
const FULLSCREEN_OVERLAY_Z = 'z-[100]';
const FULLSCREEN_CONTENT_Z = 'z-[101]';

interface FullscreenAttachmentShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  titleIcon: typeof FileText;
  canDownload: boolean;
  isDownloading: boolean;
  onDownload: () => void;
  downloadLabel?: string;
  downloadSlot?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}

function FullscreenAttachmentShell({
  open,
  onClose,
  title,
  titleIcon: TitleIcon,
  canDownload,
  isDownloading,
  onDownload,
  downloadLabel = 'Baixar',
  downloadSlot,
  meta,
  children,
}: FullscreenAttachmentShellProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPortal>
        <DialogOverlay
          className={cn(
            FULLSCREEN_OVERLAY_Z,
            'bg-black/95 backdrop-blur-sm',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            FULLSCREEN_CONTENT_Z,
            'fixed inset-0 flex flex-col gap-0 border-0 p-0 shadow-2xl',
            'bg-neutral-950 text-white outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
          onEscapeKeyDown={onClose}
        >
          <header className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <DialogPrimitive.Title className="flex min-w-0 items-center gap-2 text-base font-medium truncate pr-2">
              <TitleIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{title}</span>
            </DialogPrimitive.Title>
            <div className="flex shrink-0 items-center gap-2">
              {meta}
              {canDownload && downloadSlot}
              {canDownload && !downloadSlot && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isDownloading}
                  onClick={() => void onDownload()}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  {downloadLabel}
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4 mr-1" />
                Fechar
              </Button>
            </div>
          </header>
          {children}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

// ─── Visualizador em tela cheia (todas as páginas como imagens) ───────────────

interface PDFFullscreenViewerProps {
  cacheKey: string;
  fileUrl: string;
  fileName: string;
  file?: File;
  open: boolean;
  onClose: () => void;
  canDownload: boolean;
}

function PDFFullscreenViewer({
  cacheKey,
  fileUrl,
  fileName,
  file,
  open,
  onClose,
  canDownload,
}: PDFFullscreenViewerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [pages, setPages] = useState<PdfPageImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadFileFromUrl(fileUrl, fileName);
      toast.success('Download iniciado');
    } catch (err) {
      toast.error('Não foi possível baixar o PDF', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setPages([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);

    const cached = getCachedPdfPages(cacheKey);
    if (cached?.length) {
      setPages(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setPages([]);

    const source = file ? { file } : { url: fileUrl };
    prewarmPdfImages(cacheKey, source, PDF_PREVIEW_WIDTH_PX)
      .then((images) => {
        if (!cancelled) {
          setPages(images);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao converter PDF');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, cacheKey, fileUrl, file]);

  return (
    <FullscreenAttachmentShell
      open={open}
      onClose={onClose}
      title={fileName}
      titleIcon={FileText}
      canDownload={canDownload}
      isDownloading={isDownloading}
      onDownload={handleDownload}
      downloadLabel="Baixar PDF"
      meta={
        pages.length > 0 ? (
          <span className="text-xs text-white/50">
            {pages.length} página{pages.length !== 1 ? 's' : ''}
          </span>
        ) : undefined
      }
    >
      <ScrollArea className="flex-1 min-h-0 bg-neutral-950">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-white/60">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400/90" />
            <p className="text-sm">Abrindo visualização...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 px-4 text-center">
            <FileText className="h-12 w-12 text-white/30" />
            <p className="text-sm text-red-400">{error}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canDownload && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isDownloading}
                  onClick={() => void handleDownload()}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  Baixar PDF original
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && pages.length > 0 && (
          <div className="flex flex-col items-center gap-4 p-4 pb-8">
            {pages.map((page) => (
              <figure key={page.pageNumber} className="w-full max-w-5xl">
                <figcaption className="text-xs text-white/45 mb-1.5 text-center">
                  Página {page.pageNumber} de {pages.length}
                </figcaption>
                <img
                  src={page.src}
                  alt={`${fileName} — página ${page.pageNumber}`}
                  className="w-full h-auto rounded-md border border-white/10 bg-white shadow-lg"
                  width={page.width}
                  height={page.height}
                  loading="eager"
                />
              </figure>
            ))}
          </div>
        )}
      </ScrollArea>
    </FullscreenAttachmentShell>
  );
}

interface GalleryImageItem {
  key: string;
  fileUrl: string;
  fileName: string;
  imageLabel?: string;
}

interface ImageFullscreenViewerProps {
  images: GalleryImageItem[];
  initialIndex: number;
  leadName?: string | null;
  leadId?: number | null;
  open: boolean;
  onClose: () => void;
  canDownload: boolean;
}

const SWIPE_THRESHOLD_PX = 48;

function ImageFullscreenViewer({
  images,
  initialIndex,
  leadName,
  leadId,
  open,
  onClose,
  canDownload,
}: ImageFullscreenViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setIndex(Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1)));
    }
  }, [open, initialIndex, images.length]);

  const total = images.length;
  const hasGallery = total > 1;
  const current = images[index] ?? images[0];

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setIndex((prev) => (prev <= 0 ? total - 1 : prev - 1));
  }, [total]);

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setIndex((prev) => (prev >= total - 1 ? 0 : prev + 1));
  }, [total]);

  useEffect(() => {
    if (!open || !hasGallery) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, hasGallery, goPrev, goNext]);

  const handleTouchStart = (e: TouchEvent) => {
    if (!hasGallery) return;
    touchStartXRef.current = e.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!hasGallery || touchStartXRef.current == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) {
      touchStartXRef.current = null;
      return;
    }
    const delta = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta > 0) goPrev();
    else goNext();
  };

  if (!current) return null;

  return (
    <FullscreenAttachmentShell
      open={open}
      onClose={onClose}
      title={current.fileName}
      titleIcon={Image}
      canDownload={canDownload}
      isDownloading={false}
      onDownload={() => {}}
      meta={
        hasGallery ? (
          <span className="text-xs text-white/50 tabular-nums">
            {index + 1} / {total}
          </span>
        ) : undefined
      }
      downloadSlot={
        canDownload ? (
          <LeadAttachmentDownloadMenu
            imageUrl={current.fileUrl}
            fileName={current.fileName}
            imageLabel={current.imageLabel}
            leadName={leadName}
            leadId={leadId}
            triggerLabel="Baixar"
            menuModal
            triggerClassName="h-8 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          />
        ) : undefined
      }
    >
      <div
        className="relative flex flex-1 min-h-0 items-center justify-center bg-neutral-950 select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {hasGallery && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute left-2 z-10 h-11 w-11 rounded-full border-white/20 bg-black/50 text-white hover:bg-black/70 hover:text-white sm:left-4"
            onClick={goPrev}
            aria-label="Foto anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}

        <ScrollArea className="h-full w-full">
          <div className="flex min-h-[50vh] items-center justify-center p-4 sm:px-16">
            <img
              key={current.key}
              src={current.fileUrl}
              alt={current.fileName}
              className="max-h-[85vh] max-w-full rounded-md border border-white/10 bg-white object-contain shadow-lg"
              loading="eager"
              draggable={false}
            />
          </div>
        </ScrollArea>

        {hasGallery && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute right-2 z-10 h-11 w-11 rounded-full border-white/20 bg-black/50 text-white hover:bg-black/70 hover:text-white sm:right-4"
            onClick={goNext}
            aria-label="Próxima foto"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}

        {hasGallery && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[11px] text-white/70">
            Deslize ou use ← → para ver as outras fotos
          </p>
        )}
      </div>
    </FullscreenAttachmentShell>
  );
}

interface VideoFullscreenViewerProps {
  fileUrl: string;
  fileName: string;
  open: boolean;
  onClose: () => void;
  canDownload: boolean;
}

function VideoFullscreenViewer({
  fileUrl,
  fileName,
  open,
  onClose,
  canDownload,
}: VideoFullscreenViewerProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadFileFromUrl(fileUrl, fileName);
      toast.success('Download iniciado');
    } catch (err) {
      toast.error('Não foi possível baixar o vídeo', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <FullscreenAttachmentShell
      open={open}
      onClose={onClose}
      title={fileName}
      titleIcon={Video}
      canDownload={canDownload}
      isDownloading={isDownloading}
      onDownload={handleDownload}
    >
      <div className="flex flex-1 items-center justify-center p-4 bg-black">
        <video
          src={fileUrl}
          controls
          autoPlay
          playsInline
          className="max-h-[calc(100vh-5rem)] max-w-full rounded-md shadow-2xl"
        >
          Seu navegador não suporta reprodução de vídeo.
        </video>
      </div>
    </FullscreenAttachmentShell>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface LeadPDFAttachmentsProps {
  leadId: number | null | undefined;
  /** Nome do lead para subtítulo do PDF exportado */
  leadName?: string | null;
  /** Prestador: só visualiza PDFs/imagens já anexados ao lead */
  readOnly?: boolean;
  /** Filtra anexos conforme permissões granulares do prestador */
  prestadorPerm?: LeadPrestadorPermissao | null;
  /** Evita fechar o modal do lead ao abrir o seletor de arquivos do sistema */
  onFilePickerActiveChange?: (active: boolean) => void;
}

export interface LeadPDFAttachmentsHandle {
  flushPendingPdfs: (leadId: number) => Promise<void>;
  hasPendingPdfs: boolean;
  clearPendingPdfs: () => void;
}

export const LeadPDFAttachments = forwardRef<LeadPDFAttachmentsHandle, LeadPDFAttachmentsProps>(
  function LeadPDFAttachments({ leadId, leadName, readOnly = false, prestadorPerm = null, onFilePickerActiveChange }, ref) {
  const { userRole, userRoles, isSuperAdmin: isSuperAdminAuth } = useAuth();
  const { empresa, isSuperAdmin: isSuperAdminEmpresa } = useEmpresa();
  const { hasPermission } = usePermissions();
  const {
    pdfs,
    pendingPdfs,
    isLoading,
    uploadPDF,
    uploadAttachment,
    moveAttachmentsToFolder,
    deletePDF,
    removePendingPDF,
    flushPendingPDFs,
    clearPendingPdfs,
    hasPendingPdfs,
  } = useLeadPDFs(leadId);
  const { folders, isLoading: foldersLoading, createFolder, updateFolder, deleteFolder } =
    useLeadMediaFolders(leadId);
  const { formUploadAttachments } = useLeadFormUploadAttachments(leadId);
  const { data: aiRenders = [] } = useLeadAIRenders(leadId);
  const deleteRenderMutation = useDeleteLeadAIRender(leadId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [uploadFolderName, setUploadFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderDraft, setNewFolderDraft] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[] | null>(null);
  const [movePickOpen, setMovePickOpen] = useState(false);
  const [idsToMove, setIdsToMove] = useState<string[] | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; nome: string } | null>(null);
  const [forcedGallery, setForcedGallery] = useState<GalleryImageItem[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fileUrl: string; fileName?: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [fullscreenView, setFullscreenView] = useState<{
    kind: 'pdf' | 'image' | 'video';
    cacheKey: string;
    fileUrl: string;
    fileName: string;
    imageLabel?: string;
    imageKey?: string;
    file?: File;
  } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(() => new Set());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExportProcessing, setIsExportProcessing] = useState(false);
  const [insideRename, setInsideRename] = useState(false);
  const [insideRenameDraft, setInsideRenameDraft] = useState('');

  const anexosComRenders = useMemo(() => {
    const unsynced = listUnsyncedAiRenders(aiRenders, pdfs).map(aiRenderToLeadPDF);
    const withForm = mergeLeadAttachmentsDedupeByUrl(pdfs, formUploadAttachments);
    const merged = [...withForm, ...unsynced];
    return merged.sort(
      (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
    );
  }, [aiRenders, pdfs, formUploadAttachments]);

  const pdfsVisiveis = prestadorPerm
    ? filtrarAnexosParaPrestador(anexosComRenders, prestadorPerm)
    : anexosComRenders;

  const leadFolderIds = useMemo(() => new Set(folders.map((folder) => folder.id)), [folders]);
  const currentFolder = folders.find((folder) => folder.id === currentFolderId) ?? null;
  const viewingRoot = currentFolderId === null;
  const viewingUnfiled = isLeadUnfiledFolderId(currentFolderId);

  const filesInView = useMemo(() => {
    if (viewingRoot) return [];
    if (viewingUnfiled) {
      return pdfsVisiveis.filter((item) => !isAttachmentInLeadFolder(item.folder_id, leadFolderIds));
    }
    return pdfsVisiveis.filter((item) => item.folder_id === currentFolderId);
  }, [pdfsVisiveis, viewingRoot, viewingUnfiled, currentFolderId, leadFolderIds]);

  const pendingInView = useMemo(() => {
    if (viewingRoot) {
      return pendingPdfs.filter((item) => !item.folderId && !item.folderName);
    }
    if (viewingUnfiled) {
      return pendingPdfs.filter((item) => item.folderId === null && !item.folderName);
    }
    return pendingPdfs.filter(
      (item) =>
        item.folderId === currentFolderId ||
        (!!currentFolder &&
          normalizeFolderName(item.folderName).toLowerCase() === currentFolder.nome.trim().toLowerCase()),
    );
  }, [pendingPdfs, viewingRoot, viewingUnfiled, currentFolderId, currentFolder]);

  const unfiledItems = useMemo(
    () => pdfsVisiveis.filter((item) => !isAttachmentInLeadFolder(item.folder_id, leadFolderIds)),
    [pdfsVisiveis, leadFolderIds],
  );
  const unfiledCount = unfiledItems.length + pendingPdfs.filter((p) => !p.folderId && !p.folderName).length;

  const coverSource = useMemo(
    () =>
      pdfsVisiveis.map((item) => ({
        folder_id: isAttachmentInLeadFolder(item.folder_id, leadFolderIds) ? item.folder_id : null,
        tipo: item.tipo,
        file_url: item.file_url,
      })),
    [pdfsVisiveis, leadFolderIds],
  );

  useImperativeHandle(
    ref,
    () => ({
      flushPendingPdfs: flushPendingPDFs,
      hasPendingPdfs,
      clearPendingPdfs,
    }),
    [flushPendingPDFs, hasPendingPdfs, clearPendingPdfs],
  );

  useEffect(() => {
    setInsideRename(false);
    setInsideRenameDraft('');
    setIsSelectionMode(false);
    setSelectedImageIds(new Set());
  }, [currentFolderId]);

  useEffect(() => {
    if (!currentFolderId || isLeadUnfiledFolderId(currentFolderId)) return;
    // Evita fechar a pasta nova enquanto a lista ainda está carregando/atualizando.
    if (foldersLoading || folders.length === 0) return;
    if (!folders.some((folder) => folder.id === currentFolderId)) {
      setCurrentFolderId(null);
    }
  }, [currentFolderId, folders, foldersLoading]);

  const galleryImages = useMemo((): GalleryImageItem[] => {
    const sourcePending = viewingRoot ? pendingPdfs : pendingInView;
    const sourceSaved = viewingRoot ? pdfsVisiveis : filesInView;
    const pendingImages = sourcePending
      .filter((pending) => getLeadAttachmentViewKind(pending) === 'image')
      .map((pending) => ({
        key: `pending:${pending.tempId}`,
        fileUrl: pending.previewUrl,
        fileName: pending.file.name,
        imageLabel: pending.file.name,
      }));
    const savedImages = sourceSaved
      .filter((pdf) => getLeadAttachmentViewKind(pdf) === 'image')
      .map((pdf) => ({
        key: pdf.id,
        fileUrl: pdf.file_url,
        fileName: pdf.file_name,
        imageLabel: pdf.titulo || pdf.file_name,
      }));
    return [...pendingImages, ...savedImages];
  }, [pendingPdfs, pdfsVisiveis, pendingInView, filesInView, viewingRoot]);

  const selectableImages = useMemo(
    () => filesInView.filter((pdf) => getLeadAttachmentViewKind(pdf) === 'image'),
    [filesInView],
  );

  /** Arquivos que podem mudar de pasta (anexos reais ou Render IA virtual). */
  const movableFiles = useMemo(
    () =>
      filesInView.filter(
        (pdf) => !isFormUploadAttachmentId(pdf.id),
      ),
    [filesInView],
  );

  const canUseSelectionMode =
    (!viewingRoot && movableFiles.length >= 1) || selectableImages.length >= 2;

  const toggleImageSelection = useCallback((id: string) => {
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedImageIds(new Set());
    setBulkDeleteOpen(false);
  }, []);

  const deletableSelected = useMemo(
    () =>
      filesInView.filter(
        (pdf) => selectedImageIds.has(pdf.id) && !isFormUploadAttachmentId(pdf.id),
      ),
    [filesInView, selectedImageIds],
  );

  const openMovePicker = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      toast.error('Selecione ao menos um arquivo para mover.');
      return;
    }
    if (!leadId) {
      toast.error('Salve o lead antes de mover arquivos.');
      return;
    }
    setIdsToMove(ids);
    setMovePickOpen(true);
  }, [leadId]);

  const handleMoveConfirm = useCallback(
    async (folderId: string | null) => {
      const ids = idsToMove ?? [];
      if (ids.length === 0) return;

      const items = pdfsVisiveis.filter((pdf) => ids.includes(pdf.id) && !isFormUploadAttachmentId(pdf.id));
      if (items.length === 0) {
        toast.error('Nenhum arquivo válido para mover.');
        return;
      }

      setIsMoving(true);
      try {
        const moved = await moveAttachmentsToFolder(items, folderId);
        setMovePickOpen(false);
        setIdsToMove(null);
        exitSelectionMode();
        if (folderId) setCurrentFolderId(folderId);
        else setCurrentFolderId(LEAD_UNFILED_FOLDER_ID);
        toast.success(
          moved === 1
            ? 'Arquivo movido para a pasta'
            : `${moved} arquivos movidos para a pasta`,
        );
      } catch (error) {
        toast.error('Não foi possível mover os arquivos', {
          description: error instanceof Error ? error.message : 'Tente novamente.',
        });
      } finally {
        setIsMoving(false);
      }
    },
    [idsToMove, pdfsVisiveis, moveAttachmentsToFolder, exitSelectionMode],
  );

  const handleExportConfirm = useCallback(
    async (action: LeadFotosExportAction) => {
      const selectedPdfs = selectableImages.filter((pdf) => selectedImageIds.has(pdf.id));
      if (selectedPdfs.length < 2) {
        toast.error('Selecione pelo menos 2 fotos para exportar.');
        return;
      }

      setIsExportProcessing(true);
      try {
        const exportInput = {
          imageUrls: selectedPdfs.map((pdf) => pdf.file_url),
          imageLabels: selectedPdfs.map((pdf) => pdf.titulo || pdf.file_name),
          logoUrl: empresa?.logo_url,
          nomeEmpresa: empresa?.nome,
          cnpj: empresa?.cnpj,
          leadName,
          leadId,
        };

        if (action === 'export' || action === 'both') {
          openLeadFotosPdfPrint(exportInput);
        }

        if (action === 'attach' || action === 'both') {
          const file = await buildLeadFotosPdfFile(exportInput);
          await uploadPDF(file, {
            folderId: viewingUnfiled ? null : currentFolderId,
            folderName: viewingRoot ? normalizeFolderName(uploadFolderName) || undefined : currentFolder?.nome,
          });
        }

        if (action === 'export') {
          toast.success('PDF pronto para salvar ou imprimir');
        } else if (action === 'attach') {
          toast.success('PDF anexado ao lead');
        } else {
          toast.success('PDF exportado e anexado ao lead');
        }

        setExportDialogOpen(false);
        exitSelectionMode();
      } catch (error) {
        toast.error('Não foi possível exportar as fotos', {
          description: error instanceof Error ? error.message : 'Tente novamente.',
        });
      } finally {
        setIsExportProcessing(false);
      }
    },
    [
      selectableImages,
      selectedImageIds,
      empresa?.logo_url,
      empresa?.nome,
      empresa?.cnpj,
      leadName,
      leadId,
      uploadPDF,
      exitSelectionMode,
      viewingUnfiled,
      currentFolderId,
      viewingRoot,
      uploadFolderName,
      currentFolder?.nome,
    ],
  );

  const isMasterUser = isSuperAdminAuth || isSuperAdminEmpresa || userRole === 'admin';
  const canUploadPdf = canManageLeadAttachments({
    readOnly,
    isSuperAdmin: isMasterUser,
    userRole,
    userRoles,
    hasLeadsEdit: hasPermission('leads', 'edit'),
  });
  const canDownloadPdf =
    readOnly || isMasterUser || userRole === 'admin' || userRole === 'vendedor' || userRole === 'projetista' || userRole === 'projetista_admin';
  const canDeletePdf = canDeleteLeadAttachments({
    readOnly,
    isSuperAdmin: isMasterUser,
    userRole,
    userRoles,
  });

  const handleDownloadPdf = useCallback(async (pdf: LeadPDF) => {
    setDownloadingId(pdf.id);
    try {
      await downloadFileFromUrl(pdf.file_url, pdf.file_name);
      toast.success('Download iniciado');
    } catch (err) {
      toast.error('Não foi possível baixar o PDF', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const openFullscreen = useCallback(
    async (
      kind: 'pdf' | 'image' | 'video',
      cacheKey: string,
      fileUrl: string,
      fileName: string,
      file?: File,
      prepareKey?: string,
      imageLabel?: string,
      imageKey?: string,
    ) => {
      const source = file ? { file } : { url: fileUrl };

      if (kind === 'pdf' && !getCachedPdfPages(cacheKey)?.length) {
        if (prepareKey) setPreparingId(prepareKey);
        try {
          await Promise.all([
            prewarmPdfImages(cacheKey, source, PDF_PREVIEW_WIDTH_PX),
            prewarmPdfThumbnail(cacheKey, source),
          ]);
        } catch {
          toast.error('Não foi possível preparar a visualização do PDF');
          return;
        } finally {
          if (prepareKey) setPreparingId(null);
        }
      }

      setFullscreenView({ kind, cacheKey, fileUrl, fileName, file, imageLabel, imageKey });
    },
    [],
  );

  const openPendingFullscreen = useCallback(
    (pending: PendingLeadPDF) => {
      const kind = getLeadAttachmentViewKind(pending);
      void openFullscreen(
        kind,
        pdfCacheKeyForPending(pending.tempId),
        pending.previewUrl,
        pending.file.name,
        pending.file,
        pending.tempId,
        pending.file.name,
        kind === 'image' ? `pending:${pending.tempId}` : undefined,
      );
    },
    [openFullscreen],
  );

  const openFilePicker = useCallback(() => {
    if (!fileInputRef.current) return;
    runWithFilePickerGuard(
      (active) => onFilePickerActiveChange?.(active),
      () => fileInputRef.current?.click(),
    );
  }, [onFilePickerActiveChange]);

  const resolveUploadFolder = useCallback(async () => {
    if (!viewingRoot && !viewingUnfiled && currentFolderId) {
      return { folderId: currentFolderId as string | null, folderName: currentFolder?.nome };
    }
    const typed = normalizeFolderName(uploadFolderName);
    if (typed) {
      if (!leadId) return { folderId: null as string | null, folderName: typed };
      const existing = findFolderByName(folders, typed);
      if (existing) return { folderId: existing.id, folderName: typed };
      const created = await createFolder({ nome: typed });
      setCurrentFolderId(created.id);
      setUploadFolderName('');
      return { folderId: created.id, folderName: typed };
    }
    return null;
  }, [
    viewingRoot,
    viewingUnfiled,
    currentFolderId,
    currentFolder?.nome,
    uploadFolderName,
    leadId,
    folders,
    createFolder,
  ]);

  const sendFilesToFolder = useCallback(
    async (files: File[], folder: { folderId?: string | null; folderName?: string }) => {
      setUploading(true);
      try {
        for (const file of files) {
          if (!leadId) {
            await uploadPDF(file, folder);
          } else if (folder.folderId !== undefined || folder.folderName) {
            if (folder.folderId) {
              await uploadAttachment(file, folder.folderId);
            } else if (folder.folderName) {
              const existing = findFolderByName(folders, folder.folderName);
              const created = existing ?? (await createFolder({ nome: folder.folderName }));
              await uploadAttachment(file, created.id);
              setCurrentFolderId(created.id);
            } else {
              await uploadAttachment(file, null);
            }
          } else {
            await uploadPDF(file, folder);
          }
        }
      } finally {
        setUploading(false);
        onFilePickerActiveChange?.(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [leadId, uploadPDF, uploadAttachment, folders, createFolder, onFilePickerActiveChange],
  );

  const handleFiles = useCallback(
    async (files: FileList | null, fromDrop = false) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files);

      if (!viewingRoot && viewingUnfiled) {
        await sendFilesToFolder(list, { folderId: null });
        return;
      }

      if (!viewingRoot && currentFolderId) {
        await sendFilesToFolder(list, { folderId: currentFolderId, folderName: currentFolder?.nome });
        return;
      }

      const typed = normalizeFolderName(uploadFolderName);
      if (typed) {
        const target = await resolveUploadFolder();
        if (target) await sendFilesToFolder(list, target);
        return;
      }

      if (!fromDrop) {
        toast.error('Escreva o nome da pasta…', {
          description: 'Ex.: Sala, Cozinha, Fachada — toda foto entra numa gaveta.',
        });
        onFilePickerActiveChange?.(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setQueuedFiles(list);
      setPickOpen(true);
    },
    [
      viewingRoot,
      viewingUnfiled,
      currentFolderId,
      currentFolder?.nome,
      uploadFolderName,
      resolveUploadFolder,
      sendFilesToFolder,
      onFilePickerActiveChange,
    ],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files, true);
    },
    [handleFiles]
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    const renderId = resolveAiRenderIdFromAttachment({
      id: deleteTarget.id,
      fileUrl: deleteTarget.fileUrl,
      fileName: deleteTarget.fileName,
    });
    const linkedRender = renderId ? aiRenders.find((entry) => entry.id === renderId) : null;

    if (linkedRender) {
      await deleteRenderMutation.mutateAsync(linkedRender);
    } else {
      await deletePDF(deleteTarget.id, deleteTarget.fileUrl);
    }
    setDeleteTarget(null);
  };

  const handleConfirmBulkDelete = async () => {
    if (deletableSelected.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }

    setIsBulkDeleting(true);
    let removidos = 0;
    let falhas = 0;

    try {
      for (const pdf of deletableSelected) {
        try {
          const renderId = resolveAiRenderIdFromAttachment({
            id: pdf.id,
            fileUrl: pdf.file_url,
            fileName: pdf.file_name,
          });
          const linkedRender = renderId ? aiRenders.find((entry) => entry.id === renderId) : null;

          if (linkedRender) {
            await deleteRenderMutation.mutateAsync({ ...linkedRender, silent: true });
          } else {
            await deletePDF(pdf.id, pdf.file_url, { silent: true });
          }
          removidos += 1;
        } catch (error) {
          console.error('Erro ao excluir anexo em lote:', error);
          falhas += 1;
        }
      }

      if (removidos > 0) {
        toast.success(
          removidos === 1
            ? '1 arquivo removido'
            : `${removidos} arquivos removidos`,
        );
      }
      if (falhas > 0) {
        toast.error(
          falhas === 1
            ? '1 arquivo não pôde ser removido'
            : `${falhas} arquivos não puderam ser removidos`,
        );
      }

      setBulkDeleteOpen(false);
      exitSelectionMode();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleCreateNamedFolder = async () => {
    const nome = normalizeFolderName(newFolderDraft);
    if (!nome) return;
    if (!leadId) {
      toast.error('Salve o lead antes de criar pastas');
      return;
    }
    try {
      const created = await createFolder({ nome });
      setNewFolderDraft('');
      setCreatingFolder(false);
      // Entra direto na pasta recém-criada.
      setCurrentFolderId(created.id);
    } catch {
      /* toast no hook */
    }
  };

  const handleBaptizeUnfiled = async (nome: string) => {
    if (!leadId) {
      toast.error('Salve o lead antes de criar pastas');
      return;
    }
    const created = await createFolder({ nome });
    await moveAttachmentsToFolder(
      unfiledItems.filter((item) => !isFormUploadAttachmentId(item.id)),
      created.id,
    );
    setCurrentFolderId(created.id);
  };

  const openFolderSlideshow = (folderId: string | null) => {
    const images =
      folderId === null
        ? unfiledItems.filter((item) => getLeadAttachmentViewKind(item) === 'image')
        : pdfsVisiveis.filter(
            (item) => item.folder_id === folderId && getLeadAttachmentViewKind(item) === 'image',
          );
    if (images.length === 0) {
      toast.error('Esta pasta ainda não tem fotos');
      return;
    }
    const gallery = images.map((pdf) => ({
      key: pdf.id,
      fileUrl: pdf.file_url,
      fileName: pdf.file_name,
      imageLabel: pdf.titulo || pdf.file_name,
    }));
    setForcedGallery(gallery);
    const first = images[0];
    void openFullscreen(
      'image',
      pdfCacheKeyForMedia(first.id),
      first.file_url,
      first.file_name,
      undefined,
      first.id,
      first.titulo || first.file_name,
      first.id,
    );
  };

  const folderLabel = viewingUnfiled ? 'Sem pasta' : currentFolder?.nome ?? 'Pasta';
  const uploadHint = !canUploadPdf
    ? 'Você não tem permissão para anexar arquivos'
    : !viewingRoot
      ? `Enviar para “${folderLabel}” · máx. 200MB`
      : leadId
        ? 'PDF, foto ou vídeo · arraste aqui · máx. 200MB'
        : 'PDF, foto ou vídeo · serão enviados ao salvar o lead · máx. 200MB';

  return (
    <div className="space-y-3 w-full" data-dialog-file-picker-zone>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{readOnly ? 'PDFs, fotos e vídeos do projeto' : 'Anexar PDFs, fotos e vídeos'}</Label>
        <div className="flex flex-wrap items-center gap-2">
          {viewingRoot && canUploadPdf && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!leadId) {
                  toast.error('Salve o lead antes de criar pastas');
                  return;
                }
                setCreatingFolder(true);
                setNewFolderDraft('');
              }}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Nova pasta
            </Button>
          )}
          {canUseSelectionMode && (
          <Button
            type="button"
            variant={isSelectionMode ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => {
              if (isSelectionMode) exitSelectionMode();
              else setIsSelectionMode(true);
            }}
          >
            {isSelectionMode ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Cancelar seleção
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4 mr-2" />
                {selectableImages.length >= 2 ? 'Selecionar' : 'Selecionar para mover'}
              </>
            )}
          </Button>
          )}
        </div>
      </div>

      {isSelectionMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            {selectedImageIds.size} arquivo{selectedImageIds.size !== 1 ? 's' : ''} selecionado
            {selectedImageIds.size !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {canUploadPdf && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={selectedImageIds.size < 1 || isMoving || isBulkDeleting}
                onClick={() => openMovePicker([...selectedImageIds])}
              >
                {isMoving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FolderInput className="h-4 w-4 mr-2" />
                )}
                Mover para pasta
              </Button>
            )}
            {selectableImages.length >= 2 && (
              <Button
                type="button"
                size="sm"
                disabled={
                  selectableImages.filter((pdf) => selectedImageIds.has(pdf.id)).length < 2 ||
                  isExportProcessing ||
                  isBulkDeleting
                }
                onClick={() => setExportDialogOpen(true)}
              >
                {isExportProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Exportar em PDF
              </Button>
            )}
            {canDeletePdf && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={deletableSelected.length < 1 || isBulkDeleting || isMoving}
                onClick={() => setBulkDeleteOpen(true)}
              >
                {isBulkDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Excluir{deletableSelected.length > 0 ? ` (${deletableSelected.length})` : ''}
              </Button>
            )}
          </div>
        </div>
      )}

      {!viewingRoot && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-[rgba(42,24,18,0.06)] px-3 py-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentFolderId(null)}>
            ← Pastas
          </Button>
          <span className="text-muted-foreground">/</span>
          <FolderOpen className="h-4 w-4 text-amber-700" />
          {insideRename ? (
            <Input
              value={insideRenameDraft}
              autoFocus
              placeholder={viewingUnfiled ? 'Ex.: Sala' : undefined}
              className="h-8 max-w-[10rem] text-sm"
              onChange={(e) => setInsideRenameDraft(e.target.value)}
              onBlur={() => {
                const next = insideRenameDraft.trim();
                setInsideRename(false);
                if (!next) {
                  setInsideRenameDraft(viewingUnfiled ? '' : folderLabel);
                  return;
                }
                if (viewingUnfiled) void handleBaptizeUnfiled(next);
                else if (currentFolder) void updateFolder({ id: currentFolder.id, nome: next });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setInsideRename(false);
                  setInsideRenameDraft(viewingUnfiled ? '' : folderLabel);
                }
              }}
            />
          ) : (
            <span className="font-medium text-[#1a100c]">{folderLabel}</span>
          )}
          {canUploadPdf && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={viewingUnfiled ? 'Dar um nome à pasta' : 'Renomear'}
              onClick={() => {
                setInsideRenameDraft(viewingUnfiled ? '' : folderLabel);
                setInsideRename(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canUploadPdf && currentFolder && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              title="Excluir pasta"
              onClick={() => setFolderToDelete({ id: currentFolder.id, nome: currentFolder.nome })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {galleryImages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7"
              title="Tela cheia"
              onClick={() => openFolderSlideshow(viewingUnfiled ? null : currentFolderId)}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {creatingFolder && viewingRoot && (
        <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3">
          <Label htmlFor="nova-pasta-atalho" className="sr-only">
            Nome da nova pasta
          </Label>
          <Input
            id="nova-pasta-atalho"
            value={newFolderDraft}
            placeholder="Ex.: Sala"
            autoFocus
            onChange={(e) => setNewFolderDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCreateNamedFolder();
              }
              if (e.key === 'Escape') {
                setCreatingFolder(false);
                setNewFolderDraft('');
              }
            }}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingFolder(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={() => void handleCreateNamedFolder()}>
              Criar
            </Button>
          </div>
        </div>
      )}

      {canUploadPdf && (
      <div
        className={`border-2 border-dashed rounded-md p-4 text-center transition-colors ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/50'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (canUploadPdf) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={canUploadPdf ? handleDrop : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*,video/mp4,video/webm,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {viewingRoot && (
          <div className="mx-auto mb-3 max-w-xs text-left">
            <Label htmlFor="lead-upload-folder-name" className="text-xs text-[#4a3428]">
              Nome da pasta
            </Label>
            <Input
              id="lead-upload-folder-name"
              value={uploadFolderName}
              placeholder="Ex.: Sala, Cozinha, Fachada"
              className="mt-1"
              onChange={(e) => setUploadFolderName(e.target.value)}
            />
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || !canUploadPdf}
          onClick={openFilePicker}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Selecionar arquivos
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-1">{uploadHint}</p>
      </div>
      )}

      {!leadId && pendingPdfs.length > 0 && (
        <p className="text-xs text-primary font-medium">
          {pendingPdfs.length} arquivo{pendingPdfs.length !== 1 ? 's' : ''} aguardando — salve o lead para concluir o envio
        </p>
      )}

      {(isLoading || foldersLoading) && folders.length === 0 && pdfsVisiveis.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Skeleton className="aspect-[3/4] rounded" />
          <Skeleton className="aspect-[3/4] rounded" />
        </div>
      ) : readOnly && pdfsVisiveis.length === 0 && folders.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhum PDF, foto ou vídeo liberado para visualização neste lead.
        </p>
      ) : viewingRoot ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {folders.map((folder, index) => (
            <LeadAttachmentFolderCard
              key={folder.id}
              nome={folder.nome}
              fileCount={countFolderFiles(coverSource, folder.id)}
              covers={getFolderCoverUrls(coverSource, folder.id)}
              index={index}
              canManage={canUploadPdf}
              onOpen={() => setCurrentFolderId(folder.id)}
              onRename={(nome) => void updateFolder({ id: folder.id, nome })}
              onDelete={() => setFolderToDelete({ id: folder.id, nome: folder.nome })}
              onPlay={() => openFolderSlideshow(folder.id)}
            />
          ))}
          {unfiledCount > 0 && (
            <LeadAttachmentFolderCard
              variant="unfiled"
              nome="Sem pasta"
              fileCount={unfiledCount}
              covers={getFolderCoverUrls(coverSource, null)}
              index={folders.length}
              canManage={canUploadPdf}
              onOpen={() => setCurrentFolderId(LEAD_UNFILED_FOLDER_ID)}
              onRename={(nome) => void handleBaptizeUnfiled(nome)}
              onPlay={() => openFolderSlideshow(null)}
            />
          )}
        </div>
      ) : filesInView.length > 0 || pendingInView.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {pendingInView.map((pending) => (
            <div
              key={pending.tempId}
              className="relative group border border-dashed border-primary/40 rounded-md overflow-hidden bg-primary/5 cursor-pointer"
              onClick={() => void openPendingFullscreen(pending)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void openPendingFullscreen(pending);
                }
              }}
              role="button"
              tabIndex={0}
              title="Prévia — será enviado ao salvar"
            >
              <AttachmentThumbnail
                cacheKey={pdfCacheKeyForPending(pending.tempId)}
                fileUrl={pending.previewUrl}
                fileName={pending.file.name}
                file={pending.file}
                tipo={pending.tipo}
              />
              <div className="px-2 py-1.5 border-t bg-background flex items-center justify-between gap-1">
                <p className="text-xs truncate text-muted-foreground flex-1" title={pending.file.name}>
                  {pending.file.name}
                </p>
                <span className="text-[10px] text-primary shrink-0">Pendente</span>
              </div>
              {canUploadPdf && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePendingPDF(pending.tempId);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          {filesInView.map((pdf: LeadPDF) => {
            const viewKind = getLeadAttachmentViewKind(pdf);
            const thumbTipo =
              viewKind === 'video' ? 'video' : viewKind === 'pdf' ? 'pdf' : 'imagem';
            const isVirtualAiRender = isAiRenderAttachmentId(pdf.id);
            const isFormUpload = isFormUploadAttachmentId(pdf.id);
            const isMovable = !isFormUpload;
            const isSelectable = isMovable;
            const isSelected = selectedImageIds.has(pdf.id);

            const handleCardActivate = () => {
              if (isSelectionMode && isSelectable) {
                toggleImageSelection(pdf.id);
                return;
              }
              void openFullscreen(
                viewKind,
                pdfCacheKeyForMedia(pdf.id),
                pdf.file_url,
                pdf.file_name,
                undefined,
                pdf.id,
                pdf.titulo || pdf.file_name,
                viewKind === 'image' ? pdf.id : undefined,
              );
            };

            return (
            <div
              key={pdf.id}
              className={cn(
                'relative group border rounded-md overflow-hidden bg-muted/20 cursor-pointer',
                isSelectionMode && isSelectable && isSelected && 'ring-2 ring-primary border-primary',
                isSelectionMode && !isSelectable && 'opacity-60',
              )}
              onClick={handleCardActivate}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardActivate();
                }
              }}
              role="button"
              tabIndex={0}
              title={
                isSelectionMode && isSelectable
                  ? isSelected
                    ? 'Clique para desmarcar'
                    : 'Clique para selecionar'
                  : 'Clique para ver em tela cheia'
              }
            >
              {isSelectionMode && isSelectable && (
                <div
                  className="absolute left-2 top-2 z-20"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleImageSelection(pdf.id)}
                    aria-label={`Selecionar ${pdf.titulo || pdf.file_name}`}
                    className="h-5 w-5 border-white/80 bg-black/50 data-[state=checked]:bg-primary"
                  />
                </div>
              )}
              {preparingId === pdf.id && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                </div>
              )}
              <AttachmentThumbnail
                cacheKey={pdfCacheKeyForMedia(pdf.id)}
                fileUrl={pdf.file_url}
                fileName={pdf.file_name}
                tipo={thumbTipo}
              />
              <div className="px-2 py-1.5 border-t bg-background flex items-center justify-between gap-1">
                <p className="text-xs truncate text-muted-foreground flex-1" title={pdf.titulo || pdf.file_name}>
                  {pdf.titulo || pdf.file_name}
                </p>
                <div className="flex items-center gap-0.5 shrink-0">
                  {isVirtualAiRender && (
                    <span className="text-[10px] text-primary shrink-0">Render IA</span>
                  )}
                  {isFormUpload && (
                    <span className="text-[10px] text-sky-700 shrink-0">Formulário</span>
                  )}
                  {canDownloadPdf && viewKind === 'image' && (
                    <LeadAttachmentDownloadMenu
                      imageUrl={pdf.file_url}
                      fileName={pdf.file_name}
                      imageLabel={pdf.titulo || pdf.file_name}
                      leadName={leadName}
                      leadId={leadId}
                      iconOnly
                      menuModal
                    />
                  )}
                  {canDownloadPdf && viewKind !== 'image' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Baixar arquivo"
                      disabled={downloadingId === pdf.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDownloadPdf(pdf);
                      }}
                    >
                      {downloadingId === pdf.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  <Maximize2 className="h-3 w-3 text-muted-foreground opacity-60" />
                </div>
              </div>
              {canUploadPdf && !isSelectionMode && isMovable && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-1.5 left-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                  title="Mover para outra pasta"
                  disabled={isMoving}
                  onClick={(e) => {
                    e.stopPropagation();
                    openMovePicker([pdf.id]);
                  }}
                >
                  <FolderInput className="h-3.5 w-3.5" />
                </Button>
              )}
              {canUploadPdf && !isSelectionMode && viewKind === 'image' && typeof leadId === 'number' && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className={cn(
                    'absolute h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10',
                    isMovable ? 'top-1.5 left-10' : 'top-1.5 left-1.5',
                  )}
                  title="Editar na lousa"
                  onClick={(e) => {
                    e.stopPropagation();
                    requestLeadWhiteboardImport({
                      leadId,
                      fileUrl: pdf.file_url,
                      fileName: pdf.file_name,
                      folderId: viewingUnfiled ? null : currentFolderId,
                      folderName: viewingUnfiled ? null : currentFolder?.nome,
                    });
                    document.getElementById('lead-whiteboard')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                    });
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {canDeletePdf && !isSelectionMode && !isFormUpload && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ id: pdf.id, fileUrl: pdf.file_url, fileName: pdf.file_name });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
          })}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Esta gaveta está vazia. Envie fotos para “{folderLabel}”.
        </p>
      )}
      {fullscreenView?.kind === 'pdf' && (
        <PDFFullscreenViewer
          cacheKey={fullscreenView.cacheKey}
          fileUrl={fullscreenView.fileUrl}
          fileName={fullscreenView.fileName}
          file={fullscreenView.file}
          open
          onClose={() => setFullscreenView(null)}
          canDownload={canDownloadPdf}
        />
      )}
      {fullscreenView?.kind === 'image' && (
        <ImageFullscreenViewer
          images={
            (forcedGallery && forcedGallery.length > 0 ? forcedGallery : galleryImages).length > 0
              ? (forcedGallery && forcedGallery.length > 0 ? forcedGallery : galleryImages)
              : [
                  {
                    key: fullscreenView.imageKey || fullscreenView.fileUrl,
                    fileUrl: fullscreenView.fileUrl,
                    fileName: fullscreenView.fileName,
                    imageLabel: fullscreenView.imageLabel,
                  },
                ]
          }
          initialIndex={Math.max(
            0,
            (forcedGallery && forcedGallery.length > 0 ? forcedGallery : galleryImages).findIndex(
              (img) => img.key === fullscreenView.imageKey,
            ),
          )}
          leadName={leadName}
          leadId={leadId}
          open
          onClose={() => {
            setForcedGallery(null);
            setFullscreenView(null);
          }}
          canDownload={canDownloadPdf}
        />
      )}
      {fullscreenView?.kind === 'video' && (
        <VideoFullscreenViewer
          fileUrl={fullscreenView.fileUrl}
          fileName={fullscreenView.fileName}
          open
          onClose={() => setFullscreenView(null)}
          canDownload={canDownloadPdf}
        />
      )}

      <LeadFotosExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        selectedCount={selectedImageIds.size}
        canAttach={canUploadPdf}
        isProcessing={isExportProcessing}
        onConfirm={(action) => void handleExportConfirm(action)}
      />

      <LeadFolderPickDialog
        open={pickOpen}
        onOpenChange={(open) => {
          setPickOpen(open);
          if (!open) {
            setQueuedFiles(null);
            onFilePickerActiveChange?.(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
        leadId={leadId}
        title="Onde guardar?"
        description="Toda foto entra numa gaveta do lead."
        allowUnfiled={false}
        askFolderName
        folderNameLabel="Nome da pasta"
        coverItems={coverSource}
        onConfirm={async (folderId, options) => {
          const files = queuedFiles ?? [];
          setPickOpen(false);
          setQueuedFiles(null);
          if (files.length === 0) return;
          await sendFilesToFolder(files, {
            folderId,
            folderName: options?.folderName,
          });
          if (folderId) setCurrentFolderId(folderId);
        }}
      />

      <LeadFolderPickDialog
        open={movePickOpen}
        onOpenChange={(open) => {
          setMovePickOpen(open);
          if (!open) setIdsToMove(null);
        }}
        leadId={leadId}
        title="Mover para qual pasta?"
        description={
          (idsToMove?.length ?? 0) <= 1
            ? 'Escolha a pasta de destino deste arquivo.'
            : `Escolha a pasta de destino dos ${idsToMove?.length ?? 0} arquivos.`
        }
        confirmLabel={isMoving ? 'Movendo…' : 'Mover para esta pasta'}
        allowUnfiled
        askFolderName
        folderNameLabel="Ou crie uma pasta nova"
        coverItems={coverSource}
        defaultFolderId={viewingUnfiled ? null : currentFolderId}
        onConfirm={(folderId) => void handleMoveConfirm(folderId)}
      />

      <AlertDialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta “{folderToDelete?.nome}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Os arquivos não são apagados — voltam para Sem pasta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!folderToDelete) return;
                void deleteFolder(folderToDelete.id).then(() => {
                  if (currentFolderId === folderToDelete.id) setCurrentFolderId(null);
                  setFolderToDelete(null);
                });
              }}
            >
              Excluir pasta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget &&
              resolveAiRenderIdFromAttachment({
                id: deleteTarget.id,
                fileUrl: deleteTarget.fileUrl,
                fileName: deleteTarget.fileName,
              })
                ? 'A renderização será removida permanentemente do histórico, dos anexos e do armazenamento. Essa ação não pode ser desfeita.'
                : 'O arquivo será removido permanentemente e não poderá ser recuperado.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!isBulkDeleting) setBulkDeleteOpen(open);
        }}
      >
        <AlertDialogContent nested>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover {deletableSelected.length} arquivo
              {deletableSelected.length !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os arquivos selecionados serão removidos permanentemente e não poderão ser
              recuperados. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isBulkDeleting || deletableSelected.length < 1}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmBulkDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? 'Removendo…' : 'Remover selecionados'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

LeadPDFAttachments.displayName = 'LeadPDFAttachments';
