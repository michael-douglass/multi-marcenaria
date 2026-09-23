import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { FileUp, Loader2, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AiThoughtConsole } from '@/components/orcamentos-ia/AiThoughtConsole'
import { useOrcamentosIaBackground } from '@/contexts/OrcamentosIaBackgroundContext'
import {
  isAllowedQuoteSourceFile,
  type QuoteAnalysisMode,
} from '@/lib/orcamentos-ia/storage'

interface PdfUploadAreaProps {
  companyId: string
  userId?: string | null
  onAnalysisCreated?: (analysisId: string) => void
  /** Chamado quando o pipeline termina com sucesso (status COMPLETED). */
  onAnalysisCompleted?: (analysisId: string) => void
}

export function PdfUploadArea({
  companyId,
  userId,
  onAnalysisCreated,
  onAnalysisCompleted,
}: PdfUploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<QuoteAnalysisMode>('max')
  const [dragging, setDragging] = useState(false)
  const [starting, setStarting] = useState(false)
  const bg = useOrcamentosIaBackground()
  const completedNotified = useRef<Set<string>>(new Set())

  const activeJob = bg.getActiveJobForCompany(companyId)
  const busy = starting || bg.isRunningForCompany(companyId)

  useEffect(() => {
    if (!activeJob || activeJob.status !== 'COMPLETED') return
    if (completedNotified.current.has(activeJob.analysisId)) return
    completedNotified.current.add(activeJob.analysisId)
    onAnalysisCompleted?.(activeJob.analysisId)
  }, [activeJob, onAnalysisCompleted])

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

      setStarting(true)
      try {
        const analysisId = await bg.startQuoteAnalysis({
          companyId,
          userId,
          mode,
          files,
        })
        if (analysisId) {
          onAnalysisCreated?.(analysisId)
        }
      } finally {
        setStarting(false)
      }
    },
    [bg, companyId, mode, onAnalysisCreated, userId],
  )

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const list = event.dataTransfer.files
    if (list?.length) void processFiles(list)
  }

  return (
    <div className="space-y-5">
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
              <span className="block text-sm font-semibold">Modo Max com o3-mini</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Extração profunda + auditoria construtiva (mais lento e preciso).
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
          'flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-[#0066FF] bg-[#0066FF]/5' : 'border-muted-foreground/25 bg-muted/20',
          busy && 'pointer-events-none opacity-70',
        )}
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
          <FileUp className="mb-3 h-10 w-10 text-muted-foreground" />
        )}
        <p className="text-sm font-medium text-foreground">
          Arraste PDF ou fotos do projeto (pode enviar várias) ou clique para selecionar
        </p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          A análise roda em segundo plano: você pode sair desta página. Um ícone flutuante
          acompanha o progresso.
        </p>
        {activeJob?.fileName && (
          <p className="mt-3 text-xs font-medium text-foreground/80">
            Arquivo(s): {activeJob.fileName}
          </p>
        )}
      </div>

      {activeJob && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0066FF]/25 bg-[#0066FF]/5 px-3 py-2.5">
            <p className="text-sm text-[#1a2332]">
              {activeJob.needsResume
                ? 'Análise pausada (aba foi recarregada). Retome no painel flutuante.'
                : 'Rodando em segundo plano — pode navegar livremente.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => bg.requestExpand()}
              >
                Acompanhar
              </Button>
              {activeJob.needsResume && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 bg-[#0066FF] text-white hover:bg-[#0052cc]"
                  onClick={() => void bg.resumeQuoteAnalysis(activeJob.analysisId)}
                >
                  Retomar
                </Button>
              )}
            </div>
          </div>
          <AiThoughtConsole
            status={activeJob.status}
            pipelineStage={activeJob.pipelineStage}
            pipelineDetail={activeJob.pipelineDetail}
            thoughtLog={activeJob.thoughtLog}
            analysisId={activeJob.analysisId}
            companyId={activeJob.companyId}
            pagesProcessed={activeJob.pagesProcessed}
            errorMessage={activeJob.errorMessage}
          />
        </div>
      )}
    </div>
  )
}
