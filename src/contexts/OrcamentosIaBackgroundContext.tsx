import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import {
  cancelOrcamentosIaAnalysis,
  createPendingQuoteAnalysis,
  createQuoteProject,
  CANCELLED_BY_USER_MESSAGE,
  deleteQuoteAnalysis,
  formatSourceBytes,
  getQuoteProject,
  isAllowedQuoteSourceFile,
  isQuoteAnalysisStatus,
  isReadyForClientPricing,
  appendThoughtLog,
  formatAsyncPageProgress,
  DEFAULT_EXTRACTION_MODEL,
  MAX_SOURCE_BYTES,
  parseThoughtLog,
  thoughtKindForStage,
  updateQuoteAnalysisPdfPath,
  updateQuoteProjectPdf,
  uploadQuoteProjectPdf,
  uploadQuoteSource,
  type ExtractionModelKey,
  type QuoteAnalysisMode,
  type QuoteAnalysisStatus,
  type ThoughtLogEntry,
} from '@/lib/orcamentos-ia/storage'
import { formatPageRanges } from '@/lib/orcamentos-ia/page-ranges'
import { countPdfPages } from '@/lib/pdf-to-image'
import {
  reprocessOrcamentosIaPipeline,
  runOrcamentosIaPipeline,
} from '@/lib/orcamentos-ia/pipeline'

const STORAGE_KEY = 'orcamentos-ia-bg-jobs'
/** Sem progresso em CONVERTING_PAGES por este tempo → FAILED. */
const CONVERTING_STALL_MS = 5 * 60 * 1000
const STALL_MESSAGE =
  'Travado na conversão de páginas (PDF→imagem) sem progresso. Reenvie o arquivo ou use Retomar.'

export interface OrcamentosIaBackgroundJob {
  id: string
  analysisId: string
  companyId: string
  fileName: string
  mode: QuoteAnalysisMode
  status: QuoteAnalysisStatus
  pipelineStage: string | null
  pipelineDetail: string | null
  thoughtLog: ThoughtLogEntry[]
  pagesProcessed: number | null
  errorMessage: string | null
  startedAt: number
  /** Snapshot de totals (engrenagens extract/audit). */
  totalsSnapshot: Record<string, unknown> | null
  /** Pipeline JS ainda rodando nesta aba. */
  runnerActive: boolean
  /** Precisa de Retomar (reabriu aba sem runner). */
  needsResume: boolean
}

export interface StartOrcamentosIaAnalysisInput {
  companyId: string
  userId?: string | null
  mode: QuoteAnalysisMode
  /** Modelo de visão (default Sonnet econômico). */
  extractionModel?: ExtractionModelKey
  files: File[]
  /**
   * Páginas absolutas do PDF a cotar neste lote (1-based).
   * Omitido = todas as páginas convertidas.
   */
  pageNumbers?: number[]
  /** Pasta de projeto existente — novo lote atrelado ao mesmo project_id. */
  existingProjectId?: string
  /** Nome da pasta ao criar (novo orçamento). */
  projectName?: string
}

export interface StartOrcamentosIaFromProjectInput {
  companyId: string
  projectId: string
  pageNumbers: number[]
  userId?: string | null
  mode: QuoteAnalysisMode
  extractionModel?: ExtractionModelKey
}

interface OrcamentosIaBackgroundContextValue {
  jobs: OrcamentosIaBackgroundJob[]
  expandRequest: number
  /** analysisId do job que o popup deve destacar ao expandir (Retomar / Acompanhar). */
  focusAnalysisId: string | null
  requestExpand: (analysisId?: string | null) => void
  startQuoteAnalysis: (input: StartOrcamentosIaAnalysisInput) => Promise<string | null>
  /** Novo lote na pasta — usa PDF permanente, sem re-upload. */
  startQuoteAnalysisFromProject: (
    input: StartOrcamentosIaFromProjectInput,
  ) => Promise<string | null>
  resumeQuoteAnalysis: (analysisId: string, companyIdHint?: string) => Promise<boolean>
  /** Apaga checkpoint e recomeça a leitura do PDF desde a página 1. */
  restartQuoteAnalysisFromScratch: (
    analysisId: string,
    companyIdHint?: string,
  ) => Promise<boolean>
  /** Interrompe a leitura async e o pipeline em andamento. */
  cancelQuoteAnalysis: (analysisId: string) => Promise<boolean>
  dismissJob: (jobId: string) => void
  dismissCompletedJobs: () => void
  openAnalysis: (analysisId: string) => void
  getActiveJobForCompany: (companyId: string) => OrcamentosIaBackgroundJob | undefined
  isRunningForCompany: (companyId: string) => boolean
}

const OrcamentosIaBackgroundContext =
  createContext<OrcamentosIaBackgroundContextValue | null>(null)

function isTerminal(status: QuoteAnalysisStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED'
}

function isBusyStatus(status: QuoteAnalysisStatus): boolean {
  return !isTerminal(status)
}

/** Confirma no banco se o pipeline realmente terminou (evita toast falso). */
async function confirmDbTerminal(
  analysisId: string,
): Promise<{
  terminal: boolean
  status: QuoteAnalysisStatus | null
  totals: Record<string, unknown> | null
}> {
  const { data } = await supabase
    .from('quote_analyses')
    .select('status, totals')
    .eq('id', analysisId)
    .maybeSingle()
  const status =
    data?.status && isQuoteAnalysisStatus(data.status) ? data.status : null
  const totals =
    data?.totals && typeof data.totals === 'object'
      ? (data.totals as Record<string, unknown>)
      : null
  return {
    terminal: status === 'COMPLETED' || status === 'NEEDS_REVIEW',
    status,
    totals,
  }
}

function stallTimestampMs(row: {
  updated_at?: string | null
  totals?: Record<string, unknown> | null
}): number {
  const totals = row.totals && typeof row.totals === 'object' ? row.totals : null
  const pipelineAt =
    totals && typeof totals.pipeline_updated_at === 'string' ? totals.pipeline_updated_at : null
  const raw = pipelineAt || row.updated_at
  if (!raw) return 0
  const t = Date.parse(raw)
  return Number.isFinite(t) ? t : 0
}

