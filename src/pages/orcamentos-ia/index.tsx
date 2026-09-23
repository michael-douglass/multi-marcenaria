import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Brain, BrainCircuit, Eye, FilePlus2, Package, Search, Settings2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useEmpresa } from '@/contexts/EmpresaContext'
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

  const filteredAnalyses = useMemo(() => {
    const q = compactSearch(searchQuery)
    if (!q) return analyses
    return analyses.filter((row) => {
      const blob = compactSearch(
        [
          analysisDisplayName(row),
          row.id,
          row.mode,
          row.status,
          QUOTE_STATUS_LABEL[row.status as QuoteAnalysisStatus] ?? '',
          row.source_pdf_path ?? '',
        ].join(' '),
      )
      return blob.includes(q)
    })
  }, [analyses, searchQuery])

  const openAudit = (analysisId: string) => {
    setActiveAnalysisId(analysisId)
    setShowUpload(false)
    const next = new URLSearchParams(searchParams)
    next.set('audit', analysisId)
    setSearchParams(next, { replace: true })
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
          'w-full bg-[#f7f4ef]',
          isPopout ? 'min-h-screen p-3' : 'px-3 py-4 sm:px-4',
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
      className="orcamentos-ia-shell relative isolate min-h-[calc(100vh-4rem)] overflow-x-hidden overflow-y-visible bg-[#f7f4ef]"
      style={
        {
          '--oi-accent': '#0066FF',
          '--oi-bg': '#f7f4ef',
          '--oi-ink': '#1a2332',
          '--oi-muted': '#5c6570',
          '--oi-card': '#ffffff',
        } as CSSProperties
      }
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <OrcamentosIaShaderBackdrop />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(247,244,239,0.55) 0%, rgba(247,244,239,0.82) 45%, rgba(247,244,239,0.94) 100%)',
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 pb-28 sm:gap-8 sm:px-6 sm:py-10 sm:pb-32">
        <header className="oi-hero flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="space-y-3">
            <p
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#0066FF]"
              style={{ fontFamily: 'Raleway, sans-serif' }}
            >
              <BrainCircuit className="h-4 w-4" />
              Planilha 4.0 · GARBO
            </p>
            <h1
              className="text-4xl leading-[0.95] tracking-wide text-[var(--oi-ink)] sm:text-5xl md:text-6xl"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              Orçamentos IA
            </h1>
            <p
              className="max-w-xl text-base text-[var(--oi-muted)] sm:text-lg"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Do PDF à lista de compras — com preços, auditoria visual e memória da oficina.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="gap-2 border-0 bg-[#0066FF] text-white shadow-md hover:bg-[#0052cc]"
              onClick={() => setInventoryOpen(true)}
              disabled={!companyId}
            >
              <Package className="h-4 w-4" />
              Tabela de Preços & Estoque
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setStandardsOpen(true)}
              disabled={!companyId}
            >
              <Settings2 className="h-4 w-4" />
              Central de Informações
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setMemoriesOpen(true)}
              disabled={!companyId}
            >
              <Brain className="h-4 w-4" />
              Treinamento / Memórias
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setShowUpload((v) => !v)}
              disabled={!companyId}
            >
              <FilePlus2 className="h-4 w-4" />
              {showUpload ? 'Ocultar upload' : 'Novo orçamento'}
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
                    const status = row.status as QuoteAnalysisStatus
                    const label = QUOTE_STATUS_LABEL[status] ?? row.status
                    const canOpen = status === 'COMPLETED'
                    const name = analysisDisplayName(row)
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
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={cn(
                              'border-0 text-[10px] font-semibold',
                              status === 'COMPLETED' && 'bg-[#0066FF] text-white',
                              status === 'FAILED' && 'bg-red-600 text-white',
                              status !== 'COMPLETED' &&
                                status !== 'FAILED' &&
                                'bg-slate-200 text-slate-700',
                            )}
                          >
                            {label}
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            className={cn(
                              'gap-1.5',
                              canOpen
                                ? 'bg-[#0066FF] text-white hover:bg-[#0052cc]'
                                : 'border-slate-300 bg-white text-slate-400',
                            )}
                            variant={canOpen ? 'default' : 'outline'}
                            disabled={!canOpen}
                            onClick={() => openAudit(row.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Abrir
                          </Button>
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
