import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OrcamentoProjetoPdfPagePickerDialog } from '@/components/orcamento-slides/OrcamentoProjetoPdfPagePickerDialog';
import { formatBibliotecaFileSize, getBibliotecaFileSizeError } from '@/lib/biblioteca-utils';
import {
  isOrcamentoProjetoPdfFile,
  pdfPageImagesToFiles,
  renderOrcamentoProjetoPdfFile,
} from '@/lib/orcamento-slide-projeto-files';
import { isVideoFile, VIDEO_ACCEPT } from '@/lib/orcamento-slide-midia-video';
import type { PdfPageImage } from '@/lib/pdf-render';
import { CloudUpload, FilePlus, Film, ImageIcon, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

interface PendingFile {
  id: string;
  file: File;
  titulo: string;
}

interface BibliotecaUploadZoneProps {
  onUpload: (file: File, titulo: string) => Promise<void>;
  uploading: boolean;
}

function isAcceptedBibliotecaFile(file: File): boolean {
  return (
    file.type.startsWith('image/') ||
    file.type.startsWith('audio/') ||
    isVideoFile(file) ||
    isOrcamentoProjetoPdfFile(file)
  );
}

function createPendingFile(file: File): PendingFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    titulo: file.name.replace(/\.[^.]+$/, '') || 'Arquivo',
  };
}

