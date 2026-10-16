import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Eye, Loader2, Sparkles, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { PageGridSelector } from '@/components/orcamentos-ia/PageGridSelector'
import { countPdfPages } from '@/lib/pdf-to-image'
import {
  prepareLeadQuoteHandoff,
  type LeadAttachmentForQuote,
} from '@/lib/orcamentos-ia/lead-bridge'
import type { QuoteProjectRow } from '@/lib/orcamentos-ia/storage'
import { toast } from 'sonner'

export interface LeadOrcamentosIaPagePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  leadId: number
  leadName?: string | null
  userId?: string | null
  attachments: LeadAttachmentForQuote[]
  /** Dispara a cotação com as páginas escolhidas. */
  onConfirm: (input: {
    project: QuoteProjectRow
    files: File[]
    pageNumbers: number[]
    projectCreated: boolean
  }) => Promise<void>
}

function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
}

/**
 * Prévia + seleção de páginas antes de precificar anexos do lead.
 * PDF: mesma grade do hub (PageGridSelector, com tela cheia).
 * Só imagens: grade de fotos com prévia ampliada.
 */
export function LeadOrcamentosIaPagePickerDialog({
  open,
  onOpenChange,
  companyId,
  leadId,
  leadName,
  userId,
  attachments,
  onConfirm,
}: LeadOrcamentosIaPagePickerDialogProps) {
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [project, setProject] = useState<QuoteProjectRow | null>(null)
  const [projectCreated, setProjectCreated] = useState(false)
  const [pageCount, setPageCount] = useState(0)
  const [selectedImages, setSelectedImages] = useState<Set<number>>(() => new Set())
  const [imagePreviewIdx, setImagePreviewIdx] = useState<number | null>(null)

  const primaryPdf = useMemo(
    () => files.find(isPdfFile) ?? null,
    [files],
  )
  const imageFiles = useMemo(
    () => files.filter((f) => !isPdfFile(f)),
    [files],
  )
  const mode: 'pdf' | 'images' | 'empty' = primaryPdf
    ? 'pdf'
    : imageFiles.length
      ? 'images'
      : 'empty'

  const reset = useCallback(() => {
    setLoading(false)
    setStarting(false)
    setError(null)
    setFiles([])
    setProject(null)
    setProjectCreated(false)
    setPageCount(0)
    setSelectedImages(new Set())
    setImagePreviewIdx(null)
  }, [])

  const attachmentsKey = useMemo(
    () => attachments.map((a) => a.id).join('|'),
    [attachments],
  )

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    if (!attachments.length || !companyId || !leadId) return

    let cancelled = false
    setLoading(true)
    setError(null)
    const snapshot = [...attachments]

    void (async () => {
      const handoff = await prepareLeadQuoteHandoff({
        companyId,
        leadId,
        leadName,
        userId,
        attachments: snapshot,
      })
      if (cancelled) return
      if (handoff.error || !handoff.project || !handoff.files.length) {
        setError(handoff.error || 'Não foi possível preparar os arquivos.')
        setLoading(false)
        return
      }
      for (const w of handoff.warnings) {
        toast.message('Anexo ignorado', { description: w })
      }

      const pdf = handoff.files.find(isPdfFile)
      let pages = 0
      if (pdf) {
        try {
          pages = await countPdfPages(pdf)
        } catch {
          pages = 0
        }
        if (!pages || pages < 1) {
          setError('Não foi possível ler as páginas deste PDF.')
          setLoading(false)
          return
        }
      } else {
        pages = handoff.files.length
      }

      setFiles(handoff.files)
      setProject(handoff.project)
      setProjectCreated(handoff.projectCreated)
      setPageCount(pages)
      if (!pdf) {
        setSelectedImages(new Set(handoff.files.map((_, i) => i + 1)))
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
    // attachmentsKey evita loop: o pai remonta o array a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot via attachmentsKey
  }, [open, attachmentsKey, companyId, leadId, leadName, userId, reset])

  const handleConfirmPages = async (pages: number[]) => {
    if (!project || !files.length || !pages.length) {
      toast.error('Escolha ao menos uma página para cotar.')
      return
    }
    setStarting(true)
    try {
      await onConfirm({
        project,
        files,
        pageNumbers: pages,
        projectCreated,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Não foi possível iniciar a cotação.',
      )
    } finally {
      setStarting(false)
    }
  }

  const toggleImage = (n: number) => {
    setSelectedImages((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  const imageObjectUrls = useMemo(() => {
    return imageFiles.map((f) => URL.createObjectURL(f))
  }, [imageFiles])

  useEffect(() => {
    return () => {
      for (const u of imageObjectUrls) URL.revokeObjectURL(u)
    }
  }, [imageObjectUrls])

  const previewFileName =
    imagePreviewIdx != null
      ? imageFiles[imagePreviewIdx - 1]?.name ?? null
      : null
  const previewUrl =
    imagePreviewIdx != null ? imageObjectUrls[imagePreviewIdx - 1] ?? null : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (starting) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        nested
        className="flex max-h-[92vh] w-[min(96vw,1100px)] !max-w-5xl flex-col gap-3 overflow-hidden p-4 sm:p-6"
      >
        <DialogHeader className="shrink-0 space-y-1 text-left">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-5 w-5 text-[#0066FF]" />
            Escolher páginas para precificar
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Prévia do arquivo do lead
            {leadName ? (
              <>
                {' '}
                <span className="font-medium text-foreground">{leadName}</span>
              </>
            ) : null}
            . Marque o que vai para a IA — não enviamos o PDF inteiro sem seleção.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-[#0066FF]" />
            Baixando anexos e montando a prévia…
          </div>
        ) : error ? (
          <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p>{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : mode === 'pdf' && primaryPdf ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <PageGridSelector
              key={`${primaryPdf.name}-${pageCount}-${project?.id || 'new'}`}
              projectId={project?.id}
              companyId={companyId}
              pdfUrl={project?.pdf_url}
              localFile={primaryPdf}
              pageCount={pageCount}
              budgetedPages={project?.budgeted_pages || []}
              disabled={starting}
              title="Cotar seleção de páginas"
              subtitle="Clique nas miniaturas para marcar · ícone de olho/expandir para ver grande."
              onCancel={() => onOpenChange(false)}
              onConfirm={(pages) => void handleConfirmPages(pages)}
            />
            {starting ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-[#0066FF]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Iniciando cotação com as páginas escolhidas…
              </p>
            ) : null}
          </div>
        ) : mode === 'images' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {selectedImages.size} de {imageFiles.length} imagem(ns) selecionada(s)
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={starting}
                  onClick={() =>
                    setSelectedImages(new Set(imageFiles.map((_, i) => i + 1)))
                  }
                >
                  Marcar todas
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={starting}
                  onClick={() => setSelectedImages(new Set())}
                >
                  Limpar
                </Button>
              </div>
            </div>
            <ScrollArea className="max-h-[min(52vh,520px)] rounded-xl border border-slate-200">
              <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 md:grid-cols-4">
                {imageFiles.map((file, idx) => {
                  const n = idx + 1
                  const selected = selectedImages.has(n)
                  const url = imageObjectUrls[idx]
                  return (
                    <div
                      key={`${file.name}-${n}`}
                      className={cn(
                        'group relative overflow-hidden rounded-lg border bg-muted/20',
                        selected
                          ? 'border-[#0066FF] ring-2 ring-[#0066FF]/35'
                          : 'border-slate-200',
                      )}
                    >
                      <button
                        type="button"
                        className="block w-full text-left"
                        disabled={starting}
                        onClick={() => toggleImage(n)}
                      >
                        {url ? (
                          <img
                            src={url}
                            alt=""
                            className="aspect-[3/4] w-full object-cover"
                          />
                        ) : null}
                        <span className="absolute left-1.5 top-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-black/60 px-1.5 text-[11px] font-semibold text-white">
                          {selected ? <Check className="h-3.5 w-3.5" /> : n}
                        </span>
                      </button>
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute bottom-1.5 right-1.5 h-7 w-7 opacity-90 shadow-md"
                        title="Ver grande"
                        disabled={starting}
                        onClick={(e) => {
                          e.stopPropagation()
                          setImagePreviewIdx(n)
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={starting}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="gap-1.5 bg-[#0066FF] hover:bg-[#0052cc]"
                disabled={starting || selectedImages.size < 1}
                onClick={() =>
                  void handleConfirmPages(
                    [...selectedImages].sort((a, b) => a - b),
                  )
                }
              >
                {starting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Cotar {selectedImages.size || ''} página
                {selectedImages.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum PDF ou imagem válido.
          </p>
        )}

        {/* Prévia grande de imagem */}
        <Dialog
          open={imagePreviewIdx != null && Boolean(previewUrl)}
          onOpenChange={(o) => !o && setImagePreviewIdx(null)}
        >
          <DialogContent
            nested
            className="flex max-h-[94vh] w-[min(96vw,960px)] !max-w-4xl flex-col gap-2 overflow-hidden p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-sm">
                Imagem {imagePreviewIdx}
                {previewFileName ? ` · ${previewFileName}` : ''}
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setImagePreviewIdx(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="mx-auto max-h-[min(78vh,820px)] w-auto max-w-full rounded-lg object-contain"
              />
            ) : null}
            {imagePreviewIdx != null ? (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => toggleImage(imagePreviewIdx)}
                >
                  {selectedImages.has(imagePreviewIdx)
                    ? 'Desmarcar'
                    : 'Marcar para cotar'}
                </Button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
