import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Brain, BrainCircuit, Eye, FilePlus2, Package, RefreshCw, Search, Settings2, Trash2 } from 'lucide-react'
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
import { PdfUploadArea } from '@/components/orcamentos-ia/PdfUploadArea'
import { CompanyStandardsModal } from '@/components/orcamentos-ia/CompanyStandardsModal'
import { CompanyMemoriesModal } from '@/components/orcamentos-ia/CompanyMemoriesModal'
import { InventoryManagerModal } from '@/components/orcamentos-ia/InventoryManagerModal'
import { AuditWorkspace } from '@/components/orcamentos-ia/AuditWorkspace'
import { OrcamentosIaShaderBackdrop } from '@/components/orcamentos-ia/OrcamentosIaShaderBackdrop'
import { cn } from '@/lib/utils'
import {
  deleteQuoteAnalysis,
  listQuoteAnalyses,
  QUOTE_STATUS_LABEL,
  type QuoteAnalysisRow,
  type QuoteAnalysisStatus,
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
  const [analyses, setAnalyses] = useState<QuoteAnalysisRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<QuoteAnalysisRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resumingId, setResumingId] = useState<string | null>(null)
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(
    () => searchParams.get('audit'),
  )

  const isPopout = searchParams.get('popout') === '1'

  const refreshList = useCallback(async () => {
    if (!companyId) return
    setListLoading(true)
    const { data, error } = await listQuoteAnalyses(companyId)
    if (error) toast.error(error)
    setAnalyses(data)
    setListLoading(false)
  }, [companyId])

  useEffect(() => {
    const fromUrl = searchParams.get('audit')
    if (fromUrl) setActiveAnalysisId(fromUrl)
  }, [searchParams])

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

  /** Enquanto houver item ainda processando, reconsulta o banco a cada 4s. */
  useEffect(() => {
    if (activeAnalysisId) return
    const busy = analyses.some((a) => !isTerminalStatus(a.status as QuoteAnalysisStatus))
    if (!busy) return
    const id = window.setInterval(() => {
      void refreshList()
    }, 4000)
    return () => window.clearInterval(id)
  }, [analyses, activeAnalysisId, refreshList])

  /** Status efetivo: banco + job em segundo plano (prioriza COMPLETED). */
  const effectiveStatus = useCallback(
    (row: QuoteAnalysisRow): QuoteAnalysisStatus => {
      const job = bg.jobs.find((j) => j.analysisId === row.id)
      if (row.status === 'COMPLETED' || job?.status === 'COMPLETED') return 'COMPLETED'
      if (row.status === 'NEEDS_REVIEW' || job?.status === 'NEEDS_REVIEW') return 'NEEDS_REVIEW'
      if (row.status === 'FAILED') return 'FAILED'
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
      const blob = compactSearch(
        [
          analysisDisplayName(row),
          row.id,
          row.mode,
          status,
          QUOTE_STATUS_LABEL[status] ?? '',
          row.source_pdf_path ?? '',
        ].join(' '),
      )
      return blob.includes(q)
    })
  }, [analyses, searchQuery, effectiveStatus])

  const openAudit = (analysisId: string) => {
    setActiveAnalysisId(analysisId)
    setShowUpload(false)
    const next = new URLSearchParams(searchParams)
    next.set('audit', analysisId)
    setSearchParams(next, { replace: true })
  }

  /** Reconsulta o status no banco antes de abrir — corrige lista desatualizada. */
  const tryOpenAudit = async (row: QuoteAnalysisRow) => {
    const status = effectiveStatus(row)
    if (status === 'COMPLETED') {
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
    if (status === 'FAILED') {
      toast.error('Esta análise falhou', {
        description: row.error_message || 'Use Retomar ou envie o PDF de novo.',
      })
      return
    }

    setListLoading(true)
    const { data } = await listQuoteAnalyses(companyId)
    setListLoading(false)
    if (data.length) setAnalyses(data)
    const fresh = data.find((a) => a.id === row.id)
    const freshStatus = (fresh?.status ?? status) as QuoteAnalysisStatus
    if (freshStatus === 'COMPLETED') {
      openAudit(row.id)
      return
    }
    if (freshStatus === 'NEEDS_REVIEW') {
      toast.message('Abrindo análise para revisão manual', {
        description: 'Circuit breaker pediu conferência — confira o banner de alertas.',
      })
      openAudit(row.id)
      return
    }
    if (isActivelyProcessing(freshStatus)) {
      toast.message('Ainda processando o PDF…', {
        description: 'O botão Abrir libera quando concluir ou quando pedir revisão manual.',
      })
      return
    }
    toast.message('Orçamento ainda não está pronto', {
      description: 'Clique em Atualizar daqui a pouco ou aguarde o processamento.',
    })
  }

  const backToList = () => {
    setActiveAnalysisId(null)
    setShowUpload(false)
    const next = new URLSearchParams(searchParams)
    next.delete('audit')
    next.delete('popout')
    setSearchParams(next, { replace: true })
    void refreshList()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await deleteQuoteAnalysis(deleteTarget)
    setDeleting(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Orçamento excluído.')
    setDeleteTarget(null)
    setAnalyses((prev) => prev.filter((a) => a.id !== deleteTarget.id))
  }

  if (activeAnalysisId && companyId) {
    return (
      <div
        className={cn(
          'flex min-h-0 w-full flex-1 flex-col bg-[#f7f4ef]',
          isPopout ? 'min-h-screen p-2 sm:p-3' : 'px-2 py-2 sm:px-3 sm:py-2.5 md:px-4',
        )}
      >
        <AuditWorkspace
          analysisId={activeAnalysisId}
          companyId={companyId}
          onBack={isPopout ? undefined : backToList}
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
              onClick={() => setShowUpload((v) => !v)}
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
                  onAnalysisCreated={() => void refreshList()}
                  onAnalysisCompleted={(id) => {
                    void refreshList()
                    openAudit(id)
                  }}
                />
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-2">
                <h2
                  className="text-xl tracking-wide text-slate-900"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  Fichas recentes
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
                  <p className="text-sm text-slate-600">Nenhum orçamento ainda.</p>
                  <Button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="gap-2 bg-[#0066FF] text-white hover:bg-[#0052cc]"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    Criar o primeiro
                  </Button>
                </div>
              ) : filteredAnalyses.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-600">
                  Nenhum orçamento encontrado para “{searchQuery.trim()}”.
                </p>
              ) : (
                <ul className="space-y-2">
                  {filteredAnalyses.map((row, idx) => {
                    const status = effectiveStatus(row)
                    const label = QUOTE_STATUS_LABEL[status] ?? status
                    const canOpen = status === 'COMPLETED' || status === 'NEEDS_REVIEW'
                    const canResume = status === 'FAILED'
                    const name = analysisDisplayName(row)
                    const isResuming = resumingId === row.id
                    return (
                      <li
                        key={row.id}
                        className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-[#fafaf8] px-3 py-3 transition-colors hover:border-[#0066FF]/40 hover:bg-[#0066FF]/5 sm:flex-row sm:items-center sm:justify-between sm:px-4"
                        style={{
                          animationDelay: `${Math.min(idx, 8) * 40}ms`,
                        }}
                      >
                        <div className="min-w-0 space-y-1">
                          <p
                            className="truncate text-sm font-semibold text-slate-900"
                            style={{ fontFamily: 'Raleway, sans-serif' }}
                          >
                            {name}
                          </p>
                          <p className="font-mono text-[11px] tabular-nums text-slate-500">
                            {format(new Date(row.created_at), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                            {' · '}
                            Modo {row.mode === 'max' ? 'Max' : 'Pro'}
                          </p>
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
                                void bg.resumeQuoteAnalysis(row.id, companyId).finally(() => {
                                  setResumingId(null)
                                  void refreshList()
                                })
                              }}
                            >
                              <RefreshCw className={cn('h-3.5 w-3.5', isResuming && 'animate-spin')} />
                              {isResuming ? 'Retomando…' : 'Retomar'}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              className={cn(
                                'gap-1.5',
                                canOpen
                                  ? 'bg-[#0066FF] text-white hover:bg-[#0052cc]'
                                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
                              )}
                              variant={canOpen ? 'default' : 'outline'}
                              disabled={listLoading && !canOpen}
                              title={
                                status === 'COMPLETED'
                                  ? 'Abrir conferência'
                                  : status === 'NEEDS_REVIEW'
                                    ? 'Abrir para revisão manual (circuit breaker)'
                                    : 'Verificar no servidor se já concluiu e abrir'
                              }
                              onClick={() => void tryOpenAudit(row)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Abrir
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-slate-300 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
                            onClick={() => setDeleteTarget(row)}
                            aria-label={`Excluir ${name}`}
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
    </div>
  )
}
