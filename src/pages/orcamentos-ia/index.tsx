import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Brain,
  BrainCircuit,
  Eye,
  FilePlus2,
  FolderKanban,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Square,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useOrcamentosIaBackground } from '@/contexts/OrcamentosIaBackgroundContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PdfUploadArea } from '@/components/orcamentos-ia/PdfUploadArea'
import { PageGridSelector } from '@/components/orcamentos-ia/PageGridSelector'
import { formatBRL } from '@/lib/orcamentos-ia/pricing'
import { CompanyStandardsModal } from '@/components/orcamentos-ia/CompanyStandardsModal'
import { CompanyMemoriesModal } from '@/components/orcamentos-ia/CompanyMemoriesModal'
import { InventoryManagerModal } from '@/components/orcamentos-ia/InventoryManagerModal'
import { AuditWorkspace } from '@/components/orcamentos-ia/AuditWorkspace'
import { AiThoughtConsole } from '@/components/orcamentos-ia/AiThoughtConsole'
import { OrcamentosIaShaderBackdrop } from '@/components/orcamentos-ia/OrcamentosIaShaderBackdrop'
import { cn } from '@/lib/utils'
import { formatPageRanges } from '@/lib/orcamentos-ia/page-ranges'
import {
  refreshQuoteProjectFolderSnapshot,
  removeBudgetedPagesFromProject,
} from '@/lib/orcamentos-ia/project-folder-merge'
import {
  deleteQuoteAnalysis,
  deleteQuoteProject,
  failOrphanPendingAnalysesWithoutPdf,
  getQuoteProject,
  listQuoteAnalyses,
  listQuoteAnalysesForProject,
  listQuoteProjects,
  QUOTE_STATUS_LABEL,
  isReadyForClientPricing,
  type QuoteAnalysisRow,
  type QuoteAnalysisStatus,
  type QuoteProjectRow,
  type ThoughtLogEntry,
} from '@/lib/orcamentos-ia/storage'
import { CORTE_CLAUDE_CSS_VARS } from '@/lib/orcamentos-ia/ui-tokens'

function compactSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function analysisDisplayName(row: QuoteAnalysisRow): string {
  return row.source_pdf_path?.split('/').pop() || `Análise ${row.id.slice(0, 8)}`
}

