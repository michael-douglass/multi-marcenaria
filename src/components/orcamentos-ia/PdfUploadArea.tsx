import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { FileUp, Loader2, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { AiThoughtConsole } from '@/components/orcamentos-ia/AiThoughtConsole'
import {
  createPendingQuoteAnalysis,
  isAllowedQuoteSourceFile,
  isQuoteAnalysisStatus,
  parseThoughtLog,
  updateQuoteAnalysisPdfPath,
  uploadQuoteSource,
  type QuoteAnalysisMode,
  type QuoteAnalysisStatus,
  type ThoughtLogEntry,
} from '@/lib/orcamentos-ia/storage'
import { runOrcamentosIaPipeline } from '@/lib/orcamentos-ia/pipeline'

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
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [status, setStatus] = useState<QuoteAnalysisStatus | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pipelineStage, setPipelineStage] = useState<string | null>(null)
  const [pipelineDetail, setPipelineDetail] = useState<string | null>(null)
  const [thoughtLog, setThoughtLog] = useState<ThoughtLogEntry[]>([])
  const [pagesProcessed, setPagesProcessed] = useState<number | null>(null)

  const busy = uploading || (status != null && status !== 'COMPLETED' && status !== 'FAILED')

  const applyAnalysisRow = useCallback(
    (row: {
      status?: string
      error_message?: string | null
      totals?: Record<string, unknown> | null
    }) => {
      if (row.status && isQuoteAnalysisStatus(row.status)) {
        setStatus(row.status)
      }
      if (row.error_message) setErrorMessage(row.error_message)
      const totals = row.totals && typeof row.totals === 'object' ? row.totals : null
      if (totals) {
        const stage = totals.pipeline_stage
        const detail = totals.pipeline_detail
        setPipelineStage(typeof stage === 'string' ? stage : null)
        setPipelineDetail(typeof detail === 'string' ? detail : null)
        setThoughtLog(parseThoughtLog(totals))
        const pp = totals.pages_processed
        setPagesProcessed(typeof pp === 'number' ? pp : null)
      }
    },
    [],
  )

  useEffect(() => {
    if (!analysisId) return

    const channel = supabase
      .channel(`quote-analyses-${analysisId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'quote_analyses',
          filter: `id=eq.${analysisId}`,
        },
        (payload) => {
          applyAnalysisRow(payload.new as {
            status?: string
            error_message?: string | null
            totals?: Record<string, unknown> | null
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [analysisId, applyAnalysisRow])

  // Fallback: se o Realtime atrasar, busca o status a cada 2,5s enquanto estiver ocupado
  useEffect(() => {
    if (!analysisId || !busy) return
    let cancelled = false
    const tick = async () => {
      const { data } = await supabase
        .from('quote_analyses')
        .select('status, error_message, totals')
        .eq('id', analysisId)
        .maybeSingle()
      if (!cancelled && data) applyAnalysisRow(data)
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [analysisId, busy, applyAnalysisRow])

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

      setUploading(true)
      setFileName(files.map((f) => f.name).join(', '))
      setErrorMessage(null)
      setStatus(null)
      setPipelineStage('upload')
      setPipelineDetail('Enviando o arquivo para o sistema…')
      setThoughtLog([
        {
          at: new Date().toISOString(),
          stage: 'upload',
          kind: 'info',
          message: 'Enviando o arquivo para o sistema…',
        },
      ])
      setPagesProcessed(null)
      setAnalysisId(null)

      try {
        const { data: analysis, error: createError } = await createPendingQuoteAnalysis({
          companyId,
          mode,
          createdBy: userId,
        })
        if (createError || !analysis) {
          throw new Error(createError || 'Não foi possível criar a análise.')
        }

        setAnalysisId(analysis.id)
        setStatus('PENDING')
        onAnalysisCreated?.(analysis.id)

        // Upload do primeiro arquivo como “fonte” principal; demais entram só no pipeline
        const firstUpload = await uploadQuoteSource({
          companyId,
          analysisId: analysis.id,
          file: files[0],
        })
        if (firstUpload.error || !firstUpload.path) {
          throw new Error(firstUpload.error || 'Falha no upload.')
        }

        const pathUpdate = await updateQuoteAnalysisPdfPath(analysis.id, firstUpload.path)
        if (pathUpdate.error) {
          throw new Error(pathUpdate.error)
        }

        // Demais fontes opcionais no Storage (manifest)
        for (let i = 1; i < files.length; i++) {
          const up = await uploadQuoteSource({
            companyId,
            analysisId: analysis.id,
            file: files[i],
          })
          if (up.error) {
            console.warn('[upload] arquivo extra:', up.error)
          }
        }

        toast.success(
          files.length > 1
            ? `${files.length} arquivos enviados. Iniciando pipeline…`
            : 'Arquivo enviado. Iniciando pipeline de IA…',
        )
        setUploading(false)
        setStatus('PROCESSING')

        const pipelineResult = await runOrcamentosIaPipeline({
          analysisId: analysis.id,
          companyId,
          mode,
          sourceFiles: files,
        })

        if (!pipelineResult.ok) {
          throw new Error(pipelineResult.error || 'Pipeline de IA falhou.')
        }

        setStatus('COMPLETED')
        onAnalysisCompleted?.(analysis.id)
        toast.success(
          pipelineResult.materialsSaved
            ? `Análise concluída (${pipelineResult.materialsSaved} insumos).`
            : 'Análise concluída.',
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao enviar os arquivos.'
        setErrorMessage(message)
        setStatus('FAILED')
        toast.error(message)
      } finally {
        setUploading(false)
      }
    },
    [companyId, mode, onAnalysisCompleted, onAnalysisCreated, userId],
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
          PDF técnico e/ou imagens PNG/JPG/WebP. A IA extrai módulos, cota chapas/ferragens e liga
          cada item à página de origem.
        </p>
        {fileName && (
          <p className="mt-3 text-xs font-medium text-foreground/80">Arquivo(s): {fileName}</p>
        )}
      </div>

      {(status || uploading) && (
        <AiThoughtConsole
          status={status}
          pipelineStage={pipelineStage}
          pipelineDetail={
            pipelineDetail ||
            (uploading && !status ? 'Enviando o arquivo para o sistema…' : null)
          }
          thoughtLog={thoughtLog}
          uploading={uploading && !status}
          analysisId={analysisId}
          companyId={companyId}
          pagesProcessed={pagesProcessed}
          errorMessage={errorMessage}
        />
      )}
    </div>
  )
}
