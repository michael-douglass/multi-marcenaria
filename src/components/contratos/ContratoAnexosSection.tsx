import { useCallback, useRef, useState, type DragEvent } from 'react';
import {
  FileText,
  Upload,
  Loader2,
  Maximize2,
  Trash2,
  Download,
  Image,
  File,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  useContratoAnexos,
  type ContratoAnexo,
  type PendingContratoAnexo,
} from '@/hooks/useContratoAnexos';
import { isImageAttachment } from '@/lib/attachment-files';
import { downloadFileFromUrl } from '@/lib/download-file';

const ACCEPT_FILES =
  'application/pdf,image/*,.doc,.docx,.xls,.xlsx,.txt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface ContratoAnexosSectionProps {
  contratoId: string | null | undefined;
  readOnly?: boolean;
  className?: string;
}

function AnexoCard({
  titulo,
  fileName,
  tipo,
  onView,
  onDownload,
  onDelete,
  readOnly,
  isPending,
}: {
  titulo: string;
  fileName: string;
  tipo: 'pdf' | 'imagem' | 'documento';
  onView?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
  isPending?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-amber-500/20 bg-card overflow-hidden flex flex-col',
        isPending && 'border-dashed opacity-90',
      )}
    >
      <button
        type="button"
        className="relative flex-1 min-h-[120px] p-2 flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={onView}
        disabled={!onView}
      >
        {tipo === 'imagem' ? (
          <Image className="h-10 w-10 text-amber-400/80" />
        ) : tipo === 'pdf' ? (
          <FileText className="h-10 w-10 text-amber-400/80" />
        ) : (
          <File className="h-10 w-10 text-amber-400/80" />
        )}
        {onView && (
          <span className="absolute bottom-2 text-[10px] text-muted-foreground flex items-center gap-1">
            <Maximize2 className="h-3 w-3" />
            Ver
          </span>
        )}
      </button>
      <div className="px-2 py-2 border-t border-border/50 space-y-1">
        <p className="text-xs font-medium truncate" title={titulo}>
          {titulo}
        </p>
        <p className="text-[10px] text-muted-foreground truncate" title={fileName}>
          {fileName}
        </p>
        <div className="flex gap-1">
          {onDownload && (
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDownload}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
          {!readOnly && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ContratoAnexosSection({
  contratoId,
  readOnly = false,
  className,
}: ContratoAnexosSectionProps) {
  const {
    anexos,
    pendingAnexos,
    isLoading,
    uploadAnexo,
    deleteAnexo,
    removePending,
    hasPendingAnexos,
  } = useContratoAnexos(contratoId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fileUrl: string } | null>(null);
  const [fullscreen, setFullscreen] = useState<{
    kind: 'image';
    cacheKey: string;
    fileUrl: string;
    fileName: string;
  } | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || readOnly) return;
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          await uploadAnexo(file);
        }
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [readOnly, uploadAnexo],
  );

  const openFullscreen = useCallback(
    (anexo: ContratoAnexo | PendingContratoAnexo, isPending: boolean) => {
      const meta = isPending
        ? {
            tipo: (anexo as PendingContratoAnexo).tipo,
            mime_type: null as string | null,
            file: (anexo as PendingContratoAnexo).file,
          }
        : {
            tipo: (anexo as ContratoAnexo).tipo,
            mime_type: (anexo as ContratoAnexo).mime_type,
          };

      const isImg = isImageAttachment(meta) || meta.tipo === 'pdf';
      const fileUrl = isPending
        ? (anexo as PendingContratoAnexo).previewUrl
        : (anexo as ContratoAnexo).file_url;
      const fileName = isPending
        ? (anexo as PendingContratoAnexo).file.name
        : (anexo as ContratoAnexo).file_name;

      if (!isImg) {
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      setFullscreen({
        kind: 'image',
        cacheKey: isPending ? (anexo as PendingContratoAnexo).tempId : (anexo as ContratoAnexo).id,
        fileUrl,
        fileName,
      });
    },
    [],
  );

  const totalCount = anexos.length + pendingAnexos.length;

  return (
    <div className={cn('space-y-3', className)}>
      <Label className="text-sm font-semibold flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-amber-400" />
        Documentos e fotos do contrato
        {totalCount > 0 && (
          <span className="text-xs font-normal text-muted-foreground">({totalCount})</span>
        )}
      </Label>

      {!contratoId && hasPendingAnexos && (
        <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
          Os arquivos serão vinculados automaticamente quando o rascunho for salvo na nuvem.
        </p>
      )}

      {!readOnly && (
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-4 text-center transition-colors',
            isDragOver
              ? 'border-amber-500/60 bg-amber-500/5'
              : 'border-muted-foreground/30 hover:border-muted-foreground/50',
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e: DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            void handleFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_FILES}
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="border-amber-500/40"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Anexar documentos ou fotos
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            PDFs viram fotos (uma por página). Também aceita imagens, Word, Excel ou TXT — até 50MB
          </p>
        </div>
      )}

      {isLoading && contratoId ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          Nenhum anexo neste contrato.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {anexos.map((anexo) => (
            <div key={anexo.id} className="relative">
              {isImageAttachment(anexo) ? (
                <div className="rounded-lg border border-amber-500/20 overflow-hidden bg-card">
                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => void openFullscreen(anexo, false)}
                  >
                    <img
                      src={anexo.file_url}
                      alt={anexo.file_name}
                      className="w-full h-32 object-cover"
                      loading="lazy"
                    />
                  </button>
                  <div className="px-2 py-2 border-t flex justify-between items-center gap-1">
                    <p className="text-xs truncate flex-1" title={anexo.file_name}>
                      {anexo.titulo}
                    </p>
                    <div className="flex shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          void downloadFileFromUrl(anexo.file_url, anexo.file_name)
                        }
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() =>
                            setDeleteTarget({ id: anexo.id, fileUrl: anexo.file_url })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <AnexoCard
                  titulo={anexo.titulo}
                  fileName={anexo.file_name}
                  tipo={anexo.tipo}
                  onView={() => void openFullscreen(anexo, false)}
                  onDownload={() => void downloadFileFromUrl(anexo.file_url, anexo.file_name)}
                  onDelete={() => setDeleteTarget({ id: anexo.id, fileUrl: anexo.file_url })}
                  readOnly={readOnly}
                />
              )}
            </div>
          ))}

          {pendingAnexos.map((pending) =>
            pending.previewUrl &&
            (pending.tipo === 'imagem' || pending.tipo === 'pdf') ? (
              <div key={pending.tempId} className="rounded-lg border border-dashed border-amber-500/30 overflow-hidden bg-card">
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => openFullscreen(pending, true)}
                >
                  <img
                    src={pending.previewUrl}
                    alt={pending.file.name}
                    className="w-full h-32 object-cover"
                  />
                </button>
                <div className="px-2 py-2 border-t flex justify-between items-center gap-1">
                  <div className="min-w-0">
                    <p className="text-xs truncate">{pending.file.name.replace(/\.[^.]+$/, '')}</p>
                    {pending.pageCount && pending.pageCount > 1 && (
                      <p className="text-[10px] text-muted-foreground">
                        {pending.pageCount} páginas → fotos
                      </p>
                    )}
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => removePending(pending.tempId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <AnexoCard
                key={pending.tempId}
                titulo={pending.file.name.replace(/\.[^.]+$/, '')}
                fileName={
                  pending.pageCount && pending.pageCount > 1
                    ? `${pending.file.name} (${pending.pageCount} fotos)`
                    : pending.file.name
                }
                tipo={pending.tipo === 'pdf' ? 'imagem' : pending.tipo}
                isPending
                onView={
                  pending.previewUrl ? () => openFullscreen(pending, true) : undefined
                }
                onDelete={() => removePending(pending.tempId)}
                readOnly={readOnly}
              />
            ),
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo será excluído permanentemente deste contrato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) void deleteAnexo(deleteTarget.id, deleteTarget.fileUrl);
                setDeleteTarget(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!fullscreen} onOpenChange={() => setFullscreen(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{fullscreen?.fileName}</DialogTitle>
          </DialogHeader>
          {fullscreen?.kind === 'image' && (
            <img
              src={fullscreen.fileUrl}
              alt={fullscreen.fileName}
              className="w-full h-auto max-h-[70vh] object-contain mx-auto"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