export function BibliotecaUploadZone({ onUpload, uploading }: BibliotecaUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  const [pdfPickerOpen, setPdfPickerOpen] = useState(false);
  const [pdfPages, setPdfPages] = useState<PdfPageImage[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfBaseTitulo, setPdfBaseTitulo] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfSourceFile, setPdfSourceFile] = useState<File | null>(null);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const clearPending = () => {
    setPendingFiles([]);
    setUploadProgress(null);
    resetInput();
  };

  const openPdfFlow = (file: File, titulo: string) => {
    setDialogOpen(false);
    setPdfSourceFile(file);
    setPdfBaseTitulo(titulo);
    setPdfFileName(file.name);
    setPdfPages([]);
    setPdfError(null);
    setPdfLoading(true);
    setPdfPickerOpen(true);

    void (async () => {
      try {
        const pages = await renderOrcamentoProjetoPdfFile(file);
        setPdfPages(pages);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Não foi possível ler o PDF';
        setPdfError(message);
      } finally {
        setPdfLoading(false);
      }
    })();
  };

  const openWithFiles = (files: File[]) => {
    if (files.length === 0) return;

    const accepted: File[] = [];
    let rejectedType = 0;
    let rejectedSize = 0;

    for (const file of files) {
      if (!isAcceptedBibliotecaFile(file)) {
        rejectedType += 1;
        continue;
      }
      const sizeError = getBibliotecaFileSizeError(file);
      if (sizeError) {
        rejectedSize += 1;
        continue;
      }
      accepted.push(file);
    }

    if (rejectedType > 0) {
      toast.error(
        rejectedType === 1
          ? 'Um arquivo foi ignorado (use imagem, vídeo, áudio ou PDF)'
          : `${rejectedType} arquivos foram ignorados (use imagem, vídeo, áudio ou PDF)`,
      );
    }
    if (rejectedSize > 0) {
      toast.error(
        rejectedSize === 1
          ? 'Um arquivo passou do tamanho máximo (200 MB)'
          : `${rejectedSize} arquivos passaram do tamanho máximo (200 MB)`,
      );
    }
    if (accepted.length === 0) return;

    const pdfs = accepted.filter((f) => isOrcamentoProjetoPdfFile(f));
    const others = accepted.filter((f) => !isOrcamentoProjetoPdfFile(f));

    if (pdfs.length > 0 && others.length > 0) {
      toast.message('PDFs são enviados um por vez', {
        description: `Vamos enviar ${others.length} arquivo(s) agora. Envie o PDF em seguida.`,
      });
    } else if (pdfs.length > 1) {
      toast.message('Envie um PDF por vez', {
        description: 'Abrimos o primeiro PDF para você escolher as páginas.',
      });
    }

    if (others.length === 0 && pdfs.length >= 1) {
      const pdf = pdfs[0];
      setPendingFiles([createPendingFile(pdf)]);
      setDialogOpen(true);
      return;
    }

    if (others.length > 0) {
      setPendingFiles(others.map(createPendingFile));
      setDialogOpen(true);
    }
  };

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList?.length) return;
    openWithFiles(Array.from(fileList));
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const updateTitulo = (id: string, titulo: string) => {
    setPendingFiles((prev) => prev.map((item) => (item.id === id ? { ...item, titulo } : item)));
  };

  const removePending = (id: string) => {
    setPendingFiles((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) {
        setDialogOpen(false);
        resetInput();
      }
      return next;
    });
  };

  const handleConfirmUpload = async () => {
    if (pendingFiles.length === 0) return;

    const invalid = pendingFiles.some((item) => !item.titulo.trim());
    if (invalid) {
      toast.error('Preencha o título de todos os arquivos');
      return;
    }

    if (pendingFiles.length === 1 && isOrcamentoProjetoPdfFile(pendingFiles[0].file)) {
      openPdfFlow(pendingFiles[0].file, pendingFiles[0].titulo.trim());
      return;
    }

    setBusy(true);
    setUploadProgress({ current: 0, total: pendingFiles.length });
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const item = pendingFiles[i];
        setUploadProgress({ current: i + 1, total: pendingFiles.length });
        try {
          await onUpload(item.file, item.titulo.trim());
          successCount += 1;
        } catch {
          failCount += 1;
        }
      }

      setDialogOpen(false);
      clearPending();

      if (failCount === 0) {
        toast.success(
          successCount === 1
            ? 'Arquivo salvo na biblioteca'
            : `${successCount} arquivos salvos na biblioteca`,
        );
      } else if (successCount === 0) {
        toast.error('Não foi possível enviar os arquivos');
      } else {
        toast.message(`${successCount} enviados`, {
          description: `${failCount} arquivo(s) falharam.`,
        });
      }
    } finally {
      setBusy(false);
      setUploadProgress(null);
    }
  };

  const handleConfirmPdfPages = async (pageNumbers: number[]) => {
    if (!pdfSourceFile || pageNumbers.length === 0) return;
    setBusy(true);
    try {
      const arquivos = pdfPageImagesToFiles(pdfPages, pdfSourceFile.name, pageNumbers);
      for (let i = 0; i < arquivos.length; i++) {
        const pageNumber = pageNumbers[i];
        const pageTitulo = `${pdfBaseTitulo} — página ${pageNumber}`;
        await onUpload(arquivos[i], pageTitulo);
      }
      setPdfPickerOpen(false);
      setPdfSourceFile(null);
      setPendingFiles([]);
      setPdfPages([]);
      resetInput();
      toast.success(
        pageNumbers.length === 1
          ? 'Página do PDF salva como imagem'
          : `${pageNumbers.length} páginas salvas como imagens`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar páginas do PDF';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const isWorking = uploading || busy;
  const isSingle = pendingFiles.length === 1;
  const singleFile = isSingle ? pendingFiles[0]?.file ?? null : null;
  const selectedIsVideo = singleFile ? isVideoFile(singleFile) : false;
  const selectedIsPdf = singleFile ? isOrcamentoProjetoPdfFile(singleFile) : false;
  const previewUrl = useObjectUrl(
    singleFile && (selectedIsVideo || singleFile.type.startsWith('image/')) ? singleFile : null,
  );

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'biblioteca-upload-sheet group relative cursor-pointer overflow-hidden rounded-sm border-2 border-dashed p-6 sm:p-8 transition-all duration-300',
          dragOver
            ? 'border-[#6b3f12] bg-[#f4e4c4] scale-[1.01]'
            : 'hover:border-[#6b3f12]/70 hover:bg-[#f8efe3]',
        )}
      >
        <div className="relative flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-sm bg-[#fffaf4] ring-1 ring-[rgba(107,63,18,0.28)] transition group-hover:scale-105">
              {isWorking ? (
                <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-[#6b3f12]" />
              ) : (
                <CloudUpload className="h-6 w-6 sm:h-7 sm:w-7 text-[#6b3f12]" />
              )}
            </div>
          </div>
          <div>
            <p className="font-display text-lg sm:text-xl tracking-wide text-[#1a100c]">
              Arraste imagens, vídeos, áudios ou PDF
            </p>
            <p className="mt-1 text-xs sm:text-sm text-[#6b5244] max-w-md mx-auto">
              Selecione vários de uma vez · JPG, PNG, WebP · MP4, WebM · MP3, WAV · PDF · até 200 MB
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#6b3f12]/70">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fffaf4] px-2.5 py-1 ring-1 ring-[rgba(26,16,12,0.12)]">
              <ImageIcon className="h-3 w-3" />
              Foto
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fffaf4] px-2.5 py-1 ring-1 ring-[rgba(26,16,12,0.12)]">
              <Film className="h-3 w-3" />
              Vídeo
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fffaf4] px-2.5 py-1 ring-1 ring-[rgba(26,16,12,0.12)]">
              <FilePlus className="h-3 w-3" />
              Áudio
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            className="mt-1 bg-[#6b3f12] text-[#fffaf4] hover:bg-[#5a340e]"
            disabled={isWorking}
          >
            <FilePlus className="mr-2 h-4 w-4" />
            Enviar arquivos
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={`image/*,${VIDEO_ACCEPT},audio/*,.mp3,.wav,.ogg,.m4a,application/pdf,.pdf`}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDialogOpen(false);
            clearPending();
          }
        }}
      >
        <DialogContent className="border-white/10 bg-[#1a1410] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wide">
              {pendingFiles.length > 1
                ? `Salvar ${pendingFiles.length} arquivos`
                : selectedIsVideo
                  ? 'Salvar vídeo'
                  : selectedIsPdf
                    ? 'Salvar PDF'
                    : 'Salvar na biblioteca'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {isSingle && singleFile && (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                {selectedIsVideo && previewUrl ? (
                  <video
                    src={previewUrl}
                    className="max-h-48 w-full object-contain bg-black"
                    controls
                    muted
                    playsInline
                  />
                ) : singleFile.type.startsWith('image/') && previewUrl ? (
                  <img src={previewUrl} alt="" className="max-h-48 w-full object-contain" />
                ) : null}
                <p className="border-t border-white/8 px-3 py-2 text-xs text-muted-foreground">
                  {singleFile.name} ({formatBibliotecaFileSize(singleFile.size)})
                  {selectedIsPdf && (
                    <span className="mt-1 block text-amber-200/80">
                      Depois você escolhe quais páginas viram imagens.
                    </span>
                  )}
                  {selectedIsVideo && (
                    <span className="mt-1 block text-amber-200/80">
                      No site o vídeo toca; no PDF impresso ele não aparece.
                    </span>
                  )}
                </p>
              </div>
            )}

            {isSingle ? (
              <div className="space-y-2">
                <Label htmlFor="bib-titulo">Título</Label>
                <Input
                  id="bib-titulo"
                  value={pendingFiles[0]?.titulo ?? ''}
                  onChange={(e) => {
                    if (pendingFiles[0]) updateTitulo(pendingFiles[0].id, e.target.value);
                  }}
                  placeholder="Nome do arquivo"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-white/50">
                  Confira os títulos antes de enviar. Você pode remover algum item da lista.
                </p>
                <ul className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
                  {pendingFiles.map((item, index) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs text-white/70">
                            {index + 1}. {item.file.name}
                          </p>
                          <p className="text-[11px] text-white/40">
                            {formatBibliotecaFileSize(item.file.size)}
                            {isVideoFile(item.file)
                              ? ' · vídeo'
                              : item.file.type.startsWith('audio/')
                                ? ' · áudio'
                                : ' · imagem'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-white/50 hover:text-white"
                          onClick={() => removePending(item.id)}
                          disabled={isWorking}
                          title="Remover da lista"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={item.titulo}
                        onChange={(e) => updateTitulo(item.id, e.target.value)}
                        placeholder="Título"
                        disabled={isWorking}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                clearPending();
              }}
              disabled={isWorking}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleConfirmUpload()}
              disabled={isWorking || pendingFiles.length === 0}
            >
              {isWorking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadProgress
                    ? `Enviando ${uploadProgress.current}/${uploadProgress.total}...`
                    : 'Enviando...'}
                </>
              ) : selectedIsPdf ? (
                'Continuar'
              ) : pendingFiles.length > 1 ? (
                `Salvar ${pendingFiles.length}`
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrcamentoProjetoPdfPagePickerDialog
        open={pdfPickerOpen}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPdfPickerOpen(false);
            setPdfSourceFile(null);
            setPendingFiles([]);
            setPdfPages([]);
            resetInput();
          }
        }}
        pages={pdfPages}
        fileName={pdfFileName}
        isLoading={pdfLoading}
        error={pdfError}
        isSubmitting={busy}
        onConfirm={(pageNumbers) => void handleConfirmPdfPages(pageNumbers)}
      />
    </>
  );
}