function isConvertingStall(row: {
  status?: string | null
  updated_at?: string | null
  totals?: Record<string, unknown> | null
}): boolean {
  if (row.status !== 'CONVERTING_PAGES') return false
  const ts = stallTimestampMs(row)
  if (!ts) return false
  return Date.now() - ts >= CONVERTING_STALL_MS
}

async function failStalledConversion(analysisId: string): Promise<void> {
  const { data: current } = await supabase
    .from('quote_analyses')
    .select('totals')
    .eq('id', analysisId)
    .maybeSingle()
  const prev =
    current?.totals && typeof current.totals === 'object'
      ? (current.totals as Record<string, unknown>)
      : {}
  await supabase
    .from('quote_analyses')
    .update({
      status: 'FAILED',
      error_message: STALL_MESSAGE,
      updated_at: new Date().toISOString(),
      totals: {
        ...prev,
        pipeline_stage: 'failed',
        pipeline_detail: STALL_MESSAGE,
        pipeline_updated_at: new Date().toISOString(),
      },
    })
    .eq('id', analysisId)
    .eq('status', 'CONVERTING_PAGES')
}

type StoredJobMeta = {
  id: string
  analysisId: string
  companyId: string
  fileName: string
  mode: QuoteAnalysisMode
  startedAt: number
}

function loadStoredMeta(): StoredJobMeta[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is StoredJobMeta =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as StoredJobMeta).analysisId === 'string' &&
        typeof (x as StoredJobMeta).companyId === 'string',
    )
  } catch {
    return []
  }
}

function saveStoredMeta(jobs: OrcamentosIaBackgroundJob[]) {
  try {
    const meta: StoredJobMeta[] = jobs
      .filter((j) => isBusyStatus(j.status) || j.needsResume)
      .map((j) => ({
        id: j.id,
        analysisId: j.analysisId,
        companyId: j.companyId,
        fileName: j.fileName,
        mode: j.mode,
        startedAt: j.startedAt,
      }))
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(meta))
  } catch {
    /* ignore quota */
  }
}

function applyRowToJob(
  job: OrcamentosIaBackgroundJob,
  row: {
    status?: string
    error_message?: string | null
    totals?: Record<string, unknown> | null
  },
): OrcamentosIaBackgroundJob {
  const next = { ...job }
  if (row.status && isQuoteAnalysisStatus(row.status)) {
    next.status = row.status
  }
  if (row.error_message !== undefined) next.errorMessage = row.error_message
  const totals = row.totals && typeof row.totals === 'object' ? row.totals : null
  if (totals) {
    next.totalsSnapshot = totals
    next.pipelineStage =
      typeof totals.pipeline_stage === 'string' ? totals.pipeline_stage : next.pipelineStage
    const asyncProgress = formatAsyncPageProgress(totals)
    const detailFromTotals =
      asyncProgress ||
      (typeof totals.pipeline_detail === 'string' ? totals.pipeline_detail : null)
    const prevDetail = next.pipelineDetail
    next.pipelineDetail = detailFromTotals || next.pipelineDetail

    // Base: thought_log do banco + espelho local quando pipeline_detail muda
    // (Edge patchTotals não grava thought_log a cada tick).
    let log = parseThoughtLog(totals)
    if (!log.length && job.thoughtLog.length) log = [...job.thoughtLog]
    if (
      detailFromTotals &&
      detailFromTotals.trim() &&
      detailFromTotals !== prevDetail
    ) {
      const stage =
        typeof totals.pipeline_stage === 'string' ? totals.pipeline_stage : next.pipelineStage
      log = appendThoughtLog(
        { thought_log: log },
        {
          stage: stage || 'extracting_batch',
          kind: thoughtKindForStage(stage),
          message: detailFromTotals.trim(),
        },
      )
    }
    next.thoughtLog = log

    const pp = totals.pages_processed ?? totals.current_page
    next.pagesProcessed = typeof pp === 'number' ? pp : next.pagesProcessed
  }
  if (isTerminal(next.status)) {
    next.runnerActive = false
    next.needsResume = false
  }
  return next
}

export function OrcamentosIaBackgroundProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<OrcamentosIaBackgroundJob[]>([])
  const [expandRequest, setExpandRequest] = useState(0)
  const [focusAnalysisId, setFocusAnalysisId] = useState<string | null>(null)
  const navigate = useNavigate()
  const hydratedRef = useRef(false)
  const runnersRef = useRef<Set<string>>(new Set())
  /** Evita loop de auto-retomada de precificação órfã. */
  const autoResumePricingRef = useRef<Set<string>>(new Set())
  const resumeQuoteAnalysisRef = useRef<
    ((analysisId: string, companyIdHint?: string) => Promise<boolean>) | null
  >(null)

  const updateJob = useCallback((jobId: string, patch: Partial<OrcamentosIaBackgroundJob>) => {
    setJobs((current) =>
      current.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
    )
  }, [])

  const updateJobByAnalysis = useCallback(
    (analysisId: string, patch: Partial<OrcamentosIaBackgroundJob>) => {
      setJobs((current) =>
        current.map((job) =>
          job.analysisId === analysisId ? { ...job, ...patch } : job,
        ),
      )
    },
    [],
  )

  const requestExpand = useCallback((analysisId?: string | null) => {
    if (analysisId) setFocusAnalysisId(analysisId)
    setExpandRequest((n) => n + 1)
  }, [])

  const openAnalysis = useCallback(
    (analysisId: string) => {
      navigate(`/orcamentos-ia?audit=${analysisId}`)
    },
    [navigate],
  )

  // Persistir meta no sessionStorage
  useEffect(() => {
    saveStoredMeta(jobs)
  }, [jobs])

  // Reidratar jobs da sessão + status no banco
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const stored = loadStoredMeta()
    if (!stored.length) return

    let cancelled = false
    ;(async () => {
      const restored: OrcamentosIaBackgroundJob[] = []
      for (const meta of stored) {
        const { data } = await supabase
          .from('quote_analyses')
          .select('id, company_id, mode, status, error_message, totals, source_pdf_path, updated_at')
          .eq('id', meta.analysisId)
          .maybeSingle()
        if (!data || cancelled) continue

        if (isConvertingStall(data)) {
          await failStalledConversion(meta.analysisId)
          data.status = 'FAILED'
          data.error_message = STALL_MESSAGE
          const prevTotals =
            data.totals && typeof data.totals === 'object'
              ? (data.totals as Record<string, unknown>)
              : {}
          data.totals = {
            ...prevTotals,
            pipeline_stage: 'failed',
            pipeline_detail: STALL_MESSAGE,
          }
        }

        const status = isQuoteAnalysisStatus(data.status) ? data.status : 'FAILED'
        const totals =
          data.totals && typeof data.totals === 'object'
            ? (data.totals as Record<string, unknown>)
            : null
        restored.push({
          id: meta.id,
          analysisId: meta.analysisId,
          companyId: meta.companyId,
          fileName: meta.fileName,
          mode: meta.mode === 'pro' ? 'pro' : 'max',
          status,
          pipelineStage: typeof totals?.pipeline_stage === 'string' ? totals.pipeline_stage : null,
          pipelineDetail:
            typeof totals?.pipeline_detail === 'string' ? totals.pipeline_detail : null,
          thoughtLog: parseThoughtLog(totals ?? undefined),
          pagesProcessed:
            typeof totals?.pages_processed === 'number' ? totals.pages_processed : null,
          errorMessage: data.error_message ?? null,
          startedAt: meta.startedAt,
          totalsSnapshot: totals,
          runnerActive: false,
          needsResume:
            isBusyStatus(status) || isReadyForClientPricing(totals),
        })
      }
      if (!cancelled && restored.length) {
        setJobs((prev) => {
          const ids = new Set(prev.map((j) => j.analysisId))
          return [...prev, ...restored.filter((j) => !ids.has(j.analysisId))]
        })
        // Precificação órfã: Edge já fechou, cliente sumiu — retoma sozinho 1x.
        for (const job of restored) {
          if (
            !isReadyForClientPricing(job.totalsSnapshot) ||
            !isBusyStatus(job.status)
          ) {
            continue
          }
          if (autoResumePricingRef.current.has(job.analysisId)) continue
          autoResumePricingRef.current.add(job.analysisId)
          void resumeQuoteAnalysisRef.current?.(job.analysisId, job.companyId)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Realtime + poll para jobs ocupados
  useEffect(() => {
    const active = jobs.filter((j) => isBusyStatus(j.status) || j.runnerActive)
    if (!active.length) return

    const channels = active.map((job) =>
      supabase
        .channel(`orcamentos-ia-bg-${job.analysisId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'quote_analyses',
            filter: `id=eq.${job.analysisId}`,
          },
          (payload) => {
            const row = payload.new as {
              status?: string
              error_message?: string | null
              totals?: Record<string, unknown> | null
            }
            setJobs((current) =>
              current.map((j) =>
                j.analysisId === job.analysisId ? applyRowToJob(j, row) : j,
              ),
            )
          },
        )
        .subscribe(),
    )

    let cancelled = false
    const tick = async () => {
      for (const job of active) {
        const { data } = await supabase
          .from('quote_analyses')
          .select('status, error_message, totals, updated_at')
          .eq('id', job.analysisId)
          .maybeSingle()
        if (cancelled || !data) continue

        if (isConvertingStall(data)) {
          // Se esta aba ainda está rodando o pipeline, não mate por stall —
          // os timeouts do pdf.js / pipeline já cobrem travamento real.
          if (runnersRef.current.has(job.analysisId)) {
            setJobs((current) =>
              current.map((j) =>
                j.analysisId === job.analysisId ? applyRowToJob(j, data) : j,
              ),
            )
            continue
          }
          await failStalledConversion(job.analysisId)
          runnersRef.current.delete(job.analysisId)
          setJobs((current) =>
            current.map((j) =>
              j.analysisId === job.analysisId
                ? {
                    ...j,
                    status: 'FAILED' as QuoteAnalysisStatus,
                    errorMessage: STALL_MESSAGE,
                    runnerActive: false,
                    needsResume: true,
                    pipelineStage: 'failed',
                    pipelineDetail: STALL_MESSAGE,
                  }
                : j,
            ),
          )
          toast.error('Orçamento IA travou nas páginas', {
            description: STALL_MESSAGE,
          })
          continue
        }

        setJobs((current) =>
          current.map((j) =>
            j.analysisId === job.analysisId ? applyRowToJob(j, data) : j,
          ),
        )
      }
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 2500)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      for (const ch of channels) void supabase.removeChannel(ch)
    }
  }, [jobs.map((j) => `${j.analysisId}:${j.status}:${j.runnerActive}`).join('|')])

  const startQuoteAnalysis = useCallback(
    async (input: StartOrcamentosIaAnalysisInput): Promise<string | null> => {
      const { companyId, userId, mode } = input
      const extractionModel = input.extractionModel ?? DEFAULT_EXTRACTION_MODEL
      const files = input.files.filter(isAllowedQuoteSourceFile).slice(0, 300)
      const pageNumbers =
        Array.isArray(input.pageNumbers) && input.pageNumbers.length > 0
          ? [...new Set(input.pageNumbers.filter((p) => Number.isInteger(p) && p > 0))].sort(
              (a, b) => a - b,
            )
          : undefined
      const existingProjectId = input.existingProjectId?.trim() || undefined
      if (!companyId) {
        toast.error('Empresa não identificada.')
        return null
      }
      if (!files.length) {
        toast.error('Envie PDF ou imagens (PNG, JPG, WebP).')
        return null
      }

      const fileName = files.map((f) => f.name).join(', ')
      const primary = files[0]
      const primaryMb = formatSourceBytes(primary.size)
      const jobId = crypto.randomUUID()

      if (primary.size > MAX_SOURCE_BYTES) {
        toast.error(
          `Arquivo grande demais (${primaryMb}). Limite: ${formatSourceBytes(MAX_SOURCE_BYTES)}. Comprima o PDF e tente de novo.`,
        )
        return null
      }

      let createdAnalysisId: string | null = null
      try {
        let projectId = existingProjectId ?? null
        if (!projectId) {
          const folderName =
            (input.projectName?.trim() ||
              primary.name.replace(/\.[^.]+$/, '') ||
              'Projeto').slice(0, 120)
          const { data: project, error: projectError } = await createQuoteProject({
            companyId,
            name: folderName,
            sourcePdfName: primary.name,
            createdBy: userId,
          })
          if (projectError || !project) {
            throw new Error(projectError || 'Não foi possível criar a pasta do projeto.')
          }
          projectId = project.id
        }

        const { data: analysis, error: createError } = await createPendingQuoteAnalysis({
          companyId,
          mode,
          extractionModel,
          createdBy: userId,
          projectId,
          pageRanges: pageNumbers ?? null,
          batchLabel: pageNumbers?.length ? formatPageRanges(pageNumbers) : null,
        })
        if (createError || !analysis) {
          throw new Error(createError || 'Não foi possível criar a análise.')
        }
        createdAnalysisId = analysis.id

        // Job visível DURANTE o upload (antes só aparecia depois — parecia “travado”).
        const uploadingDetail = `Enviando PDF (${primaryMb})… mantenha esta aba aberta.`
        const baseJob: OrcamentosIaBackgroundJob = {
          id: jobId,
          analysisId: analysis.id,
          companyId,
          fileName,
          mode,
          status: 'PENDING',
          pipelineStage: 'upload',
          pipelineDetail: uploadingDetail,
          thoughtLog: [
            {
              at: new Date().toISOString(),
              stage: 'upload',
              kind: 'info',
              message: uploadingDetail,
            },
          ],
          pagesProcessed: null,
          errorMessage: null,
          startedAt: Date.now(),
          totalsSnapshot: null,
          runnerActive: true,
          needsResume: false,
        }
        setJobs((current) => [...current, baseJob])
        toast.message('Enviando PDF…', {
          description: `${primary.name} (${primaryMb}). Pode demorar em arquivos grandes.`,
          duration: 8000,
        })

        let lastPct = -1
        const onUploadPct = (percent: number) => {
          if (percent === lastPct) return
          lastPct = percent
          updateJobByAnalysis(analysis.id, {
            pipelineDetail: `Enviando PDF… ${percent}% (${primaryMb})`,
          })
        }

        // PDF permanente na pasta: um único path compartilhado por todos os lotes.
        const isPrimaryPdf =
          primary.type === 'application/pdf' || primary.name.toLowerCase().endsWith('.pdf')
        let pdfPath = ''
        if (projectId && isPrimaryPdf) {
          const { data: folderRow } = await getQuoteProject(projectId)
          if (folderRow?.pdf_url) {
            pdfPath = folderRow.pdf_url
          } else {
            const projectUpload = await uploadQuoteProjectPdf({
              companyId,
              projectId,
              file: primary,
              onProgress: onUploadPct,
            })
            if (projectUpload.error || !projectUpload.path) {
              throw new Error(projectUpload.error || 'Falha no upload do PDF da pasta.')
            }
            pdfPath = projectUpload.path
            let pageCount: number | null = null
            try {
              pageCount = await countPdfPages(primary)
            } catch {
              pageCount = null
            }
            const pdfMeta = await updateQuoteProjectPdf(projectId, {
              pdf_url: pdfPath,
              page_count: pageCount,
              source_pdf_name: primary.name,
            })
            if (pdfMeta.error) throw new Error(pdfMeta.error)
          }
        } else {
          const firstUpload = await uploadQuoteSource({
            companyId,
            analysisId: analysis.id,
            file: primary,
            onProgress: onUploadPct,
          })
          if (firstUpload.error || !firstUpload.path) {
            throw new Error(firstUpload.error || 'Falha no upload.')
          }
          pdfPath = firstUpload.path
        }

        const pathUpdate = await updateQuoteAnalysisPdfPath(analysis.id, pdfPath)
        if (pathUpdate.error) throw new Error(pathUpdate.error)

        for (let i = 1; i < files.length; i++) {
          const up = await uploadQuoteSource({
            companyId,
            analysisId: analysis.id,
            file: files[i],
          })
          if (up.error) console.warn('[orcamentos-ia-bg] arquivo extra:', up.error)
        }

        updateJobByAnalysis(analysis.id, {
          status: 'PROCESSING',
          pipelineStage: 'upload',
          pipelineDetail: 'Arquivo enviado. Iniciando análise em segundo plano…',
          thoughtLog: [
            ...baseJob.thoughtLog,
            {
              at: new Date().toISOString(),
              stage: 'upload',
              kind: 'info',
              message: 'Arquivo enviado. Iniciando análise em segundo plano…',
            },
          ],
        })
        toast.message('Orçamento IA em segundo plano', {
          description:
            'Pode navegar para outras páginas — a análise continua nesta aba. Clique no ícone azul para acompanhar.',
          duration: 6000,
          action: {
            label: 'Acompanhar',
            onClick: () => requestExpand(),
          },
        })

        runnersRef.current.add(analysis.id)
        void (async () => {
          try {
            const result = await runOrcamentosIaPipeline({
              analysisId: analysis.id,
              companyId,
              mode,
              extractionModel,
              sourceFiles: files,
              pageNumbers,
              projectId: analysis.project_id || projectId || null,
            })
            runnersRef.current.delete(analysis.id)
            if (!result.ok) {
              updateJobByAnalysis(analysis.id, {
                status: 'FAILED',
                errorMessage: result.error || 'Pipeline falhou.',
                runnerActive: false,
                needsResume: false,
                pipelineDetail: result.error || 'Pipeline falhou.',
              })
              toast.error('Orçamento IA falhou', {
                description: result.error,
                action: {
                  label: 'Ver',
                  onClick: () => openAnalysis(analysis.id),
                },
              })
              return
            }
            const live = await confirmDbTerminal(analysis.id)
            if (live.terminal) {
              updateJobByAnalysis(analysis.id, {
                status: live.status!,
                runnerActive: false,
                needsResume: false,
                pipelineStage:
                  typeof live.totals?.pipeline_stage === 'string'
                    ? live.totals.pipeline_stage
                    : 'completed',
                pipelineDetail:
                  typeof live.totals?.pipeline_detail === 'string'
                    ? live.totals.pipeline_detail
                    : result.materialsSaved
                      ? `Pronto — ${result.materialsSaved} insumos salvos.`
                      : 'Análise concluída.',
              })
              toast.success(
                live.status === 'NEEDS_REVIEW'
                  ? 'Orçamento IA precisa de revisão'
                  : 'Orçamento IA concluído',
                {
                  description: fileName,
                  duration: 12000,
                  action: {
                    label: 'Abrir',
                    onClick: () => openAnalysis(analysis.id),
                  },
                },
              )
            } else {
              updateJobByAnalysis(analysis.id, {
                status: live.status ?? 'PROCESSING',
                runnerActive: false,
                needsResume: true,
                pipelineStage:
                  typeof live.totals?.pipeline_stage === 'string'
                    ? live.totals.pipeline_stage
                    : 'pricing_pending',
                pipelineDetail:
                  'Quase pronto — ainda há trabalho pendente. Use Retomar se não avançar sozinho.',
                totalsSnapshot: live.totals,
              })
              toast.message('Precificação quase pronta', {
                description:
                  'O aviso “concluído” foi adiado: ainda há trabalho pendente. Use Retomar se não avançar sozinho.',
                duration: 10000,
              })
            }
          } catch (err) {
            runnersRef.current.delete(analysis.id)
            const message = err instanceof Error ? err.message : 'Erro no pipeline'
            updateJobByAnalysis(analysis.id, {
              status: 'FAILED',
              errorMessage: message,
              runnerActive: false,
              needsResume: false,
              pipelineDetail: message,
            })
            toast.error('Orçamento IA falhou', { description: message })
          }
        })()

        return analysis.id
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao iniciar análise.'
        // NUNCA apagar a ficha no catch: upload de 70MB+ pode ainda estar
        // terminando no Storage depois de um abort/HMR. Só marca FAILED.
        if (createdAnalysisId) {
          await supabase
            .from('quote_analyses')
            .update({
              status: 'FAILED',
              error_message: message.slice(0, 500),
              updated_at: new Date().toISOString(),
            })
            .eq('id', createdAnalysisId)
            .is('source_pdf_path', null)
          updateJobByAnalysis(createdAnalysisId, {
            status: 'FAILED',
            errorMessage: message,
            runnerActive: false,
            needsResume: true,
            pipelineDetail: message,
          })
        }
        toast.error(message, { duration: 12000 })
        return null
      }
    },
    [openAnalysis, requestExpand, updateJobByAnalysis],
  )

  const startQuoteAnalysisFromProject = useCallback(
    async (input: StartOrcamentosIaFromProjectInput): Promise<string | null> => {
      const { companyId, projectId, userId, mode } = input
      const extractionModel = input.extractionModel ?? DEFAULT_EXTRACTION_MODEL
      const pageNumbers = [
        ...new Set(input.pageNumbers.filter((p) => Number.isInteger(p) && p > 0)),
      ].sort((a, b) => a - b)

      if (!companyId || !projectId) {
        toast.error('Pasta do projeto não identificada.')
        return null
      }
      if (!pageNumbers.length) {
        toast.error('Selecione ao menos uma página pendente.')
        return null
      }

      const { data: project, error: projectError } = await getQuoteProject(projectId)
      if (projectError || !project) {
        toast.error(projectError || 'Pasta não encontrada.')
        return null
      }
      if (!project.pdf_url) {
        toast.error(
          'Esta pasta ainda não tem PDF permanente. Use “Novo orçamento” e envie o arquivo uma vez.',
        )
        return null
      }

      const already = new Set(project.budgeted_pages || [])
      const fresh = pageNumbers.filter((p) => !already.has(p))
      if (!fresh.length) {
        toast.error('Todas as páginas escolhidas já foram orçadas. Selecione páginas em branco.')
        return null
      }
      if (fresh.length < pageNumbers.length) {
        toast.message('Algumas páginas já orçadas foram ignoradas.', {
          description: `Seguindo com ${fresh.length} página(s) pendente(s).`,
        })
      }

      let createdAnalysisId: string | null = null
      const jobId = crypto.randomUUID()
      const fileName = project.source_pdf_name || project.name || 'projeto.pdf'

      try {
        const { data: analysis, error: createError } = await createPendingQuoteAnalysis({
          companyId,
          mode,
          extractionModel,
          createdBy: userId,
          projectId,
          sourcePdfPath: project.pdf_url,
          pageRanges: fresh,
          batchLabel: formatPageRanges(fresh),
        })
        if (createError || !analysis) {
          throw new Error(createError || 'Não foi possível criar o lote.')
        }
        createdAnalysisId = analysis.id

        const baseJob: OrcamentosIaBackgroundJob = {
          id: jobId,
          analysisId: analysis.id,
          companyId,
          fileName,
          mode,
          status: 'PENDING',
          pipelineStage: 'upload',
          pipelineDetail: `Lote págs. ${formatPageRanges(fresh)} — usando PDF da pasta (sem reenvio)…`,
          thoughtLog: [
            {
              at: new Date().toISOString(),
              stage: 'upload',
              kind: 'info',
              message: `Lote págs. ${formatPageRanges(fresh)} — PDF permanente da pasta.`,
            },
          ],
          pagesProcessed: null,
          errorMessage: null,
          startedAt: Date.now(),
          totalsSnapshot: null,
          runnerActive: true,
          needsResume: false,
        }
        setJobs((current) => [...current, baseJob])
        toast.message('Cotação incremental iniciada', {
          description: `Páginas ${formatPageRanges(fresh)} · sem reenviar o PDF.`,
          duration: 6000,
          action: { label: 'Acompanhar', onClick: () => requestExpand() },
        })

        runnersRef.current.add(analysis.id)
        void (async () => {
          try {
            const result = await runOrcamentosIaPipeline({
              analysisId: analysis.id,
              companyId,
              mode,
              extractionModel,
              sourceFiles: [],
              pageNumbers: fresh,
              projectId,
            })
            runnersRef.current.delete(analysis.id)
            if (!result.ok) {
              updateJobByAnalysis(analysis.id, {
                status: 'FAILED',
                errorMessage: result.error || 'Pipeline falhou.',
                runnerActive: false,
                needsResume: true,
                pipelineDetail: result.error || 'Pipeline falhou.',
              })
              toast.error('Orçamento IA falhou', {
                description: `${result.error || 'Pipeline falhou.'} Use Retomar no lote para continuar com as mesmas páginas.`,
              })
              return
            }
            const live = await confirmDbTerminal(analysis.id)
            if (live.terminal) {
              updateJobByAnalysis(analysis.id, {
                status: live.status!,
                runnerActive: false,
                needsResume: false,
                pipelineStage:
                  typeof live.totals?.pipeline_stage === 'string'
                    ? live.totals.pipeline_stage
                    : 'completed',
                pipelineDetail:
                  typeof live.totals?.pipeline_detail === 'string'
                    ? live.totals.pipeline_detail
                    : result.materialsSaved
                      ? `Pronto — ${result.materialsSaved} insumos salvos.`
                      : 'Análise concluída.',
              })
              toast.success(
                live.status === 'NEEDS_REVIEW' ? 'Lote precisa de revisão' : 'Lote concluído',
                {
                  description: fileName,
                  duration: 12000,
                  action: { label: 'Abrir', onClick: () => openAnalysis(analysis.id) },
                },
              )
            } else {
              updateJobByAnalysis(analysis.id, {
                status: live.status ?? 'PROCESSING',
                runnerActive: false,
                needsResume: true,
                pipelineStage:
                  typeof live.totals?.pipeline_stage === 'string'
                    ? live.totals.pipeline_stage
                    : 'pricing_pending',
                pipelineDetail:
                  'Quase pronto — a nuvem ainda mexeu no status. Clique em Retomar para só precificar.',
                totalsSnapshot: live.totals,
              })
              toast.message('Precificação quase pronta', {
                description:
                  'O aviso “concluído” foi adiado: ainda há trabalho pendente. Use Retomar se não avançar sozinho.',
                duration: 10000,
              })
            }
          } catch (err) {
            runnersRef.current.delete(analysis.id)
            const message = err instanceof Error ? err.message : 'Erro no pipeline'
            updateJobByAnalysis(analysis.id, {
              status: 'FAILED',
              errorMessage: message,
              runnerActive: false,
              needsResume: true,
              pipelineDetail: message,
            })
            toast.error('Orçamento IA falhou', {
              description: `${message} Use Retomar no lote para continuar com as mesmas páginas.`,
            })
          }
        })()

        return analysis.id
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao iniciar lote.'
        if (createdAnalysisId) {
          await supabase
            .from('quote_analyses')
            .update({
              status: 'FAILED',
              error_message: message.slice(0, 500),
              updated_at: new Date().toISOString(),
            })
            .eq('id', createdAnalysisId)
          updateJobByAnalysis(createdAnalysisId, {
            status: 'FAILED',
            errorMessage: message,
            runnerActive: false,
            needsResume: true,
            pipelineDetail: message,
          })
        }
        toast.error(message, { duration: 12000 })
        return null
      }
    },
    [openAnalysis, requestExpand, updateJobByAnalysis],
  )

  const resumeQuoteAnalysis = useCallback(
    async (analysisId: string, companyIdHint?: string): Promise<boolean> => {
      // Runner fantasma: se o banco já falhou/concluiu, libera e deixa Retomar.
      if (runnersRef.current.has(analysisId)) {
        const { data: live } = await supabase
          .from('quote_analyses')
          .select('status')
          .eq('id', analysisId)
          .maybeSingle()
        const st = live?.status
        if (st === 'FAILED' || st === 'COMPLETED' || st === 'NEEDS_REVIEW') {
          runnersRef.current.delete(analysisId)
        } else {
          toast.info('Esta análise já está rodando nesta aba.')
          return false
        }
      }

      const { data: rowForResume } = await supabase
        .from('quote_analyses')
        .select('id, company_id, mode, status, error_message, source_pdf_path, totals')
        .eq('id', analysisId)
        .maybeSingle()
      if (!rowForResume) {
        toast.error('Análise não encontrada para retomar.')
        return false
      }
      const resumeTotals =
        rowForResume.totals && typeof rowForResume.totals === 'object'
          ? (rowForResume.totals as Record<string, unknown>)
          : {}
      const resumeBatchLabel =
        typeof resumeTotals.batch_label === 'string' && resumeTotals.batch_label.trim()
          ? resumeTotals.batch_label.trim()
          : null
      const resumeDetail = resumeBatchLabel
        ? `Retomando lote págs. ${resumeBatchLabel} — de onde parou…`
        : 'Retomando análise…'

      let job = jobs.find((j) => j.analysisId === analysisId)
      if (!job) {
        const companyId = companyIdHint || rowForResume.company_id
        if (!companyId) {
          toast.error('Empresa não identificada.')
          return false
        }
        const fileName = rowForResume.source_pdf_path?.split('/').pop() || 'projeto.pdf'
        job = {
          id: crypto.randomUUID(),
          analysisId: rowForResume.id,
          companyId,
          fileName,
          mode: rowForResume.mode === 'pro' ? 'pro' : 'max',
          status: 'PROCESSING',
          pipelineStage: 'upload',
          pipelineDetail: resumeDetail,
          thoughtLog: [],
          pagesProcessed: null,
          errorMessage: null,
          startedAt: Date.now(),
          totalsSnapshot: resumeTotals,
          runnerActive: true,
          needsResume: false,
        }
        setJobs((current) => {
          const existing = current.find((j) => j.analysisId === analysisId)
          if (existing) {
            job = {
              ...existing,
              status: 'PROCESSING',
              runnerActive: true,
              needsResume: false,
              pipelineDetail: resumeDetail,
              errorMessage: null,
              startedAt: Date.now(),
              totalsSnapshot: resumeTotals,
            }
            return current.map((j) => (j.analysisId === analysisId ? job! : j))
          }
          return [...current, job!]
        })
      }

      const companyIdForResume =
        companyIdHint || job.companyId || rowForResume.company_id
      if (!companyIdForResume) {
        toast.error('Empresa não identificada.')
        return false
      }
      job = { ...job, companyId: companyIdForResume }

      runnersRef.current.add(analysisId)
      updateJobByAnalysis(analysisId, {
        status: 'PROCESSING',
        runnerActive: true,
        needsResume: false,
        pipelineDetail: resumeDetail,
        errorMessage: null,
      })
      requestExpand(analysisId)
      toast.message(resumeDetail, {
        description: 'Acompanhe os passos da precificação no painel ao lado.',
        duration: 5000,
      })

      try {
        const result = await reprocessOrcamentosIaPipeline({
          analysisId,
          companyId: companyIdForResume,
        })
        runnersRef.current.delete(analysisId)
        if (!result.ok) {
          const cancelled = /interrompid/i.test(result.error || '')
          updateJobByAnalysis(analysisId, {
            status: 'FAILED',
            errorMessage: result.error || 'Falha ao retomar.',
            runnerActive: false,
            needsResume: true,
            pipelineStage: 'failed',
            pipelineDetail: cancelled
              ? 'Interrompido pelo usuário. Use Retomar ou Recomeçar do zero.'
              : result.error || 'Falha ao retomar.',
          })
          if (cancelled) {
            toast.message('Leitura interrompida')
          } else {
            toast.error(result.error || 'Falha ao retomar.')
          }
          return false
        }
        const live = await confirmDbTerminal(analysisId)
        if (live.terminal) {
          updateJobByAnalysis(analysisId, {
            status: live.status!,
            runnerActive: false,
            needsResume: false,
            pipelineStage:
              typeof live.totals?.pipeline_stage === 'string'
                ? live.totals.pipeline_stage
                : 'completed',
            pipelineDetail:
              typeof live.totals?.pipeline_detail === 'string'
                ? live.totals.pipeline_detail
                : result.materialsSaved
                  ? `Pronto — ${result.materialsSaved} insumos salvos.`
                  : 'Análise concluída.',
          })
          toast.success(
            live.status === 'NEEDS_REVIEW'
              ? 'Orçamento IA precisa de revisão'
              : 'Orçamento IA concluído',
            {
              action: {
                label: 'Abrir',
                onClick: () => openAnalysis(analysisId),
              },
            },
          )
          return true
        }
        updateJobByAnalysis(analysisId, {
          status: live.status ?? 'PROCESSING',
          runnerActive: false,
          needsResume: true,
          pipelineStage:
            typeof live.totals?.pipeline_stage === 'string'
              ? live.totals.pipeline_stage
              : 'pricing_pending',
          pipelineDetail:
            'Quase pronto — ainda há trabalho pendente. Use Retomar se não avançar sozinho.',
          totalsSnapshot: live.totals,
        })
        toast.message('Precificação quase pronta', {
          description:
            'O aviso “concluído” foi adiado: ainda há trabalho pendente. Use Retomar se não avançar sozinho.',
          duration: 10000,
        })
        return false
      } catch (err) {
        runnersRef.current.delete(analysisId)
        const message = err instanceof Error ? err.message : 'Erro ao retomar'
        const cancelled = /interrompid/i.test(message)
        updateJobByAnalysis(analysisId, {
          status: 'FAILED',
          errorMessage: message,
          runnerActive: false,
          needsResume: true,
        })
        if (cancelled) toast.message('Leitura interrompida')
        else toast.error(message)
        return false
      }
    },
    [jobs, openAnalysis, requestExpand, updateJobByAnalysis],
  )

  resumeQuoteAnalysisRef.current = resumeQuoteAnalysis

  const restartQuoteAnalysisFromScratch = useCallback(
    async (analysisId: string, companyIdHint?: string): Promise<boolean> => {
      if (runnersRef.current.has(analysisId)) {
        toast.info('Esta análise já está rodando nesta aba. Aguarde ou recarregue.')
        return false
      }

      let job = jobs.find((j) => j.analysisId === analysisId)
      if (!job) {
        const { data } = await supabase
          .from('quote_analyses')
          .select('id, company_id, mode, status, error_message, source_pdf_path')
          .eq('id', analysisId)
          .maybeSingle()
        if (!data) {
          toast.error('Análise não encontrada para recomeçar.')
          return false
        }
        const companyId = companyIdHint || data.company_id
        if (!companyId) {
          toast.error('Empresa não identificada.')
          return false
        }
        const fileName = data.source_pdf_path?.split('/').pop() || 'projeto.pdf'
        job = {
          id: crypto.randomUUID(),
          analysisId: data.id,
          companyId,
          fileName,
          mode: data.mode === 'pro' ? 'pro' : 'max',
          status: 'PROCESSING',
          pipelineStage: 'upload',
          pipelineDetail: 'Recomeçando do zero…',
          thoughtLog: [],
          pagesProcessed: null,
          errorMessage: null,
          startedAt: Date.now(),
          totalsSnapshot: null,
          runnerActive: true,
          needsResume: false,
        }
        setJobs((current) => {
          const existing = current.find((j) => j.analysisId === analysisId)
          if (existing) {
            job = {
              ...existing,
              status: 'PROCESSING',
              runnerActive: true,
              needsResume: false,
              pipelineDetail: 'Recomeçando do zero…',
              errorMessage: null,
              startedAt: Date.now(),
            }
            return current.map((j) => (j.analysisId === analysisId ? job! : j))
          }
          return [...current, job!]
        })
      }

      runnersRef.current.add(analysisId)
      updateJobByAnalysis(analysisId, {
        status: 'PROCESSING',
        runnerActive: true,
        needsResume: false,
        pipelineDetail: 'Recomeçando do zero…',
        errorMessage: null,
      })
      requestExpand(analysisId)
      toast.message('Recomeçando Orçamento IA do zero…', {
        description: 'Acompanhe os passos da precificação no painel ao lado.',
        duration: 5000,
      })

      try {
        const result = await reprocessOrcamentosIaPipeline({
          analysisId,
          companyId: job.companyId,
          fromScratch: true,
        })
        runnersRef.current.delete(analysisId)
        if (!result.ok) {
          const cancelled = /interrompid/i.test(result.error || '')
          updateJobByAnalysis(analysisId, {
            status: 'FAILED',
            errorMessage: result.error || 'Falha ao recomeçar.',
            runnerActive: false,
            needsResume: true,
            pipelineStage: 'failed',
            pipelineDetail: cancelled
              ? 'Interrompido pelo usuário. Use Retomar ou Recomeçar do zero.'
              : result.error || 'Falha ao recomeçar.',
          })
          if (cancelled) toast.message('Leitura interrompida')
          else toast.error(result.error || 'Falha ao recomeçar.')
          return false
        }
        const live = await confirmDbTerminal(analysisId)
        if (live.terminal) {
          updateJobByAnalysis(analysisId, {
            status: live.status!,
            runnerActive: false,
            needsResume: false,
            pipelineStage:
              typeof live.totals?.pipeline_stage === 'string'
                ? live.totals.pipeline_stage
                : 'completed',
            pipelineDetail:
              typeof live.totals?.pipeline_detail === 'string'
                ? live.totals.pipeline_detail
                : result.materialsSaved
                  ? `Pronto — ${result.materialsSaved} insumos salvos.`
                  : 'Análise concluída.',
          })
          toast.success(
            live.status === 'NEEDS_REVIEW'
              ? 'Orçamento IA precisa de revisão'
              : 'Orçamento IA concluído (do zero)',
            {
              action: {
                label: 'Abrir',
                onClick: () => openAnalysis(analysisId),
              },
            },
          )
          return true
        }
        updateJobByAnalysis(analysisId, {
          status: live.status ?? 'PROCESSING',
          runnerActive: false,
          needsResume: true,
          pipelineStage:
            typeof live.totals?.pipeline_stage === 'string'
              ? live.totals.pipeline_stage
              : 'pricing_pending',
          pipelineDetail:
            'Quase pronto — ainda há trabalho pendente. Use Retomar se não avançar sozinho.',
          totalsSnapshot: live.totals,
        })
        toast.message('Precificação quase pronta', {
          description:
            'O aviso “concluído” foi adiado: ainda há trabalho pendente. Use Retomar se não avançar sozinho.',
          duration: 10000,
        })
        return false
      } catch (err) {
        runnersRef.current.delete(analysisId)
        const message = err instanceof Error ? err.message : 'Erro ao recomeçar'
        const cancelled = /interrompid/i.test(message)
        updateJobByAnalysis(analysisId, {
          status: 'FAILED',
          errorMessage: message,
          runnerActive: false,
          needsResume: true,
        })
        if (cancelled) toast.message('Leitura interrompida')
        else toast.error(message)
        return false
      }
    },
    [jobs, openAnalysis, requestExpand, updateJobByAnalysis],
  )

  const cancelQuoteAnalysis = useCallback(
    async (analysisId: string): Promise<boolean> => {
      const result = await cancelOrcamentosIaAnalysis(analysisId)
      if (!result.ok) {
        toast.error(result.error || 'Não foi possível interromper.')
        return false
      }
      runnersRef.current.delete(analysisId)
      updateJobByAnalysis(analysisId, {
        status: 'FAILED',
        runnerActive: false,
        needsResume: true,
        pipelineStage: 'failed',
        pipelineDetail: 'Interrompido pelo usuário. Use Retomar ou Recomeçar do zero.',
        errorMessage: CANCELLED_BY_USER_MESSAGE,
      })
      toast.message('Leitura interrompida', {
        description: 'Você pode Retomar do checkpoint ou Recomeçar do zero.',
      })
      return true
    },
    [updateJobByAnalysis],
  )

  const dismissJob = useCallback((jobId: string) => {
    setJobs((current) => current.filter((job) => job.id !== jobId))
  }, [])

  const dismissCompletedJobs = useCallback(() => {
    setJobs((current) =>
      current.filter((job) => isBusyStatus(job.status) || job.runnerActive || job.needsResume),
    )
  }, [])

  const getActiveJobForCompany = useCallback(
    (companyId: string) =>
      jobs.find(
        (j) =>
          j.companyId === companyId &&
          (isBusyStatus(j.status) || j.runnerActive || j.needsResume),
      ),
    [jobs],
  )

  const isRunningForCompany = useCallback(
    (companyId: string) =>
      jobs.some(
        (j) =>
          j.companyId === companyId &&
          (j.runnerActive || (isBusyStatus(j.status) && !j.needsResume)),
      ),
    [jobs],
  )

  const value = useMemo(
    () => ({
      jobs,
      expandRequest,
      focusAnalysisId,
      requestExpand,
      startQuoteAnalysis,
      startQuoteAnalysisFromProject,
      resumeQuoteAnalysis,
      restartQuoteAnalysisFromScratch,
      cancelQuoteAnalysis,
      dismissJob,
      dismissCompletedJobs,
      openAnalysis,
      getActiveJobForCompany,
      isRunningForCompany,
    }),
    [
      cancelQuoteAnalysis,
      dismissCompletedJobs,
      dismissJob,
      expandRequest,
      focusAnalysisId,
      getActiveJobForCompany,
      isRunningForCompany,
      jobs,
      openAnalysis,
      requestExpand,
      resumeQuoteAnalysis,
      restartQuoteAnalysisFromScratch,
      startQuoteAnalysis,
      startQuoteAnalysisFromProject,
    ],
  )

  return (
    <OrcamentosIaBackgroundContext.Provider value={value}>
      {children}
    </OrcamentosIaBackgroundContext.Provider>
  )
}

export function useOrcamentosIaBackground(): OrcamentosIaBackgroundContextValue {
  const context = useContext(OrcamentosIaBackgroundContext)
  if (!context) {
    return {
      jobs: [],
      expandRequest: 0,
      focusAnalysisId: null,
      requestExpand: () => {},
      startQuoteAnalysis: async () => null,
      startQuoteAnalysisFromProject: async () => null,
      resumeQuoteAnalysis: async () => false,
      restartQuoteAnalysisFromScratch: async () => false,
      cancelQuoteAnalysis: async () => false,
      dismissJob: () => {},
      dismissCompletedJobs: () => {},
      openAnalysis: () => {},
      getActiveJobForCompany: () => undefined,
      isRunningForCompany: () => false,
    }
  }
  return context
}
