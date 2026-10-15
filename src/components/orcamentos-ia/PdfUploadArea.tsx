import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import {
  FolderKanban,
  FileUp,
  Loader2,
  Sparkles,
  Zap,
  PencilLine,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { AiThoughtConsole } from '@/components/orcamentos-ia/AiThoughtConsole'
import { PageGridSelector } from '@/components/orcamentos-ia/PageGridSelector'
import { useOrcamentosIaBackground } from '@/contexts/OrcamentosIaBackgroundContext'
import { countPdfPages } from '@/lib/pdf-to-image'
import {
  createQuoteProject,
  DEFAULT_EXTRACTION_MODEL,
  EXTRACTION_MODEL_KEYS,
  EXTRACTION_MODEL_LABELS,
  findQuoteProjectBySourceName,
  findQuoteProjectWithPdfBySourceName,
  isAllowedQuoteSourceFile,
  updateQuoteProjectPdf,
  uploadQuoteProjectPdf,
  type ExtractionModelKey,
  type QuoteAnalysisMode,
} from '@/lib/orcamentos-ia/storage'
import { cacheMissingProjectPageThumbs } from '@/lib/orcamentos-ia/project-page-thumbs'

interface PdfUploadAreaProps {
  companyId: string
  userId?: string | null
  onAnalysisCreated?: (analysisId: string) => void
  onAnalysisCompleted?: (analysisId: string) => void
  existingProjectId?: string | null
  onFolderReady?: (projectId: string) => void
}

type WizardStep = 'drop' | 'pick'

function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return file.type === 'application/pdf' || name.endsWith('.pdf')
}

function suggestFolderName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').slice(0, 120) || 'Projeto'
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