export default function OrcamentosIaPage() {
  const { user } = useAuth()
  const { empresa } = useEmpresa()
  const companyId = empresa?.id ?? ''
  const bg = useOrcamentosIaBackground()
  const [searchParams, setSearchParams] = useSearchParams()
  const [standardsOpen, setStandardsOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [memoriesOpen, setMemoriesOpen] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  /** Pasta alvo do diálogo “Cotar mais” (grade com miniaturas salvas). */
  const [continueProjectId, setContinueProjectId] = useState<string | null>(null)
  /** Abre só a grade — separado do wizard “Novo orçamento”. */
  const [pagePickerOpen, setPagePickerOpen] = useState(false)
  const [analyses, setAnalyses] = useState<QuoteAnalysisRow[]>([])
  const [projectsById, setProjectsById] = useState<Record<string, QuoteProjectRow>>({})
  const [listLoading, setListLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<QuoteAnalysisRow | null>(null)
  /** Exclusão da pasta inteira (PDF + lotes + miniaturas). */
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<QuoteProjectRow | null>(null)
  /** Apagar cotação de páginas já orçadas (via grade). */
  const [removePagesTarget, setRemovePagesTarget] = useState<{
    projectId: string
    pages: number[]
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resumingId, setResumingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(
    () => searchParams.get('audit'),
  )
  /** Auto-retoma precificação órfã (Edge pronta, aba fechou) — 1x por lote. */
  const autoResumePricingIds = useRef<Set<string>>(new Set())

  const isPopout = searchParams.get('popout') === '1'

  const refreshList = useCallback(async () => {
    if (!companyId) return
    setListLoading(true)
    // Limpa lotes fantasma: PENDING sem PDF (upload abortado / aba fechada).
    await failOrphanPendingAnalysesWithoutPdf(companyId)
    const [{ data, error }, projects] = await Promise.all([
      listQuoteAnalyses(companyId),
      listQuoteProjects(companyId, 80),
    ])
    if (error) toast.error(error)
    setAnalyses(data)
    const map: Record<string, QuoteProjectRow> = {}
    for (const p of projects.data) map[p.id] = p
    setProjectsById(map)
    setListLoading(false)
  }, [companyId])

  useEffect(() => {
    const fromUrl = searchParams.get('audit')
    if (fromUrl) setActiveAnalysisId(fromUrl)
  }, [searchParams])

  /** Deep-link ?project= — foca pasta (abre último lote se houver, senão lista). */
  useEffect(() => {
    const projectId = searchParams.get('project')
    if (!projectId || searchParams.get('audit')) return
    if (!companyId) return
    let cancelled = false
    void (async () => {
      const { data } = await listQuoteAnalysesForProject(projectId)
      if (cancelled) return
      const sorted = [...(data ?? [])].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      )
      const latest = sorted[0]
      if (latest?.id) {
        setActiveAnalysisId(latest.id)
        const next = new URLSearchParams(searchParams)
        next.set('audit', latest.id)
        next.delete('project')
        setSearchParams(next, { replace: true })
      } else {
        setContinueProjectId(projectId)
        setPagePickerOpen(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams, companyId, setSearchParams])

  useEffect(() => {
    if (!activeAnalysisId) void refreshList()
  }, [activeAnalysisId, refreshList])

  /** Quando um job em segundo plano termina, atualiza a lista (evita badge preso em “Aguardando”). */
  const jobsSignature = bg.jobs.map((j) => `${j.analysisId}:${j.status}`).join('|')
  useEffect(() => {
    if (activeAnalysisId) return
    const hasTerminal = bg.jobs.some(
      (j) =>
        j.status === 'COMPLETED' || j.status === 'FAILED' || j.status === 'NEEDS_REVIEW',
    )
    if (hasTerminal) void refreshList()
  }, [jobsSignature, activeAnalysisId, refreshList, bg.jobs])

  /** Terminal: não precisa mais poll (COMPLETED / FAILED / NEEDS_REVIEW). */
  const isTerminalStatus = (status: QuoteAnalysisStatus) =>
    status === 'COMPLETED' || status === 'FAILED' || status === 'NEEDS_REVIEW'

  const isActivelyProcessing = (status: QuoteAnalysisStatus) =>
    status === 'PENDING' ||
    status === 'PROCESSING' ||
    status === 'CONVERTING_PAGES' ||
    status === 'READING_LAYOUT' ||
    status === 'EXTRACTING_MODULES' ||
    status === 'AUDITING_REVISION' ||
    status === 'FETCHING_MARKET_PRICES'

  /**
   * Travado em "montando lista / pricing_pending": a nuvem já terminou a leitura,
   * mas o navegador parou. Retoma só a precificação (sem reler o PDF).
   */
  useEffect(() => {
    if (!companyId || activeAnalysisId) return
    for (const row of analyses) {
      if (!isActivelyProcessing(row.status as QuoteAnalysisStatus)) continue
      const totals =
        row.totals && typeof row.totals === 'object'
          ? (row.totals as Record<string, unknown>)
          : null
      if (!isReadyForClientPricing(totals)) continue
      const job = bg.jobs.find((j) => j.analysisId === row.id)
      if (job?.runnerActive) continue
      if (autoResumePricingIds.current.has(row.id)) continue
      autoResumePricingIds.current.add(row.id)
      setResumingId(row.id)
      bg.requestExpand(row.id)
      void bg.resumeQuoteAnalysis(row.id, companyId).finally(() => {
        setResumingId((cur) => (cur === row.id ? null : cur))
        void refreshList()
      })
    }
  }, [
    analyses,
    companyId,
    activeAnalysisId,
    bg.jobs,
    bg.requestExpand,
    bg.resumeQuoteAnalysis,
    refreshList,
  ])

  /** Enquanto houver item processando (lista ou job em 2º plano), reconsulta a cada 4s. */
  useEffect(() => {
    if (activeAnalysisId) return
    const busyInList = analyses.some((a) => !isTerminalStatus(a.status as QuoteAnalysisStatus))
    const busyInBg = bg.jobs.some(
      (j) => j.runnerActive || (!isTerminalStatus(j.status) && !j.needsResume),
    )
    if (!busyInList && !busyInBg) return
    const id = window.setInterval(() => {
      void refreshList()
    }, 4000)
    return () => window.clearInterval(id)
  }, [analyses, activeAnalysisId, refreshList, bg.jobs])

  /** Status efetivo: job ativo em 2º plano vence FAILED antigo (Retomar em andamento). */
  const effectiveStatus = useCallback(
    (row: QuoteAnalysisRow): QuoteAnalysisStatus => {
      const job = bg.jobs.find((j) => j.analysisId === row.id)
      if (row.status === 'COMPLETED' || job?.status === 'COMPLETED') return 'COMPLETED'
      if (row.status === 'NEEDS_REVIEW' || job?.status === 'NEEDS_REVIEW') return 'NEEDS_REVIEW'
      // Retomar / processando: não ficar preso em “Falhou” enquanto o job roda.
      if (
        job &&
        (job.runnerActive || (!isTerminalStatus(job.status) && !job.needsResume))
      ) {
        return job.status
      }
      if (row.status === 'FAILED' || job?.status === 'FAILED') return 'FAILED'
      if (job?.status) return job.status
      return row.status as QuoteAnalysisStatus
    },
    [bg.jobs],
  )

  const filteredAnalyses = useMemo(() => {
    const q = compactSearch(searchQuery)
    if (!q) return analyses
    return analyses.filter((row) => {
      const status = effectiveStatus(row)
      const projectName = row.project_id ? projectsById[row.project_id]?.name : ''
      const totals = row.totals && typeof row.totals === 'object' ? row.totals : {}
      const batchLabel = typeof totals.batch_label === 'string' ? totals.batch_label : ''
      const blob = compactSearch(
        [
          analysisDisplayName(row),
          projectName,
          batchLabel,
          row.id,
          row.mode,
          status,
          QUOTE_STATUS_LABEL[status] ?? '',
          row.source_pdf_path ?? '',
        ].join(' '),
      )
      return blob.includes(q)
    })
  }, [analyses, searchQuery, effectiveStatus, projectsById])

  /** Agrupa lotes da mesma pasta; pastas sem lote ainda aparecem; órfãos ficam soltos. */
  const folderList = useMemo(() => {
    const groups = new Map<string, QuoteAnalysisRow[]>()
    const orphans: QuoteAnalysisRow[] = []
    for (const row of filteredAnalyses) {
      if (row.project_id) {
        const list = groups.get(row.project_id) ?? []
        list.push(row)
        groups.set(row.project_id, list)
      } else {
        orphans.push(row)
      }
    }
    // Pastas com PDF sem lote ativo — ainda devem aparecer para “Cotar mais páginas”.
    // Não lista pasta vazia “fantasma” (sem PDF e sem lote), nem duplicata do mesmo arquivo
    // quando já existe outra pasta com lotes.
    const sourceNamesWithBatches = new Set<string>()
    for (const [pid, batches] of groups) {
      const src = projectsById[pid]?.source_pdf_name?.trim()
      if (src && batches.length) sourceNamesWithBatches.add(src)
    }
    for (const [pid, project] of Object.entries(projectsById)) {
      if (groups.has(pid)) continue
      const src = project.source_pdf_name?.trim() || ''
      // Fantasma: criada no meio do upload e nunca recebeu lote/PDF.
      if (!project.pdf_url && !src) continue
      if (!project.pdf_url && src && sourceNamesWithBatches.has(src)) continue
      if (!project.pdf_url && !sourceNamesWithBatches.has(src)) {
        // Sem PDF e sem lotes em nenhuma pasta do mesmo arquivo → esconde (ruído).
        continue
      }
      const q = compactSearch(searchQuery)
      if (q) {
        const blob = compactSearch([project.name, project.source_pdf_name ?? '', pid].join(' '))
        if (!blob.includes(q)) continue
      }
      groups.set(pid, [])
    }
    for (const list of groups.values()) {
      list.sort((a, b) => {
        const aGhost = a.status === 'FAILED' && !a.source_pdf_path ? 1 : 0
        const bGhost = b.status === 'FAILED' && !b.source_pdf_path ? 1 : 0
        if (aGhost !== bGhost) return aGhost - bGhost
        return a.created_at.localeCompare(b.created_at)
      })
    }
    const orderedGroups = [...groups.entries()].sort((a, b) => {
      const pa = projectsById[a[0]]?.updated_at ?? a[1][a[1].length - 1]?.created_at ?? ''
      const pb = projectsById[b[0]]?.updated_at ?? b[1][b[1].length - 1]?.created_at ?? ''
      return pb.localeCompare(pa)
    })
    return { orderedGroups, orphans }
  }, [filteredAnalyses, projectsById, searchQuery])

  const continueProject = continueProjectId ? projectsById[continueProjectId] : null

  const openAudit = (analysisId: string) => {
    setActiveAnalysisId(analysisId)
    setShowUpload(false)
    setContinueProjectId(null)
    setPagePickerOpen(false)
    const next = new URLSearchParams(searchParams)
    next.set('audit', analysisId)
    setSearchParams(next, { replace: true })
  }

  /** Abre a conferência — inclusive durante extração/auditoria, para ver o passo a passo ao vivo. */
  const tryOpenAudit = async (row: QuoteAnalysisRow) => {
    const status = effectiveStatus(row)
    if (status === 'FAILED') {
      toast.message('Abrindo análise com falha', {
        description: row.error_message || 'Use Retomar ou Recomeçar do zero se precisar.',
      })
      openAudit(row.id)
      return
    }
    if (status === 'NEEDS_REVIEW') {
      toast.message('Abrindo análise para revisão manual', {
        description: 'Circuit breaker pediu conferência — confira o banner de alertas.',
      })
      openAudit(row.id)
      return
    }
    if (isActivelyProcessing(status)) {
      toast.message('Acompanhando a leitura em tempo real', {
        description: 'Você verá página a página, módulos encontrados e o console da IA.',
      })
      openAudit(row.id)
      return
    }
    if (status === 'COMPLETED') {
      openAudit(row.id)
      return
    }

    // Status inesperado na lista: reconsulta o banco e tenta de novo
    setListLoading(true)
    const { data } = await listQuoteAnalyses(companyId)
    setListLoading(false)
    if (data.length) setAnalyses(data)
    const fresh = data.find((a) => a.id === row.id)
    const freshStatus = (fresh?.status ?? status) as QuoteAnalysisStatus
    if (freshStatus === 'FAILED') {
      toast.message('Abrindo análise com falha', {
        description: fresh?.error_message || row.error_message || 'Use Retomar se precisar.',
      })
      openAudit(row.id)
      return
    }
    if (
      freshStatus === 'COMPLETED' ||
      freshStatus === 'NEEDS_REVIEW' ||
      isActivelyProcessing(freshStatus)
    ) {
      openAudit(row.id)
      return
    }
    toast.message('Orçamento ainda não está pronto', {
      description: 'Clique em Atualizar daqui a pouco ou aguarde o processamento.',
    })
  }

  const backToList = () => {
    setActiveAnalysisId(null)
    setShowUpload(false)
    setContinueProjectId(null)
    setPagePickerOpen(false)
    const next = new URLSearchParams(searchParams)
    next.delete('audit')
    next.delete('popout')
    setSearchParams(next, { replace: true })
    void refreshList()
  }

  const startMorePages = (projectId: string) => {
    setShowUpload(false)
    setActiveAnalysisId(null)
    setContinueProjectId(projectId)
    setPagePickerOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('audit')
    setSearchParams(next, { replace: true })
    // Garante pdf_url fresco (evita cair no upload se o mapa estiver defasado).
    void (async () => {
      const { data } = await getQuoteProject(projectId)
      if (data) {
        setProjectsById((prev) => ({ ...prev, [projectId]: data }))
        if (!data.pdf_url) {
          toast.error('Esta pasta ainda não tem PDF permanente. Envie o arquivo em “Novo orçamento”.')
          setPagePickerOpen(false)
          setContinueProjectId(null)
        }
      }
    })()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const projectId = deleteTarget.project_id
    const { error } = await deleteQuoteAnalysis(deleteTarget)
    if (error) {
      setDeleting(false)
      toast.error(error)
      return
    }
    if (projectId) {
      await refreshQuoteProjectFolderSnapshot(projectId)
    }
    setDeleting(false)
    toast.success('Orçamento excluído.')
    setDeleteTarget(null)
    setAnalyses((prev) => prev.filter((a) => a.id !== deleteTarget.id))
    if (projectId) {
      const { data } = await getQuoteProject(projectId)
      if (data) {
        setProjectsById((prev) => ({ ...prev, [projectId]: data }))
      }
    }
  }

  const confirmRemoveBudgetedPages = async () => {
    if (!removePagesTarget) return
    setDeleting(true)
    const { projectId, pages } = removePagesTarget
    const result = await removeBudgetedPagesFromProject(projectId, pages)
    setDeleting(false)
    if (!result.ok) {
      toast.error(result.error || 'Não foi possível apagar a cotação dessas páginas.')
      return
    }
    const removedLabel = formatPageRanges(result.removedPages.length ? result.removedPages : pages)
    toast.success(
      result.deletedBatches > 0
        ? `Cotação apagada (${removedLabel}) — ${result.deletedBatches} lote(s) removido(s).`
        : `Páginas ${removedLabel} deixaram de contar como orçadas.`,
    )
    setRemovePagesTarget(null)
    const { data } = await getQuoteProject(projectId)
    if (data) {
      setProjectsById((prev) => ({ ...prev, [projectId]: data }))
    }
    await refreshList()
  }

  const confirmDeleteFolder = async () => {
    if (!deleteFolderTarget || !companyId) return
    setDeleting(true)
    const folderId = deleteFolderTarget.id
    const { error, deletedBatches } = await deleteQuoteProject({
      projectId: folderId,
      companyId,
    })
    setDeleting(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(
      deletedBatches
        ? `Pasta excluída (${deletedBatches} lote${deletedBatches === 1 ? '' : 's'}).`
        : 'Pasta excluída.',
    )
    setDeleteFolderTarget(null)
    if (continueProjectId === folderId) {
      setContinueProjectId(null)
      setPagePickerOpen(false)
    }
    setProjectsById((prev) => {
      const next = { ...prev }
      delete next[folderId]
      return next
    })
    setAnalyses((prev) => prev.filter((a) => a.project_id !== folderId))
    void refreshList()
  }

  if (activeAnalysisId && companyId) {
    const activeRow = analyses.find((a) => a.id === activeAnalysisId)
    return (
      <div
        className={cn(
          'flex w-full flex-1 flex-col overflow-x-hidden overflow-y-visible bg-[#f7f4ef]',
          isPopout ? 'min-h-screen p-2 sm:p-3' : 'px-2 py-2 sm:px-3 sm:py-2.5 md:px-4',
        )}
      >
        <AuditWorkspace
          analysisId={activeAnalysisId}
          companyId={companyId}
          projectId={activeRow?.project_id ?? null}
          onBack={isPopout ? undefined : backToList}
          onOpenBatch={(id) => openAudit(id)}
        />
      </div>
    )
  }

  return (
    <div
      className="orcamentos-ia-shell relative isolate min-h-[calc(100vh-4rem)] overflow-x-hidden overflow-y-visible bg-[var(--cc-paper,#eef1f4)]"
      style={{ ...CORTE_CLAUDE_CSS_VARS } as CSSProperties}
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <OrcamentosIaShaderBackdrop />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(165deg, rgba(15,20,25,0.55) 0%, rgba(238,241,244,0.35) 42%, rgba(238,241,244,0.88) 100%)',
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 pb-28 sm:gap-10 sm:px-6 sm:py-12 sm:pb-32">
        <header className="oi-hero flex min-h-[min(52vh,420px)] flex-col justify-end gap-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="space-y-4">
            <p
              className="text-5xl leading-[0.9] tracking-[0.02em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)] sm:text-6xl md:text-7xl"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Garbo precificação
            </p>
            <p
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#0066FF]"
              style={{ fontFamily: 'Raleway, sans-serif' }}
            >
              <BrainCircuit className="h-4 w-4" />
              GARBO · BOM fabril
            </p>
            <h1
              className="max-w-2xl text-2xl leading-snug text-[var(--cc-ink)] sm:text-3xl"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Do croqui à lista exata de chapas, fitas e ferragens — sem preço por metro quadrado de
              fachada.
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="gap-2 border-0 bg-[#0066FF] text-white shadow-md hover:bg-[#0052cc]"
              onClick={() => {
                setContinueProjectId(null)
                setShowUpload((v) => !v)
              }}
              disabled={!companyId}
            >
              <FilePlus2 className="h-4 w-4" />
              {showUpload ? 'Ocultar upload' : 'Novo orçamento'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300/80 bg-white/90 text-slate-800 backdrop-blur-sm hover:bg-white"
              onClick={() => setInventoryOpen(true)}
              disabled={!companyId}
            >
              <Package className="h-4 w-4" />
              Preços & Estoque
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300/80 bg-white/90 text-slate-800 backdrop-blur-sm hover:bg-white"
              onClick={() => setStandardsOpen(true)}
              disabled={!companyId}
            >
              <Settings2 className="h-4 w-4" />
              Preferências construtivas
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300/80 bg-white/90 text-slate-800 backdrop-blur-sm hover:bg-white"
              onClick={() => setMemoriesOpen(true)}
              disabled={!companyId}
            >
              <Brain className="h-4 w-4" />
              Memórias
            </Button>
          </div>
        </header>

        {!companyId ? (
          <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Empresa não carregada. Recarregue a página ou verifique o contexto da CRM.
          </p>
        ) : (
          <>
            <div className="relative animate-in fade-in duration-500">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome do PDF, status, modo ou ID…"
                className="h-12 border-slate-300 bg-white pl-9 text-slate-900 placeholder:text-slate-400 shadow-sm"
                aria-label="Buscar orçamentos"
              />
            </div>

            {showUpload && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <h2
                  className="mb-4 text-xl tracking-wide text-slate-900"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  Novo orçamento
                </h2>
                <PdfUploadArea
                  companyId={companyId}
                  userId={user?.id}
                  onFolderReady={() => {
                    void refreshList()
                  }}
                  onAnalysisCreated={() => {
                    void refreshList()
                  }}
                  onAnalysisCompleted={(id) => {
                    void refreshList()
                    openAudit(id)
                  }}
                />
              </section>
            )}

            <Dialog
              open={pagePickerOpen}
              onOpenChange={(open) => {
                setPagePickerOpen(open)
                if (!open) setContinueProjectId(null)
              }}
            >
              <DialogContent className="flex max-h-[92vh] w-[min(96vw,1100px)] !max-w-5xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
                <DialogHeader className="shrink-0 space-y-1 text-left">
                  <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <FolderKanban className="h-5 w-5 text-[#0066FF]" />
                    Cotar mais páginas
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Pasta{' '}
                    <span className="font-medium text-foreground">
                      {continueProject?.name || 'projeto'}
                    </span>
                    {' — '}
                    veja a prévia, marque as páginas brancas e confirme. Sem reenviar o PDF.
                  </DialogDescription>
                </DialogHeader>
                {continueProjectId && continueProject?.pdf_url ? (
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <PageGridSelector
                      projectId={continueProjectId}
                      companyId={companyId}
                      pdfUrl={continueProject.pdf_url}
                      pageCount={
                        continueProject.page_count && continueProject.page_count > 0
                          ? continueProject.page_count
                          : Math.max(...(continueProject.budgeted_pages || [0]), 1)
                      }
                      budgetedPages={continueProject.budgeted_pages || []}
                      batchLabels={(() => {
                        const labels: Record<number, string> = {}
                        for (const row of analyses.filter(
                          (a) => a.project_id === continueProjectId,
                        )) {
                          const t =
                            row.totals && typeof row.totals === 'object'
                              ? (row.totals as Record<string, unknown>)
                              : {}
                          const label =
                            typeof t.batch_label === 'string'
                              ? t.batch_label
                              : row.id.slice(0, 8)
                          const ranges = Array.isArray(t.page_ranges)
                            ? (t.page_ranges as unknown[]).filter(
                                (n): n is number => typeof n === 'number',
                              )
                            : []
                          for (const p of ranges) labels[p] = label
                        }
                        return labels
                      })()}
                      onCancel={() => {
                        setPagePickerOpen(false)
                        setContinueProjectId(null)
                      }}
                      onRemoveBudgeted={(pages) => {
                        if (!continueProjectId || !pages.length) return
                        setRemovePagesTarget({ projectId: continueProjectId, pages })
                      }}
                      onConfirm={(pages) => {
                        void (async () => {
                          const id = await bg.startQuoteAnalysisFromProject({
                            companyId,
                            projectId: continueProjectId,
                            pageNumbers: pages,
                            userId: user?.id,
                            mode: 'max',
                          })
                          if (id) {
                            setPagePickerOpen(false)
                            setContinueProjectId(null)
                            void refreshList()
                            openAudit(id)
                          }
                        })()
                      }}
                    />
                  </div>
                ) : null}
              </DialogContent>
            </Dialog>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-2">
                <h2
                  className="text-xl tracking-wide text-slate-900"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  Pastas de precificação
                  {searchQuery.trim() ? (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({filteredAnalyses.length} de {analyses.length})
                    </span>
                  ) : null}
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => void refreshList()}
                  disabled={listLoading}
                >
                  Atualizar
                </Button>
              </div>

              {listLoading && analyses.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">Carregando…</p>
              ) : analyses.length === 0 ? (
                <div className="space-y-3 py-10 text-center">
                  <p className="text-sm text-slate-600">Nenhuma pasta ainda.</p>
                  <Button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="gap-2 bg-[#0066FF] text-white hover:bg-[#0052cc]"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    Criar a primeira
                  </Button>
                </div>
              ) : filteredAnalyses.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-600">
                  Nenhum orçamento encontrado para “{searchQuery.trim()}”.
                </p>
              ) : (
                <ul className="space-y-4">
                  {folderList.orderedGroups.map(([projectId, batches], groupIdx) => {
                    const project = projectsById[projectId]
                    const coreBatches = batches.filter(
                      (r) => !(r.status === 'FAILED' && !r.source_pdf_path),
                    )
                    const ghostBatches = batches.filter(
                      (r) => r.status === 'FAILED' && !r.source_pdf_path,
                    )
                    const rows = coreBatches.length ? coreBatches : batches
                    const budgetedN = project?.budgeted_pages?.length ?? 0
                    const pageTotal = project?.page_count ?? null
                    const folderTotals =
                      project?.totals && typeof project.totals === 'object'
                        ? project.totals
                        : {}
                    const folderSale =
                      typeof folderTotals.sale_price === 'number'
                        ? folderTotals.sale_price
                        : null

                    const renderBatchRow = (row: QuoteAnalysisRow, idx: number) => {
                      const status = effectiveStatus(row)
                      const bgJob = bg.jobs.find((j) => j.analysisId === row.id)
                      const isSelfHeal = bgJob?.pipelineStage === 'self_heal'
                      const label = isSelfHeal
                        ? QUOTE_STATUS_LABEL.AUDITING_REVISION
                        : (QUOTE_STATUS_LABEL[status] ?? status)
                      const totals =
                        row.totals && typeof row.totals === 'object'
                          ? (row.totals as Record<string, unknown>)
                          : {}
                      const batchLabel =
                        typeof totals.batch_label === 'string' ? totals.batch_label : null
                      const liveDetail =
                        (isSelfHeal && typeof bgJob?.pipelineDetail === 'string'
                          ? bgJob.pipelineDetail
                          : null) ||
                        (typeof bgJob?.pipelineDetail === 'string'
                          ? bgJob.pipelineDetail
                          : null) ||
                        (typeof totals.pipeline_detail === 'string'
                          ? totals.pipeline_detail
                          : null)
                      const isBusy = isActivelyProcessing(status)
                      const orphanedPricing =
                        isBusy &&
                        !bgJob?.runnerActive &&
                        (Boolean(bgJob?.needsResume) || isReadyForClientPricing(totals))
                      const canResume =
                        (status === 'FAILED' || orphanedPricing) &&
                        (Boolean(row.source_pdf_path) || Boolean(project?.pdf_url))
                      const canRestartFromZero =
                        status === 'FAILED' ||
                        status === 'NEEDS_REVIEW' ||
                        status === 'COMPLETED' ||
                        isBusy
                      const openLabel = canResume
                        ? 'Retomar'
                        : isBusy
                          ? 'Acompanhar'
                          : status === 'FAILED'
                            ? 'Ver falha'
                            : 'Abrir'
                      const name = batchLabel
                        ? `Lote págs. ${batchLabel}`
                        : `Lote ${row.id.slice(0, 8)}`
                      const isResuming = resumingId === row.id
                      const isCancelling = cancellingId === row.id
                      const showLiveProgress =
                        isBusy ||
                        Boolean(bgJob?.runnerActive) ||
                        isResuming ||
                        (bgJob != null &&
                          !bgJob.needsResume &&
                          status !== 'COMPLETED' &&
                          status !== 'FAILED')

                      return (
                        <li
                          key={row.id}
                          className="flex flex-col gap-2 rounded-lg border border-slate-200/90 bg-white px-3 py-2.5"
                          style={{
                            animationDelay: `${Math.min(groupIdx + idx, 8) * 40}ms`,
                          }}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 space-y-0.5">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {name}
                            </p>
                            <p className="font-mono text-[11px] tabular-nums text-slate-500">
                              {format(new Date(row.created_at), "dd/MM/yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })}
                              {' · '}
                              Modo {row.mode === 'max' ? 'Max' : 'Pro'}
                            </p>
                            {liveDetail ? (
                              <p className="line-clamp-2 text-[11px] text-[#0066FF]/90">
                                {liveDetail}
                              </p>
                            ) : null}
                            {status === 'FAILED' && row.error_message ? (
                              <p className="line-clamp-2 text-[11px] text-red-700/90">
                                {row.error_message}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              className={cn(
                                'border-0 text-[10px] font-semibold',
                                status === 'COMPLETED' && 'bg-[#0066FF] text-white',
                                status === 'NEEDS_REVIEW' && 'bg-amber-500 text-white',
                                status === 'FAILED' && 'bg-red-600 text-white',
                                status !== 'COMPLETED' &&
                                  status !== 'FAILED' &&
                                  status !== 'NEEDS_REVIEW' &&
                                  'bg-slate-200 text-slate-700',
                              )}
                            >
                              {label}
                            </Badge>
                            {canResume ? (
                              <Button
                                type="button"
                                size="sm"
                                className="gap-1.5 bg-[#0066FF] text-white hover:bg-[#0052cc]"
                                disabled={isResuming || !companyId}
                                onClick={() => {
                                  setResumingId(row.id)
                                  void refreshList()
                                  bg.requestExpand(row.id)
                                  void bg.resumeQuoteAnalysis(row.id, companyId).finally(() => {
                                    setResumingId(null)
                                    void refreshList()
                                  })
                                }}
                              >
                                <RefreshCw
                                  className={cn('h-3.5 w-3.5', isResuming && 'animate-spin')}
                                />
                                {isResuming ? 'Retomando…' : 'Retomar'}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                className={cn(
                                  'gap-1.5',
                                  isBusy ||
                                    status === 'COMPLETED' ||
                                    status === 'NEEDS_REVIEW'
                                    ? 'bg-[#0066FF] text-white hover:bg-[#0052cc]'
                                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
                                )}
                                variant={
                                  isBusy ||
                                  status === 'COMPLETED' ||
                                  status === 'NEEDS_REVIEW'
                                    ? 'default'
                                    : 'outline'
                                }
                                onClick={() => {
                                  if (isBusy) {
                                    bg.requestExpand(row.id)
                                    void tryOpenAudit(row)
                                    return
                                  }
                                  void tryOpenAudit(row)
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {openLabel}
                              </Button>
                            )}
                            {isBusy ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5 border-red-500/40 text-red-700 hover:bg-red-50"
                                disabled={isCancelling || isResuming || !companyId}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      'Interromper a leitura deste PDF? O progresso parcial fica salvo para Retomar.',
                                    )
                                  ) {
                                    return
                                  }
                                  setCancellingId(row.id)
                                  void bg.cancelQuoteAnalysis(row.id).finally(() => {
                                    setCancellingId(null)
                                    void refreshList()
                                  })
                                }}
                              >
                                <Square
                                  className={cn(
                                    'h-3.5 w-3.5',
                                    isCancelling && 'animate-pulse',
                                  )}
                                />
                                {isCancelling ? 'Interrompendo…' : 'Interromper'}
                              </Button>
                            ) : null}
                            {canRestartFromZero ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5 border-amber-500/40 text-amber-800 hover:bg-amber-50"
                                disabled={isResuming || !companyId}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      'Recomeçar do ZERO? Apaga o progresso parcial e começa de novo.',
                                    )
                                  ) {
                                    return
                                  }
                                  setResumingId(row.id)
                                  void bg
                                    .restartQuoteAnalysisFromScratch(row.id, companyId)
                                    .finally(() => {
                                      setResumingId(null)
                                      void refreshList()
                                    })
                                }}
                              >
                                <RotateCcw
                                  className={cn('h-3.5 w-3.5', isResuming && 'animate-spin')}
                                />
                                {isResuming ? 'Recomeçando…' : 'Recomeçar'}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5 border-slate-300 bg-white text-red-700 hover:bg-red-50"
                              onClick={() => setDeleteTarget(row)}
                              aria-label={`Excluir ${name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          </div>
                          </div>
                          {showLiveProgress ? (
                            <div className="overflow-hidden rounded-xl border border-[#0066FF]/25 bg-[#f8fafc]">
                              <div className="border-b border-slate-200/80 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0066FF]">
                                  Passos da precificação · ao vivo
                                </p>
                              </div>
                              <AiThoughtConsole
                                status={status}
                                pipelineStage={
                                  bgJob?.pipelineStage ||
                                  (typeof totals.pipeline_stage === 'string'
                                    ? totals.pipeline_stage
                                    : null)
                                }
                                pipelineDetail={liveDetail}
                                thoughtLog={
                                  bgJob?.thoughtLog?.length
                                    ? bgJob.thoughtLog
                                    : Array.isArray(totals.thought_log)
                                      ? (totals.thought_log as ThoughtLogEntry[])
                                      : []
                                }
                                analysisId={row.id}
                                companyId={companyId}
                                projectId={
                                  row.project_id ||
                                  (typeof totals.project_id === 'string'
                                    ? totals.project_id
                                    : null) ||
                                  (typeof bgJob?.totalsSnapshot?.project_id === 'string'
                                    ? bgJob.totalsSnapshot.project_id
                                    : null)
                                }
                                pagesProcessed={
                                  bgJob?.pagesProcessed ??
                                  (typeof totals.pages_processed === 'number'
                                    ? totals.pages_processed
                                    : null)
                                }
                                totals={(() => {
                                  const snap =
                                    bgJob?.totalsSnapshot &&
                                    typeof bgJob.totalsSnapshot === 'object'
                                      ? bgJob.totalsSnapshot
                                      : null
                                  if (!snap) return totals
                                  const rowPaths = Array.isArray(totals.page_paths)
                                    ? totals.page_paths.length
                                    : 0
                                  const snapPaths = Array.isArray(snap.page_paths)
                                    ? snap.page_paths.length
                                    : 0
                                  return {
                                    ...totals,
                                    ...snap,
                                    page_paths:
                                      rowPaths >= snapPaths
                                        ? totals.page_paths
                                        : snap.page_paths,
                                    page_ranges:
                                      totals.page_ranges ?? snap.page_ranges,
                                    project_id:
                                      snap.project_id ||
                                      totals.project_id ||
                                      row.project_id,
                                  }
                                })()}
                                errorMessage={status === 'FAILED' ? row.error_message : null}
                                density="workshop"
                              />
                            </div>
                          ) : null}
                        </li>
                      )
                    }

                    return (
                      <li
                        key={`folder-${projectId}`}
                        className="overflow-hidden rounded-2xl border border-[#0066FF]/30 bg-gradient-to-b from-[#0066FF]/[0.07] to-white shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#0066FF]/15 px-3 py-3 sm:px-4">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0066FF]/12 text-[#0066FF]">
                              <FolderKanban className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-sm font-semibold text-slate-900 sm:text-base">
                                {project?.name ||
                                  (rows[0] ? analysisDisplayName(rows[0]) : 'Pasta do projeto')}
                              </p>
                              <div className="flex flex-wrap gap-1.5 text-[11px]">
                                <Badge variant="secondary" className="font-normal">
                                  Pasta
                                </Badge>
                                {pageTotal != null ? (
                                  <Badge
                                    variant="outline"
                                    className="border-[#0066FF]/35 font-normal text-[#0066FF]"
                                  >
                                    {budgetedN}/{pageTotal} págs. orçadas
                                  </Badge>
                                ) : budgetedN > 0 ? (
                                  <Badge variant="outline" className="font-normal">
                                    {budgetedN} pág. orçada(s)
                                  </Badge>
                                ) : null}
                                <Badge variant="outline" className="font-normal">
                                  {rows.length} lote{rows.length === 1 ? '' : 's'}
                                </Badge>
                                {folderSale != null && folderSale > 0 ? (
                                  <Badge variant="outline" className="font-semibold text-[#0066FF]">
                                    {formatBRL(folderSale)}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              className="gap-1.5 bg-[#0066FF] text-white hover:bg-[#0052cc]"
                              onClick={() => startMorePages(projectId)}
                            >
                              <FilePlus2 className="h-3.5 w-3.5" />
                              Cotar mais páginas
                            </Button>
                            {project ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5 border-slate-300 bg-white text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteFolderTarget(project)}
                                aria-label={`Excluir pasta ${project.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Excluir pasta
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <ul className="space-y-2 px-3 py-3 sm:px-4">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            Lotes nesta pasta
                          </p>
                          {rows.length === 0 ? (
                            <li className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 py-3 text-xs text-slate-600">
                              Ainda não há lote nesta pasta. Use{' '}
                              <span className="font-medium text-[#0066FF]">Cotar mais páginas</span>{' '}
                              para escolher as páginas na grade com prévia.
                            </li>
                          ) : (
                            rows.map((row, idx) => renderBatchRow(row, idx))
                          )}
                          {ghostBatches.length > 0 && coreBatches.length > 0 ? (
                            <details className="rounded-lg border border-dashed border-slate-200 px-2 py-1.5">
                              <summary className="cursor-pointer text-[11px] text-slate-500">
                                {ghostBatches.length} tentativa(s) sem PDF (ocultas)
                              </summary>
                              <ul className="mt-2 space-y-2">
                                {ghostBatches.map((row, idx) => renderBatchRow(row, idx + 50))}
                              </ul>
                            </details>
                          ) : null}
                        </ul>
                      </li>
                    )
                  })}

                  {folderList.orphans.map((row, idx) => {
                    const status = effectiveStatus(row)
                    const label = QUOTE_STATUS_LABEL[status] ?? status
                    const isBusy = isActivelyProcessing(status)
                    return (
                      <li
                        key={row.id}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-[#fafaf8] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                        style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {analysisDisplayName(row)}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500">
                            {format(new Date(row.created_at), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                            {' · '}
                            Modo {row.mode === 'max' ? 'Max' : 'Pro'}
                            {' · '}
                            sem pasta
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={cn(
                              'border-0 text-[10px] font-semibold',
                              status === 'COMPLETED' && 'bg-[#0066FF] text-white',
                              status === 'NEEDS_REVIEW' && 'bg-amber-500 text-white',
                              status === 'FAILED' && 'bg-red-600 text-white',
                              !['COMPLETED', 'FAILED', 'NEEDS_REVIEW'].includes(status) &&
                                'bg-slate-200 text-slate-700',
                            )}
                          >
                            {label}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1.5 bg-[#0066FF] text-white hover:bg-[#0052cc]"
                            onClick={() => void tryOpenAudit(row)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {isBusy ? 'Acompanhar' : 'Abrir'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-red-700"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      <CompanyStandardsModal
        open={standardsOpen}
        onOpenChange={setStandardsOpen}
        companyId={companyId}
      />

      <InventoryManagerModal
        open={inventoryOpen}
        onOpenChange={setInventoryOpen}
        companyId={companyId}
      />
      <CompanyMemoriesModal
        open={memoriesOpen}
        onOpenChange={setMemoriesOpen}
        companyId={companyId}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${analysisDisplayName(deleteTarget)}” será removido de forma permanente, com PDF, páginas e lista de materiais.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteFolderTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteFolderTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta pasta?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFolderTarget ? (
                <>
                  A pasta{' '}
                  <span className="font-medium text-foreground">
                    “{deleteFolderTarget.name}”
                  </span>{' '}
                  será apagada de forma permanente: PDF, miniaturas, lotes e preços. Não dá para
                  desfazer.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void confirmDeleteFolder()
              }}
            >
              {deleting ? 'Excluindo…' : 'Excluir pasta'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(removePagesTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setRemovePagesTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar cotação dessas páginas?</AlertDialogTitle>
            <AlertDialogDescription>
              {removePagesTarget ? (
                <>
                  As páginas{' '}
                  <span className="font-medium text-foreground">
                    {formatPageRanges(removePagesTarget.pages)}
                  </span>{' '}
                  deixam de contar como orçadas. O lote que as cobre (materiais e preço) é apagado
                  por completo — não dá para desfazer.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void confirmRemoveBudgetedPages()
              }}
            >
              {deleting ? 'Apagando…' : 'Apagar cotação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
