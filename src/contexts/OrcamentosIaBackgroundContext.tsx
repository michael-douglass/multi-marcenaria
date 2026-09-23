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
import {
  reprocessOrcamentosIaPipeline,
  runOrcamentosIaPipeline,
} from '@/lib/orcamentos-ia/pipeline'

const STORAGE_KEY = 'orcamentos-ia-bg-jobs'

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
  /** Pipeline JS ainda rodando nesta aba. */
  runnerActive: boolean
  /** Precisa de Retomar (reabriu aba sem runner). */
  needsResume: boolean
}

export interface StartOrcamentosIaAnalysisInput {
  companyId: string
  userId?: string | null
  mode: QuoteAnalysisMode
  files: File[]
}

interface OrcamentosIaBackgroundContextValue {
  jobs: OrcamentosIaBackgroundJob[]
  expandRequest: number
  requestExpand: () => void
  startQuoteAnalysis: (input: StartOrcamentosIaAnalysisInput) => Promise<string | null>
  resumeQuoteAnalysis: (analysisId: string) => Promise<boolean>
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
  if (row.error_message) next.errorMessage = row.error_message
  const totals = row.totals && typeof row.totals === 'object' ? row.totals : null
  if (totals) {
    next.pipelineStage =
      typeof totals.pipeline_stage === 'string' ? totals.pipeline_stage : next.pipelineStage
    next.pipelineDetail =
      typeof totals.pipeline_detail === 'string' ? totals.pipeline_detail : next.pipelineDetail
    next.thoughtLog = parseThoughtLog(totals)
    const pp = totals.pages_processed
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
  const navigate = useNavigate()
  const hydratedRef = useRef(false)
  const runnersRef = useRef<Set<string>>(new Set())

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

  const requestExpand = useCallback(() => {
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
          .select('id, company_id, mode, status, error_message, totals, source_pdf_path')
          .eq('id', meta.analysisId)
          .maybeSingle()
        if (!data || cancelled) continue
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
          runnerActive: false,
          needsResume: isBusyStatus(status),
        })
      }
      if (!cancelled && restored.length) {
        setJobs((prev) => {
          const ids = new Set(prev.map((j) => j.analysisId))
          return [...prev, ...restored.filter((j) => !ids.has(j.analysisId))]
        })
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
          .select('status, error_message, totals')
          .eq('id', job.analysisId)
          .maybeSingle()
        if (cancelled || !data) continue
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
      const files = input.files.filter(isAllowedQuoteSourceFile).slice(0, 40)
      if (!companyId) {
        toast.error('Empresa não identificada.')
        return null
      }
      if (!files.length) {
        toast.error('Envie PDF ou imagens (PNG, JPG, WebP).')
        return null
      }

      const fileName = files.map((f) => f.name).join(', ')
      const jobId = crypto.randomUUID()

      try {
        const { data: analysis, error: createError } = await createPendingQuoteAnalysis({
          companyId,
          mode,
          createdBy: userId,
        })
        if (createError || !analysis) {
          throw new Error(createError || 'Não foi possível criar a análise.')
        }

        const firstUpload = await uploadQuoteSource({
          companyId,
          analysisId: analysis.id,
          file: files[0],
        })
        if (firstUpload.error || !firstUpload.path) {
          throw new Error(firstUpload.error || 'Falha no upload.')
        }

        const pathUpdate = await updateQuoteAnalysisPdfPath(analysis.id, firstUpload.path)
        if (pathUpdate.error) throw new Error(pathUpdate.error)

        for (let i = 1; i < files.length; i++) {
          const up = await uploadQuoteSource({
            companyId,
            analysisId: analysis.id,
            file: files[i],
          })
          if (up.error) console.warn('[orcamentos-ia-bg] arquivo extra:', up.error)
        }

        const baseJob: OrcamentosIaBackgroundJob = {
          id: jobId,
          analysisId: analysis.id,
          companyId,
          fileName,
          mode,
          status: 'PROCESSING',
          pipelineStage: 'upload',
          pipelineDetail: 'Arquivo enviado. Iniciando análise em segundo plano…',
          thoughtLog: [
            {
              at: new Date().toISOString(),
              stage: 'upload',
              kind: 'info',
              message: 'Arquivo enviado. Iniciando análise em segundo plano…',
            },
          ],
          pagesProcessed: null,
          errorMessage: null,
          startedAt: Date.now(),
          runnerActive: true,
          needsResume: false,
        }

        setJobs((current) => [...current, baseJob])
        toast.message('Orçamento IA em segundo plano', {
          description: 'Pode navegar para outras páginas — a análise continua nesta aba. Clique no ícone azul para acompanhar.',
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
              sourceFiles: files,
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
            updateJobByAnalysis(analysis.id, {
              status: 'COMPLETED',
              runnerActive: false,
              needsResume: false,
              pipelineStage: 'completed',
              pipelineDetail: result.materialsSaved
                ? `Pronto — ${result.materialsSaved} insumos salvos.`
                : 'Análise concluída.',
            })
            toast.success('Orçamento IA concluído', {
              description: fileName,
              duration: 12000,
              action: {
                label: 'Abrir',
                onClick: () => openAnalysis(analysis.id),
              },
            })
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
        toast.error(message)
        return null
      }
    },
    [openAnalysis, requestExpand, updateJobByAnalysis],
  )

  const resumeQuoteAnalysis = useCallback(
    async (analysisId: string): Promise<boolean> => {
      const job = jobs.find((j) => j.analysisId === analysisId)
      if (!job) return false
      if (job.runnerActive || runnersRef.current.has(analysisId)) {
        toast.info('Esta análise já está rodando nesta aba.')
        return false
      }

      updateJob(job.id, {
        runnerActive: true,
        needsResume: false,
        pipelineDetail: 'Retomando análise…',
        errorMessage: null,
      })
      runnersRef.current.add(analysisId)
      toast.message('Retomando Orçamento IA…')

      try {
        const result = await reprocessOrcamentosIaPipeline({
          analysisId: job.analysisId,
          companyId: job.companyId,
        })
        runnersRef.current.delete(analysisId)
        if (!result.ok) {
          updateJob(job.id, {
            status: 'FAILED',
            errorMessage: result.error || 'Falha ao retomar.',
            runnerActive: false,
            needsResume: true,
          })
          toast.error(result.error || 'Falha ao retomar.')
          return false
        }
        updateJob(job.id, {
          status: 'COMPLETED',
          runnerActive: false,
          needsResume: false,
          pipelineStage: 'completed',
          pipelineDetail: 'Análise concluída.',
        })
        toast.success('Orçamento IA concluído', {
          action: {
            label: 'Abrir',
            onClick: () => openAnalysis(analysisId),
          },
        })
        return true
      } catch (err) {
        runnersRef.current.delete(analysisId)
        const message = err instanceof Error ? err.message : 'Erro ao retomar'
        updateJob(job.id, {
          status: 'FAILED',
          errorMessage: message,
          runnerActive: false,
          needsResume: true,
        })
        toast.error(message)
        return false
      }
    },
    [jobs, openAnalysis, requestExpand, updateJob],
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
      requestExpand,
      startQuoteAnalysis,
      resumeQuoteAnalysis,
      dismissJob,
      dismissCompletedJobs,
      openAnalysis,
      getActiveJobForCompany,
      isRunningForCompany,
    }),
    [
      dismissCompletedJobs,
      dismissJob,
      expandRequest,
      getActiveJobForCompany,
      isRunningForCompany,
      jobs,
      openAnalysis,
      requestExpand,
      resumeQuoteAnalysis,
      startQuoteAnalysis,
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
      requestExpand: () => {},
      startQuoteAnalysis: async () => null,
      resumeQuoteAnalysis: async () => false,
      dismissJob: () => {},
      dismissCompletedJobs: () => {},
      openAnalysis: () => {},
      getActiveJobForCompany: () => undefined,
      isRunningForCompany: () => false,
    }
  }
  return context
}