export function PdfUploadArea({
  companyId,
  userId,
  onAnalysisCreated,
  onAnalysisCompleted,
  existingProjectId = null,
  onFolderReady,
}: PdfUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadAbortRef = useRef(0)
  const uploadPromiseRef = useRef<Promise<{ projectId: string; pdfUrl: string }> | null>(null)
  /** Garante projectId mesmo se o upload de 80MB ainda estiver no meio. */
  const projectReadyRef = useRef<Promise<string> | null>(null)
  const [mode, setMode] = useState<QuoteAnalysisMode>('max')
  const [extractionModel, setExtractionModel] =
    useState<ExtractionModelKey>(DEFAULT_EXTRACTION_MODEL)
  const [dragging, setDragging] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startingLabel, setStartingLabel] = useState<string | null>(null)
  const [countingPages, setCountingPages] = useState(false)
  const [step, setStep] = useState<WizardStep>('drop')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null)
  const [folderName, setFolderName] = useState('')
  const [projectId, setProjectId] = useState<string | null>(existingProjectId)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const bg = useOrcamentosIaBackground()
  const completedNotified = useRef<Set<string>>(new Set())

  const activeJob = bg.getActiveJobForCompany(companyId)
  const busy =
    starting || countingPages || uploading || bg.isRunningForCompany(companyId)

  useEffect(() => {
    if (existingProjectId) setProjectId(existingProjectId)
  }, [existingProjectId])

  useEffect(() => {
    if (!activeJob || activeJob.status !== 'COMPLETED') return
    if (completedNotified.current.has(activeJob.analysisId)) return
    completedNotified.current.add(activeJob.analysisId)
    onAnalysisCompleted?.(activeJob.analysisId)
  }, [activeJob, onAnalysisCompleted])

  const resetWizard = useCallback(() => {
    uploadAbortRef.current += 1
    uploadPromiseRef.current = null
    projectReadyRef.current = null
    setStep('drop')
    setPendingFile(null)
    setPdfPageCount(null)
    setFolderName('')
    setUploadPct(null)
    setUploading(false)
    if (!existingProjectId) {
      setProjectId(null)
      setPdfUrl(null)
    }
  }, [existingProjectId])

  /** Só cria/reusa a linha da pasta (rápido) — sem esperar upload. */
  const ensureProjectRow = useCallback(
    async (file: File, name: string): Promise<string> => {
      if (projectId || existingProjectId) {
        const id = (projectId || existingProjectId) as string
        return id
      }
      if (projectReadyRef.current) return projectReadyRef.current

      const run = (async () => {
        const withPdf = await findQuoteProjectWithPdfBySourceName(companyId, file.name)
        if (withPdf.data?.id) {
          setProjectId(withPdf.data.id)
          if (withPdf.data.pdf_url) setPdfUrl(withPdf.data.pdf_url)
          return withPdf.data.id
        }
        // Upload ainda em curso: pasta já existe sem pdf_url.
        const inFlight = await findQuoteProjectBySourceName(companyId, file.name)
        if (inFlight.data?.id) {
          setProjectId(inFlight.data.id)
          if (inFlight.data.pdf_url) setPdfUrl(inFlight.data.pdf_url)
          return inFlight.data.id
        }
        const { data: project, error } = await createQuoteProject({
          companyId,
          name: name.slice(0, 120) || suggestFolderName(file.name),
          sourcePdfName: file.name,
          createdBy: userId,
        })
        if (error || !project) throw new Error(error || 'Não foi possível criar a pasta.')
        setProjectId(project.id)
        return project.id
      })()

      projectReadyRef.current = run
      try {
        return await run
      } finally {
        // mantém resolved promise para reuso no mesmo wizard
      }
    },
    [companyId, existingProjectId, projectId, userId],
  )

  /** Cria pasta + upload em segundo plano enquanto o usuário vê a grade. */
  const ensureFolderUploaded = useCallback(
    async (file: File, pageCount: number, name: string): Promise<{ projectId: string; pdfUrl: string }> => {
      if (uploadPromiseRef.current) return uploadPromiseRef.current

      const run = (async () => {
        // Reusa pasta que já tem este PDF (evita duplicar e reenviar 80MB).
        const reused = await findQuoteProjectWithPdfBySourceName(companyId, file.name)
        if (reused.data?.pdf_url) {
          setProjectId(reused.data.id)
          setPdfUrl(reused.data.pdf_url)
          projectReadyRef.current = Promise.resolve(reused.data.id)
          const reusedPages = reused.data.page_count || pageCount
          setUploading(false)
          setUploadPct(100)
          onFolderReady?.(reused.data.id)
          void cacheMissingProjectPageThumbs({
            companyId,
            projectId: reused.data.id,
            pageCount: reusedPages,
            localFile: file,
            pdfUrl: reused.data.pdf_url,
          }).catch((err) => {
            console.warn('[PdfUploadArea] cache de miniaturas (pasta reusada):', err)
          })
          return { projectId: reused.data.id, pdfUrl: reused.data.pdf_url }
        }

        let pid = projectId || existingProjectId
        if (!pid) {
          pid = await ensureProjectRow(file, name)
        }

        if (pdfUrl) {
          void cacheMissingProjectPageThumbs({
            companyId,
            projectId: pid,
            pageCount,
            localFile: file,
            pdfUrl,
          }).catch((err) => {
            console.warn('[PdfUploadArea] cache de miniaturas (PDF já na pasta):', err)
          })
          return { projectId: pid, pdfUrl }
        }

        setUploading(true)
        setUploadPct(0)
        const token = uploadAbortRef.current
        const up = await uploadQuoteProjectPdf({
          companyId,
          projectId: pid,
          file,
          onProgress: (pct) => {
            if (uploadAbortRef.current === token) setUploadPct(pct)
          },
        })
        if (uploadAbortRef.current !== token) {
          throw new Error('Upload cancelado.')
        }
        if (up.error || !up.path) throw new Error(up.error || 'Falha no upload do PDF.')

        const meta = await updateQuoteProjectPdf(pid, {
          pdf_url: up.path,
          page_count: pageCount,
          source_pdf_name: file.name,
        })
        if (meta.error) throw new Error(meta.error)

        setPdfUrl(up.path)
        setUploadPct(100)
        setUploading(false)
        onFolderReady?.(pid)

        // Após o PDF na pasta: grava miniaturas em segundo plano (próxima abertura já vem pronta).
        void cacheMissingProjectPageThumbs({
          companyId,
          projectId: pid,
          pageCount,
          localFile: file,
          pdfUrl: up.path,
        }).catch((err) => {
          console.warn('[PdfUploadArea] cache de miniaturas:', err)
        })

        return { projectId: pid, pdfUrl: up.path }
      })()

      uploadPromiseRef.current = run
      try {
        return await run
      } catch (err) {
        uploadPromiseRef.current = null
        setUploading(false)
        throw err
      }
    },
    [companyId, ensureProjectRow, existingProjectId, onFolderReady, pdfUrl, projectId, userId],
  )

  const startBatch = useCallback(
    async (pages: number[]) => {
      if (!companyId || !pendingFile || pdfPageCount == null) {
        toast.error('Arquivo não encontrado. Selecione o PDF de novo.')
        return
      }
      if (!pages.length) {
        toast.error('Selecione ao menos uma página na grade.')
        return
      }
      const name = folderName.trim() || suggestFolderName(pendingFile.name)

      setStarting(true)
      setStartingLabel(`Iniciando cotação (${pages.length} página${pages.length === 1 ? '' : 's'})…`)
      try {
        // Garante a pasta (rápido) antes do lote — evita pasta duplicada se o React
        // ainda não atualizou projectId enquanto o PDF de 80MB sobe.
        const pid = await ensureProjectRow(pendingFile, name)
        if (pendingFile && pdfPageCount && name) {
          void ensureFolderUploaded(pendingFile, pdfPageCount, name).catch((err) => {
            console.warn('[PdfUploadArea] upload pasta em background:', err)
          })
        }

        let analysisId: string | null = null
        // Só usa fromProject se o PDF já estiver gravado (sem reenviar 80MB).
        if (pid && pdfUrl) {
          analysisId = await bg.startQuoteAnalysisFromProject({
            companyId,
            projectId: pid,
            pageNumbers: pages,
            userId,
            mode,
            extractionModel,
          })
        }
        if (!analysisId) {
          analysisId = await bg.startQuoteAnalysis({
            companyId,
            userId,
            mode,
            extractionModel,
            files: [pendingFile],
            pageNumbers: pages,
            existingProjectId: pid,
            projectName: name,
          })
        }
        if (analysisId) {
          onAnalysisCreated?.(analysisId)
          resetWizard()
        } else {
          toast.error('Não foi possível iniciar a cotação. Tente de novo.')
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao iniciar cotação.'
        toast.error(message, { duration: 12000 })
      } finally {
        setStarting(false)
        setStartingLabel(null)
      }
    },
    [
      bg,
      companyId,
      ensureFolderUploaded,
      ensureProjectRow,
      existingProjectId,
      extractionModel,
      folderName,
      mode,
      onAnalysisCreated,
      pendingFile,
      pdfPageCount,
      pdfUrl,
      resetWizard,
      userId,
    ],
  )

  const processFiles = useCallback(
    async (filesInput: FileList | File[]) => {
      if (!companyId) {
        toast.error('Empresa não identificada.')
        return
      }
      const files = Array.from(filesInput).filter(isAllowedQuoteSourceFile).slice(0, 40)
      if (!files.length) {
        toast.error('Envie PDF ou imagens (PNG, JPG, WebP).')
        return
      }

      const primary = files[0]
      if (files.length === 1 && isPdfFile(primary)) {
        setCountingPages(true)
        setStartingLabel(`Lendo ${primary.name}…`)
        try {
          const total = await countPdfPages(primary)
          const name = suggestFolderName(primary.name)
          setPendingFile(primary)
          setPdfPageCount(total)
          setFolderName(existingProjectId ? '' : name)
          setStep('pick')

          // Upload em background assim que o arquivo é escolhido (prévia usa o arquivo local).
          if (!existingProjectId) {
            void ensureFolderUploaded(primary, total, name).catch((err) => {
              console.warn('[PdfUploadArea] upload antecipado:', err)
              setUploading(false)
            })
          } else {
            setProjectId(existingProjectId)
            void ensureFolderUploaded(primary, total, name).catch(() => {
              setUploading(false)
            })
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Não foi possível ler o PDF.'
          toast.error(message)
          resetWizard()
        } finally {
          setCountingPages(false)
          setStartingLabel(null)
        }
        return
      }

      setStarting(true)
      setStartingLabel(`Enviando ${files.length} arquivo(s)…`)
      try {
        const analysisId = await bg.startQuoteAnalysis({
          companyId,
          userId,
          mode,
          extractionModel,
          files,
          existingProjectId: existingProjectId || undefined,
        })
        if (analysisId) onAnalysisCreated?.(analysisId)
      } finally {
        setStarting(false)
        setStartingLabel(null)
      }
    },
    [
      bg,
      companyId,
      ensureFolderUploaded,
      existingProjectId,
      extractionModel,
      mode,
      onAnalysisCreated,
      resetWizard,
      userId,
    ],
  )

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const list = event.dataTransfer.files
    if (list?.length) void processFiles(list)
  }

  return (
    <div className="space-y-5">
      {step === 'drop' && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Modo de análise</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode('max')}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                  mode === 'max'
                    ? 'border-[#0066FF] bg-[#0066FF]/8 ring-1 ring-[#0066FF]/40'
                    : 'border-border bg-background hover:bg-muted/40',
                )}
              >
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#0066FF]" />
                <span>
                  <span className="block text-sm font-semibold">Modo Max</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Extração profunda + auditoria construtiva.
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode('pro')}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                  mode === 'pro'
                    ? 'border-amber-600 bg-amber-500/10 ring-1 ring-amber-600/35'
                    : 'border-border bg-background hover:bg-muted/40',
                )}
              >
                <Zap className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <span>
                  <span className="block text-sm font-semibold">Modo Pro</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Leitura mais rápida para orçamentos preliminares.
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="extraction-model" className="text-sm font-medium text-foreground">
              Modelo de IA (visão)
            </Label>
            <Select
              value={extractionModel}
              onValueChange={(value) => {
                if ((EXTRACTION_MODEL_KEYS as readonly string[]).includes(value)) {
                  setExtractionModel(value as ExtractionModelKey)
                }
              }}
              disabled={busy}
            >
              <SelectTrigger id="extraction-model" className="w-full sm:max-w-md">
                <SelectValue placeholder="Escolha o modelo" />
              </SelectTrigger>
              <SelectContent>
                {EXTRACTION_MODEL_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {EXTRACTION_MODEL_LABELS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Após escolher o PDF: nome da pasta + grade com prévia imediatamente */}
      {step === 'pick' && pendingFile && pdfPageCount != null && (
        <div className="space-y-4">
          {!existingProjectId && (
            <div
              className="relative overflow-hidden rounded-2xl border border-[#0066FF]/30 bg-white p-4 sm:p-5"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(0,102,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,102,255,0.04) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0066FF] text-white">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p
                    className="text-lg text-slate-900"
                    style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}
                  >
                    Pasta do projeto
                  </p>
                  <Label htmlFor="folder-name" className="flex items-center gap-1.5 text-xs">
                    <PencilLine className="h-3.5 w-3.5 text-[#0066FF]" />
                    Nome da pasta
                  </Label>
                  <Input
                    id="folder-name"
                    value={folderName}
                    disabled={starting}
                    maxLength={120}
                    placeholder="Ex.: Casa Mesa — Pav. Inferior"
                    className="h-11 border-slate-300 focus-visible:ring-[#0066FF]"
                    onChange={(e) => setFolderName(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-600">
                    Arquivo: <span className="font-medium">{pendingFile.name}</span>
                    {' · '}
                    {pdfPageCount} págs. · {formatMb(pendingFile.size)} MB
                    {uploading
                      ? ` · Enviando${uploadPct != null ? ` ${uploadPct}%` : '…'}`
                      : pdfUrl
                        ? ' · PDF salvo na pasta'
                        : ''}
                  </p>
                  {uploading && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#0066FF] transition-all"
                        style={{ width: `${Math.max(4, uploadPct ?? 6)}%` }}
                      />
                    </div>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" disabled={starting} onClick={resetWizard}>
                  Trocar PDF
                </Button>
              </div>
            </div>
          )}

          <PageGridSelector
            key={`${pendingFile.name}-${pdfPageCount}`}
            projectId={projectId || undefined}
            companyId={companyId}
            pdfUrl={pdfUrl}
            localFile={pendingFile}
            pageCount={pdfPageCount}
            budgetedPages={[]}
            disabled={starting}
            title="Cotar seleção de páginas"
            subtitle="Prévia do PDF que você enviou — clique nas miniaturas para escolher (1 e 7, ou 1–4 e 9…)."
            onCancel={resetWizard}
            onConfirm={(pages) => {
              void startBatch(pages)
            }}
          />

          {starting && startingLabel ? (
            <p className="flex items-center gap-2 text-sm text-[#0066FF]">
              <Loader2 className="h-4 w-4 animate-spin" />
              {startingLabel}
            </p>
          ) : null}
        </div>
      )}

      {step === 'drop' && (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onClick={() => !busy && inputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragging(false)
          }}
          onDrop={onDrop}
          className={cn(
            'relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all',
            dragging
              ? 'scale-[1.01] border-[#0066FF] bg-[#0066FF]/8'
              : 'border-slate-300/80 bg-gradient-to-b from-white to-slate-50',
            busy && 'pointer-events-none opacity-70',
          )}
          style={{
            backgroundImage: dragging
              ? undefined
              : 'linear-gradient(rgba(0,102,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,102,255,0.035) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.length) void processFiles(e.target.files)
              e.target.value = ''
            }}
          />
          {busy ? (
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-[#0066FF]" />
          ) : (
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0066FF]/10 text-[#0066FF] ring-1 ring-[#0066FF]/20">
              <FileUp className="h-7 w-7" />
            </div>
          )}
          <p
            className="text-lg text-slate-900"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}
          >
            Solte o PDF do projeto
          </p>
          <p className="mt-1 max-w-md text-xs text-slate-600">
            Na hora a prévia das páginas aparece para você marcar quais cotar.
          </p>
          {startingLabel && (
            <p className="mt-3 text-xs font-medium text-foreground/80">{startingLabel}</p>
          )}
        </div>
      )}

      {activeJob && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0066FF]/25 bg-[#0066FF]/5 px-3 py-2.5">
            <p className="text-sm text-[#1a2332]">
              {activeJob.needsResume
                ? 'Análise pausada. Retome no painel flutuante.'
                : 'Rodando em segundo plano — pode navegar livremente.'}
            </p>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => bg.requestExpand()}>
              Acompanhar
            </Button>
          </div>
          <AiThoughtConsole
            status={activeJob.status}
            pipelineStage={activeJob.pipelineStage}
            pipelineDetail={activeJob.pipelineDetail}
            thoughtLog={activeJob.thoughtLog}
            analysisId={activeJob.analysisId}
            companyId={activeJob.companyId}
            projectId={
              (typeof activeJob.totalsSnapshot?.project_id === 'string'
                ? activeJob.totalsSnapshot.project_id
                : null) ||
              projectId ||
              null
            }
            pagesProcessed={activeJob.pagesProcessed}
            totals={activeJob.totalsSnapshot}
            errorMessage={activeJob.errorMessage}
            density="full"
          />
        </div>
      )}
    </div>
  )
}
