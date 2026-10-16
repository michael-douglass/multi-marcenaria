import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  ArrowLeft,
  Ban,
  Brain,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Box,
  FileText,
  Square,
  Tags,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { installPdfJsPolyfills } from '@/lib/map-polyfills'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs'
import {
  getSignedPdfUrl,
  getSignedQuotePageUrls,
  isVirtualHydratedId,
  loadQuoteAnalysisTree,
  pageIndexFromStoragePath,
  updateQuoteMaterial,
  type QuoteAnalysisDetail,
  type QuoteBoundingBox,
  type QuoteMaterialRow,
  type QuoteModuleRow,
} from '@/lib/orcamentos-ia/quote-tree'
import { ExplainCorrectionModal } from '@/components/orcamentos-ia/ExplainCorrectionModal'
import { AuditChatWidget } from '@/components/orcamentos-ia/AuditChatWidget'
import { CompanyMemoriesModal } from '@/components/orcamentos-ia/CompanyMemoriesModal'
import { AuditCockpit } from '@/components/orcamentos-ia/AuditCockpit'
import { PromptStudioModal } from '@/components/orcamentos-ia/PromptStudioModal'
import { RaioX3D } from '@/components/orcamentos-ia/RaioX3D'
import { ThoughtShaderCanvas } from '@/components/orcamentos-ia/ThoughtShaderCanvas'
import { QuotePresentationExportButton } from '@/components/orcamentos-ia/QuotePresentationExportButton'
import {
  PricingAdjustmentsButton,
  PricingAdjustmentsDialog,
} from '@/components/orcamentos-ia/PricingAdjustmentsDialog'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { listBomItemsForProject } from '@/lib/orcamentos-ia/bom-persist'
import {
  buildAtomicPieces,
  explodeFromExtractionModule,
  explodeModule,
  formatLabelsForPrint,
  inferTypology,
  type BomLine,
  type IndustrialLabel,
} from '@/lib/orcamentos-ia/bom-engine'
import { buildObservabilityBlocks } from '@/lib/orcamentos-ia/observability'
import { migrateLegacyPricingParams } from '@/lib/orcamentos-ia/migrate-modality'
import {
  CoverageSummary,
  MaterialRow,
  PriceReviewBanner,
  describeMaterial,
  formatQuantity,
  isBillableUnpriced,
  isUnpricedSheetAggregate,
  perUnitLabel,
} from '@/components/orcamentos-ia/audit-display'
import {
  reauditOrcamentosIaAnalysis,
  repersistQuoteAnalysisFromLastExtraction,
  reprocessOrcamentosIaPipeline,
} from '@/lib/orcamentos-ia/pipeline'
import {
  cancelOrcamentosIaAnalysis,
  formatAsyncPageProgress,
  getQuoteProject,
  listQuoteAnalysesForProject,
  type PipelineStageId,
  type QuoteAnalysisRow,
  type QuoteAnalysisStatus,
  type QuoteProjectRow,
  type ThoughtLogEntry,
} from '@/lib/orcamentos-ia/storage'
import { AiThoughtConsole } from '@/components/orcamentos-ia/AiThoughtConsole'
import {
  ProjectFolderTabs,
  type FolderViewMode,
} from '@/components/orcamentos-ia/ProjectFolderTabs'
import { formatPageRanges } from '@/lib/orcamentos-ia/page-ranges'
import { pageNumbersFromTotals } from '@/lib/orcamentos-ia/pdf-processor'
import type { CoverageReport } from '@/lib/orcamentos-ia/merge-extraction'
import {
  buildShoppingList,
  calculateQuotePricing,
  DEFAULT_PRICING_PARAMS,
  formatBRL,
  PRICING_MODALITY_HINT,
  PRICING_MODALITY_LABEL,
  repriceZeroMaterials,
  type PricingModality,
  type PricingParams,
} from '@/lib/orcamentos-ia/pricing'

installPdfJsPolyfills()

const PDF_DPI = 200
const PDF_SCALE = PDF_DPI / 72
const HIGHLIGHT = '#0066FF'
const POPOUT_CHANNEL = 'orcamentos-ia-audit-sync'

declare global {
  // eslint-disable-next-line no-var
  var pdfjsWorker: typeof import('pdfjs-dist/build/pdf.worker.min.mjs') | undefined
}

function pageNumberFromImagePath(path: string | null | undefined): number | null {
  return pageIndexFromStoragePath(path)
}

/**
 * Página canônica do móvel: path do Storage > page_number > bbox do módulo.
 * Não confia no bbox do item se discordar do móvel (IA às vezes marca peça em folha errada).
 */
function resolveModulePage(module: QuoteModuleRow): number | null {
  return (
    pageNumberFromImagePath(module.page_image_path) ??
    (module.page_number && module.page_number >= 1 ? module.page_number : null) ??
    (module.bounding_box?.page && module.bounding_box.page >= 1 ? module.bounding_box.page : null)
  )
}

function resolveSelectionPage(
  module: QuoteModuleRow,
  material?: QuoteMaterialRow | null,
): number | null {
  const modulePage = resolveModulePage(module)
  if (!material) return modulePage

  const materialPathPage = pageNumberFromImagePath(material.page_image_path)
  const materialBoxPage =
    material.bounding_box?.page && material.bounding_box.page >= 1
      ? material.bounding_box.page
      : null

  // Path do item alinhado ao móvel → ok; senão path do item se existir; senão só bbox se bater com o móvel
  if (materialPathPage && (!modulePage || materialPathPage === modulePage)) {
    return materialPathPage
  }
  if (materialBoxPage && (!modulePage || materialBoxPage === modulePage)) {
    return materialBoxPage
  }
  return modulePage ?? materialPathPage ?? materialBoxPage
}

function resolveSelectionBbox(
  module: QuoteModuleRow,
  material?: QuoteMaterialRow | null,
): QuoteBoundingBox | null {
  const modulePage = resolveModulePage(module)
  const materialBox = material?.bounding_box ?? null
  if (materialBox) {
    const boxPage = materialBox.page && materialBox.page >= 1 ? materialBox.page : null
    // Descarta bbox de item em página diferente do móvel (evita retângulo em folha aleatória)
    if (!modulePage || !boxPage || boxPage === modulePage) {
      return {
        ...materialBox,
        page: boxPage ?? modulePage ?? materialBox.page,
      }
    }
  }
  return module.bounding_box
}

/** Bbox genérico (0,0,0.5×0.5) — não serve para “ir ao móvel”; só a página. */
function isPlaceholderBbox(bbox: QuoteBoundingBox | null | undefined): boolean {
  if (!bbox) return true
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02
  return near(bbox.x, 0) && near(bbox.y, 0) && near(bbox.width, 0.5) && near(bbox.height, 0.5)
}

function ensurePdfWorker() {
  if (!globalThis.pdfjsWorker) globalThis.pdfjsWorker = pdfjsWorker
  GlobalWorkerOptions.workerPort = null
}

interface AuditWorkspaceProps {
  analysisId: string
  companyId: string
  /** Pasta quote_projects — se omitido, resolve via analysis.project_id. */
  projectId?: string | null
  onBack?: () => void
  /** Troca o lote ativo na URL/lista (histórico da pasta). */
  onOpenBatch?: (analysisId: string) => void
}

type Selection =
  | { kind: 'module'; module: QuoteModuleRow }
  | { kind: 'material'; material: QuoteMaterialRow; module: QuoteModuleRow }
  | null

export function AuditWorkspace({
  analysisId,
  companyId,
  projectId: projectIdProp = null,
  onBack,
  onOpenBatch,
}: AuditWorkspaceProps) {
  const { empresa } = useEmpresa()
  const [tree, setTree] = useState<QuoteAnalysisDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [folderProject, setFolderProject] = useState<QuoteProjectRow | null>(null)
  const [folderBatches, setFolderBatches] = useState<QuoteAnalysisRow[]>([])
  const [folderViewMode, setFolderViewMode] = useState<FolderViewMode>('history')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selection, setSelection] = useState<Selection>(null)
  const [expandedEnvs, setExpandedEnvs] = useState<Set<string>>(new Set())
  const [expandedMods, setExpandedMods] = useState<Set<string>>(new Set())
  const [explainOpen, setExplainOpen] = useState(false)
  const [explainContext, setExplainContext] = useState<string>('')
  const [editingMaterial, setEditingMaterial] = useState<QuoteMaterialRow | null>(null)
  const [editDraft, setEditDraft] = useState({ exact: '', full: '', price: '' })
  const [pricingParams, setPricingParams] = useState<PricingParams>(DEFAULT_PRICING_PARAMS)
  const [pricingAdjustOpen, setPricingAdjustOpen] = useState(false)
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reauditing, setReauditing] = useState(false)
  const [showOutOfScope, setShowOutOfScope] = useState(false)
  const [memoriesOpen, setMemoriesOpen] = useState(false)
  const [promptStudioOpen, setPromptStudioOpen] = useState(false)
  const [viewerMode, setViewerMode] = useState<'pdf' | 'xray'>('pdf')
  const [bomLines, setBomLines] = useState<BomLine[]>([])
  const [engineeringCot, setEngineeringCot] = useState('')
  const [pageThumbUrl, setPageThumbUrl] = useState<string | null>(null)
  /** true = tela grande mostra a PNG da página (miniatura ampliada); false = PDF. */
  const [preferPageImage, setPreferPageImage] = useState(false)
  /** Páginas JPEG já convertidas (clique no móvel → página certa sem depender do PDF). */
  const [pageImages, setPageImages] = useState<Array<{ index: number; path: string; url: string }>>(
    [],
  )
  const mainViewerRef = useRef<HTMLDivElement>(null)
  const mediaBoxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const pendingFocusRef = useRef<{ cx: number; cy: number; zoom: number } | null>(null)
  /** Evita disparar regravação duas vezes no mesmo lote (Strict Mode / reload). */
  const repersistAttemptedRef = useRef<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await loadQuoteAnalysisTree(analysisId)
    if (error || !data) {
      toast.error(error || 'Não foi possível carregar a análise.')
      setLoading(false)
      return
    }

    let treeData = data
    const flatMats = data.environments.flatMap((e) => e.modules.flatMap((m) => m.materials))
    const hasVirtualTree =
      flatMats.length > 0 && flatMats.every((m) => isVirtualHydratedId(m.id))

    // Extração existe, mas ambientes/materiais sumiram do banco → regrava preços de verdade.
    if (hasVirtualTree && repersistAttemptedRef.current !== analysisId) {
      repersistAttemptedRef.current = analysisId
      toast.message('Regravando lista e preços deste lote…', {
        description: 'Os itens estavam só em memória; isso corrige o alerta falso de “sem preço”.',
      })
      const repaired = await repersistQuoteAnalysisFromLastExtraction({
        analysisId,
        companyId: data.company_id,
      })
      if (repaired.ok) {
        toast.success(
          `Lista regravada${
            repaired.materialsSaved != null && repaired.materialsSaved > 0
              ? ` (${repaired.materialsSaved} itens)`
              : ''
          }.`,
        )
        const again = await loadQuoteAnalysisTree(analysisId)
        if (again.data) treeData = again.data
      } else {
        toast.error(repaired.error || 'Não foi possível regravar os preços deste lote.')
        repersistAttemptedRef.current = null
      }
    }

    const flatAfter = treeData.environments.flatMap((e) =>
      e.modules.flatMap((m) => m.materials),
    )
    const hasBillableZeros = flatAfter.some(isBillableUnpriced)
    const stillVirtual = flatAfter.some((m) => isVirtualHydratedId(m.id))

    if (hasBillableZeros && !stillVirtual) {
      const repriced = await repriceZeroMaterials({
        companyId: treeData.company_id,
        materials: flatAfter,
      })
      if (repriced.error) {
        toast.error(`Falha ao preencher preços zerados: ${repriced.error}`)
      } else if (repriced.updated > 0) {
        toast.message(
          `${repriced.updated} item(ns) com preço R$ 0,00 preenchidos (estoque → mercado → preço médio).`,
        )
        const byId = new Map(repriced.materials.map((m) => [m.id, m]))
        treeData = {
          ...treeData,
          environments: treeData.environments.map((env) => ({
            ...env,
            modules: env.modules.map((mod) => ({
              ...mod,
              materials: mod.materials.map((m) => byId.get(m.id) ?? m),
            })),
          })),
        }
      }
      const stillZero = treeData.environments
        .flatMap((e) => e.modules.flatMap((m) => m.materials))
        .filter(isBillableUnpriced)
      if (stillZero.length) {
        toast.warning(
          `${stillZero.length} item(ns) cobráveis ainda sem preço — confira o banner e use Reauditar ou edite o valor.`,
        )
      }
    }

    setTree(treeData)
    setExpandedEnvs(new Set(treeData.environments.map((e) => e.id)))
    setExpandedMods(
      new Set(treeData.environments.flatMap((e) => e.modules.map((m) => m.id))),
    )

    const totals =
      treeData.totals && typeof treeData.totals === 'object'
        ? (treeData.totals as Record<string, unknown>)
        : {}
    setEngineeringCot(typeof totals.engineering_cot === 'string' ? totals.engineering_cot : '')

    const migrated = migrateLegacyPricingParams(totals.pricing_params ?? totals.pricingParams)
    setPricingParams((prev) => ({ ...prev, ...migrated.params }))
    if (migrated.notice) toast.message(migrated.notice)

    const bom = await listBomItemsForProject(analysisId)
    if (bom.error) {
      // Tabela pode ainda não existir localmente — não bloqueia auditoria
      setBomLines([])
    } else {
      setBomLines(bom.data)
    }

    if (treeData.source_pdf_path) {
      const signed = await getSignedPdfUrl(treeData.source_pdf_path)
      if (signed.url) setPdfUrl(signed.url)
      else toast.error(signed.error || 'PDF não encontrado no Storage.')
    }

    const totalsPaths = Array.isArray(totals.page_paths)
      ? (totals.page_paths as unknown[]).filter((p): p is string => typeof p === 'string')
      : null
    const resolvedProjectId =
      projectIdProp ||
      treeData.project_id ||
      (typeof totals.project_id === 'string' ? totals.project_id : null)

    const pages = await getSignedQuotePageUrls(companyId, analysisId, 300, {
      projectId: resolvedProjectId,
      preferredPaths: totalsPaths,
    })
    if (!pages.error && pages.pages.length) {
      setPageImages(pages.pages)
      setPageCount((prev) => Math.max(prev, pages.pages.length))
      // Sem PDF ainda: já mostra a 1ª página convertida
      if (!treeData.source_pdf_path || pages.pages[0]) {
        setPageThumbUrl(pages.pages[0].url)
        setPreferPageImage(true)
      }
    }

    if (resolvedProjectId) {
      const [proj, batches] = await Promise.all([
        getQuoteProject(resolvedProjectId),
        listQuoteAnalysesForProject(resolvedProjectId),
      ])
      setFolderProject(proj.data)
      setFolderBatches(batches.data)
      if (batches.data.length > 1) setFolderViewMode('consolidated')
    } else {
      setFolderProject(null)
      setFolderBatches([])
    }

    setLoading(false)
  }, [analysisId, companyId, projectIdProp])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Atualiza progresso async (página X de Y) enquanto a cadeia Edge roda. */
  useEffect(() => {
    if (!tree) return
    const busy = !['COMPLETED', 'FAILED', 'NEEDS_REVIEW'].includes(String(tree.status || ''))
    if (!busy) return
    const timer = window.setInterval(() => {
      void (async () => {
        const { data } = await loadQuoteAnalysisTree(analysisId)
        if (data) setTree(data)
      })()
    }, 3000)
    return () => window.clearInterval(timer)
  }, [analysisId, tree?.status])

  useEffect(() => {
    const channel = new BroadcastChannel(POPOUT_CHANNEL)
    channelRef.current = channel
    channel.onmessage = (ev) => {
      const msg = ev.data as {
        type?: string
        analysisId?: string
        page?: number
        selectionId?: string
        zoom?: number
      }
      if (msg.analysisId !== analysisId) return
      if (msg.type === 'page' && msg.page) setPageNumber(msg.page)
      if (msg.type === 'zoom' && typeof msg.zoom === 'number') setZoom(msg.zoom)
      if (msg.type === 'select' && msg.selectionId && tree) {
        for (const env of tree.environments) {
          for (const mod of env.modules) {
            if (mod.id === msg.selectionId) {
              setSelection({ kind: 'module', module: mod })
              const page = resolveSelectionPage(mod)
              if (page) setPageNumber(page)
              return
            }
            const mat = mod.materials.find((m) => m.id === msg.selectionId)
            if (mat) {
              setSelection({ kind: 'material', material: mat, module: mod })
              const page = resolveSelectionPage(mod, mat)
              if (page) setPageNumber(page)
              return
            }
          }
        }
      }
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [analysisId, tree])

  const broadcast = useCallback(
    (payload: Record<string, unknown>) => {
      channelRef.current?.postMessage({ analysisId, ...payload })
    },
    [analysisId],
  )

  // Carrega PDF
  useEffect(() => {
    if (!pdfUrl) return
    let cancelled = false
    ensurePdfWorker()
    ;(async () => {
      const res = await fetch(pdfUrl)
      const bytes = new Uint8Array(await res.arrayBuffer())
      const pdf = await getDocument({
        data: bytes,
        disableFontFace: true,
        useSystemFonts: true,
      }).promise
      if (cancelled) {
        await pdf.destroy()
        return
      }
      pdfRef.current = pdf
      setPageCount((prev) => Math.max(prev, pdf.numPages))
    })().catch((err) => {
      // Páginas JPEG já cobrem a pré-visualização — PDF é só fallback.
      console.warn('[AuditWorkspace] PDF:', err)
    })
    return () => {
      cancelled = true
      void pdfRef.current?.destroy()
      pdfRef.current = null
    }
  }, [pdfUrl])

  const activeBbox = useMemo((): QuoteBoundingBox | null => {
    if (!selection) return null
    if (selection.kind === 'module') return selection.module.bounding_box
    return selection.material.bounding_box ?? selection.module.bounding_box
  }, [selection])

  const highlightBbox = useMemo((): QuoteBoundingBox | null => {
    if (!activeBbox || isPlaceholderBbox(activeBbox)) return null
    return activeBbox
  }, [activeBbox])

  const selectionLabel = useMemo(() => {
    if (!selection) return null
    if (selection.kind === 'module') return selection.module.name
    return `${selection.material.raw_name} · ${selection.module.name}`
  }, [selection])

  const selectionSummary = useMemo(() => {
    if (!selection) return undefined
    if (selection.kind === 'module') {
      return `Módulo "${selection.module.name}"`
    }
    return `Material "${selection.material.raw_name}" no módulo "${selection.module.name}" (cat=${selection.material.category}, qtd=${selection.material.exact_quantity}, preço=${selection.material.unit_price})`
  }, [selection])

  const applyMediaFocus = useCallback(() => {
    const pending = pendingFocusRef.current
    const box = mediaBoxRef.current
    if (!pending || !box) return
    const w = box.clientWidth
    const h = box.clientHeight
    if (w < 8 || h < 8) return
    setPan({
      x: (0.5 - pending.cx) * w * pending.zoom,
      y: (0.5 - pending.cy) * h * pending.zoom,
    })
    pendingFocusRef.current = null
  }, [])

  /** Leva a pré-visualização à página do móvel e enquadra a área marcada. */
  const focusSelectionOnViewer = useCallback(
    (opts: {
      page: number | null
      bbox: QuoteBoundingBox | null
      pageImagePath?: string | null
      /** Mantém Raio-X aberto (não força volta ao PDF). */
      preserveViewerMode?: boolean
    }) => {
      if (!opts.preserveViewerMode) {
        setViewerMode('pdf')
      }
      const pageFromPath = pageNumberFromImagePath(opts.pageImagePath)
      const page =
        (opts.page && opts.page >= 1 ? opts.page : null) ?? pageFromPath
      if (page) {
        setPageNumber(page)
        broadcast({ type: 'page', page })
      }

      // Path do Storage primeiro (fonte da verdade); índice só como fallback
      const fromPath =
        opts.pageImagePath && pageImages.find((p) => p.path === opts.pageImagePath)
      const fromMap = page ? pageImages.find((p) => p.index === page) : undefined
      const fromParsed =
        page &&
        pageImages.find((p) => pageNumberFromImagePath(p.path) === page)

      const entry = fromPath || fromParsed || fromMap
      if (entry) {
        setPageThumbUrl(entry.url)
        setPreferPageImage(true)
        const resolved = pageNumberFromImagePath(entry.path)
        if (resolved && resolved !== page) {
          setPageNumber(resolved)
          broadcast({ type: 'page', page: resolved })
        }
      } else if (page && pdfRef.current) {
        setPreferPageImage(false)
      }

      const box = opts.bbox && !isPlaceholderBbox(opts.bbox) ? opts.bbox : null
      if (box) {
        const z = Math.min(2.5, Math.max(1.2, 0.9 / Math.max(box.width, box.height, 0.15)))
        setZoom(z)
        pendingFocusRef.current = {
          cx: box.x + box.width / 2,
          cy: box.y + box.height / 2,
          zoom: z,
        }
        // Aplica no próximo frame (imagem/canvas já medidos) e de novo após load
        requestAnimationFrame(() => applyMediaFocus())
      } else {
        pendingFocusRef.current = null
        setZoom(1)
        setPan({ x: 0, y: 0 })
      }

      mainViewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    },
    [pageImages, broadcast, applyMediaFocus],
  )

  // Troca de página (setas): usa JPEG pré-carregado quando existir
  useEffect(() => {
    if (!preferPageImage) return
    const entry =
      pageImages.find((p) => p.index === pageNumber) ||
      pageImages.find((p) => pageNumberFromImagePath(p.path) === pageNumber)
    if (entry) setPageThumbUrl(entry.url)
  }, [pageNumber, pageImages, preferPageImage])

  const showPageOnMainViewer = useCallback(() => {
    const page =
      (selection?.kind === 'material'
        ? resolveSelectionPage(selection.module, selection.material)
        : selection?.kind === 'module'
          ? resolveSelectionPage(selection.module)
          : null) ?? pageNumber
    const bbox =
      selection?.kind === 'material'
        ? resolveSelectionBbox(selection.module, selection.material)
        : selection?.kind === 'module'
          ? resolveSelectionBbox(selection.module)
          : null
    const path =
      selection?.kind === 'material'
        ? selection.material.page_image_path || selection.module.page_image_path
        : selection?.kind === 'module'
          ? selection.module.page_image_path
          : null
    focusSelectionOnViewer({ page, bbox, pageImagePath: path })
  }, [selection, pageNumber, focusSelectionOnViewer])

  // Preço ao vivo: materiais ÷ (1 − margem%) / ×N — acompanha o input da barra.
  // Não congelar em totals.sale_price do pipeline (senão mudar a % não atualiza a UI).
  const pricing = useMemo(() => {
    if (!tree) return null
    return calculateQuotePricing(tree, pricingParams)
  }, [tree, pricingParams])

  const circuitBreaker = useMemo(() => {
    const totals =
      tree?.totals && typeof tree.totals === 'object'
        ? (tree.totals as Record<string, unknown>)
        : null
    const cb = totals?.circuit_breaker
    if (!cb || typeof cb !== 'object') return null
    return cb as { ok?: boolean; blockers?: string[] }
  }, [tree])

  const selectedModule: QuoteModuleRow | null = useMemo(() => {
    if (!selection) return null
    return selection.kind === 'module' ? selection.module : selection.module
  }, [selection])

  const xrayAtomic = useMemo(() => {
    if (!selectedModule) return null
    const totals = (tree?.totals as Record<string, unknown> | undefined) ?? {}
    return buildAtomicPieces({
      module: selectedModule,
      lastExtraction: totals.last_extraction,
    })
  }, [selectedModule, tree?.totals])

  const atomic_pieces = xrayAtomic?.atomic_pieces ?? []

  /** Etiquetas industriais: do explode do builder, ou desmonte local se a fonte foi lista/extração. */
  const industrialLabels: IndustrialLabel[] = useMemo(() => {
    if (xrayAtomic?.explode?.labels?.length) return xrayAtomic.explode.labels
    if (!selectedModule || !tree) return []
    const env = tree.environments.find((e) =>
      e.modules.some((m) => m.id === selectedModule.id),
    )
    return explodeFromExtractionModule(
      {
        name: selectedModule.name,
        dimensions: selectedModule.dimensions ?? undefined,
        room_tag: env?.name,
      },
      null,
    ).labels
  }, [xrayAtomic, selectedModule, tree])

  const cockpitBlocks = useMemo(() => {
    const bom =
      bomLines.length > 0
        ? bomLines
        : atomic_pieces.length
          ? explodeModule({
              name: selectedModule?.name ?? 'Módulo',
              typology: inferTypology(selectedModule?.name ?? ''),
              width_mm: Number(selectedModule?.dimensions?.width_mm) || 800,
              height_mm: Number(selectedModule?.dimensions?.height_mm) || 720,
              depth_mm: Number(selectedModule?.dimensions?.depth_mm) || 500,
            }).bom
          : []
    if (!bom.length && !engineeringCot) return null
    const totals = (tree?.totals as Record<string, unknown> | undefined) ?? {}
    return buildObservabilityBlocks({
      chainOfThought: engineeringCot || 'Desmonte local a partir das cotas do módulo selecionado.',
      bom,
      pricing: pricingParams,
      promptTraces: Array.isArray(totals.prompt_traces) ? (totals.prompt_traces as unknown[]) : [],
      extractionSnippet: totals.last_extraction ?? null,
    })
  }, [bomLines, engineeringCot, pricingParams, selectedModule, tree?.totals, atomic_pieces.length])

  const shoppingList = useMemo(
    () =>
      tree
        ? buildShoppingList(tree, { sheetLossPct: pricingParams.sheetLossPct })
        : [],
    [tree, pricingParams.sheetLossPct],
  )

  const shoppingListMaterialsTotal = useMemo(
    () => shoppingList.reduce((sum, row) => sum + (Number(row.lineTotal) || 0), 0),
    [shoppingList],
  )

  const setModality = (modality: PricingModality) => {
    setPricingParams((p) => ({ ...p, modality }))
  }

  /** Pedra / alvenaria / decoração — listados à parte, fora do custo. */
  const outOfScopeModules = useMemo(
    () =>
      (tree?.environments ?? []).flatMap((env) =>
        env.modules.filter((m) => m.out_of_scope).map((m) => ({ env: env.name, module: m })),
      ),
    [tree],
  )

  const coverage = useMemo((): CoverageReport | null => {
    const raw = tree?.totals?.coverage
    if (!raw || typeof raw !== 'object') return null
    const report = raw as CoverageReport
    return { ...report, extras: report.extras ?? [] }
  }, [tree])

  const batchPageRanges = useMemo(() => {
    const totals = tree?.totals
    if (!totals || typeof totals !== 'object') return [] as number[]
    return pageNumbersFromTotals(totals as Record<string, unknown>)
  }, [tree])

  const coverageScope = useMemo((): 'batch' | 'project' | null => {
    const raw = tree?.totals?.coverage_scope
    if (raw === 'batch' || raw === 'project') return raw
    return batchPageRanges.length ? 'batch' : null
  }, [tree, batchPageRanges])

  const batchScopeBanner = useMemo(() => {
    if (!batchPageRanges.length) return null
    const totals = tree?.totals
    const label =
      totals && typeof totals === 'object' && typeof totals.batch_label === 'string'
        ? totals.batch_label.trim()
        : formatPageRanges(batchPageRanges)
    return label || formatPageRanges(batchPageRanges)
  }, [batchPageRanges, tree])

  const auditorNotes = useMemo(() => {
    const raw = tree?.totals?.auditor_notes
    return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string') : []
  }, [tree])

  const handleReprocess = async (fromScratch = false) => {
    if (reprocessing || cancelling) return
    const ok = window.confirm(
      fromScratch
        ? 'Recomeçar do ZERO? Apaga o progresso parcial, o checkpoint e a lista já salva — e lê o PDF de novo desde a página 1.'
        : 'Reprocessar / Retomar este PDF? Se já houver checkpoint de página, continua de onde parou (anti-504).',
    )
    if (!ok) return
    setReprocessing(true)
    toast.message(
      fromScratch
        ? 'Recomeçando do zero…'
        : 'Retomando / reprocessando… a cadeia async lê 1 página por vez.',
    )
    const result = await reprocessOrcamentosIaPipeline({
      analysisId,
      companyId,
      fromScratch,
    })
    setReprocessing(false)
    if (!result.ok) {
      if (/interrompid/i.test(result.error || '')) {
        toast.message('Leitura interrompida', {
          description: 'Use Retomar ou Recomeçar do zero quando quiser continuar.',
        })
      } else {
        toast.error(result.error || 'Falha ao reprocessar.')
      }
      await reload()
      return
    }
    toast.success(
      `Concluído${result.materialsSaved != null ? ` (${result.materialsSaved} materiais)` : ''}.`,
    )
    await reload()
  }

  const handleCancel = async () => {
    if (cancelling || reauditing) return
    if (
      !window.confirm(
        'Interromper a leitura agora? O progresso parcial fica salvo para Retomar.',
      )
    ) {
      return
    }
    setCancelling(true)
    const result = await cancelOrcamentosIaAnalysis(analysisId)
    setCancelling(false)
    if (!result.ok) {
      toast.error(result.error || 'Não foi possível interromper.')
      return
    }
    toast.message('Leitura interrompida', {
      description: 'Use Retomar ou Recomeçar do zero quando quiser continuar.',
    })
    await reload()
  }

  /** Só auditoria (cobertura + marcações + BOM) — não apaga preços confirmados. */
  const handleReaudit = async () => {
    if (reauditing || reprocessing) return
    setReauditing(true)
    toast.message('Reauditoria: conferindo móveis, chapas e páginas marcadas…')
    const result = await reauditOrcamentosIaAnalysis({ analysisId, companyId })
    setReauditing(false)
    if (!result.ok) {
      toast.error(result.error || 'Falha na reauditoria.')
      return
    }
    if (result.auditNeedsRerun) {
      toast.warning(
        `Reauditoria: ainda há pontos a conferir${
          result.updatedModules ? ` (${result.updatedModules} marcações atualizadas)` : ''
        }. Pode rodar de novo.`,
      )
    } else {
      toast.success(
        `Reauditoria ok${
          result.updatedModules ? ` · ${result.updatedModules} marcações ajustadas` : ''
        }.`,
      )
    }
    await reload()
  }

  // Render canvas 200 DPI + zoom
  useEffect(() => {
    if (preferPageImage && pageThumbUrl) return
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas || pageCount < 1) return

    let cancelled = false
    ;(async () => {
      const page = await pdf.getPage(pageNumber)
      if (cancelled) return
      const viewport = page.getViewport({ scale: PDF_SCALE * zoom })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      if (!cancelled) requestAnimationFrame(() => applyMediaFocus())
    })().catch(() => {
      /* página inválida */
    })
    return () => {
      cancelled = true
    }
  }, [pageNumber, zoom, pageCount, pdfUrl, preferPageImage, pageThumbUrl, applyMediaFocus])

  const onSelectModule = (module: QuoteModuleRow) => {
    setSelection({ kind: 'module', module })
    // Abre o ambiente/móvel na lista para ver itens + preços juntos
    const envId = tree?.environments.find((e) => e.modules.some((m) => m.id === module.id))?.id
    if (envId) {
      setExpandedEnvs((prev) => new Set(prev).add(envId))
    }
    setExpandedMods((prev) => new Set(prev).add(module.id))

    const page = resolveSelectionPage(module)
    focusSelectionOnViewer({
      page,
      bbox: resolveSelectionBbox(module),
      pageImagePath: module.page_image_path,
    })
    broadcast({ type: 'select', selectionId: module.id })
  }

  /** Primeiro móvel de marcenaria (ignora pedra/decoração fora de escopo). */
  const firstBillableModule = useMemo((): QuoteModuleRow | null => {
    for (const env of tree?.environments ?? []) {
      const mod = env.modules.find((m) => !m.out_of_scope)
      if (mod) return mod
    }
    return tree?.environments?.[0]?.modules?.[0] ?? null
  }, [tree])

  /** Lista ordenada de módulos navegáveis no Raio-X (ambientes → módulos). */
  const xrayModules = useMemo(() => {
    const list: { module: QuoteModuleRow; envName: string }[] = []
    for (const env of tree?.environments ?? []) {
      for (const mod of env.modules) {
        if (!mod.out_of_scope) list.push({ module: mod, envName: env.name })
      }
    }
    if (list.length === 0) {
      for (const env of tree?.environments ?? []) {
        for (const mod of env.modules) {
          list.push({ module: mod, envName: env.name })
        }
      }
    }
    return list
  }, [tree])

  const xrayModuleIndex = useMemo(() => {
    if (!selectedModule) return -1
    return xrayModules.findIndex((entry) => entry.module.id === selectedModule.id)
  }, [xrayModules, selectedModule])

  const xrayEnvironmentName = useMemo(() => {
    if (xrayModuleIndex >= 0) return xrayModules[xrayModuleIndex]?.envName
    if (!selectedModule || !tree) return undefined
    return tree.environments.find((e) => e.modules.some((m) => m.id === selectedModule.id))?.name
  }, [xrayModuleIndex, xrayModules, selectedModule, tree])

  const xraySourceLabel = useMemo(() => {
    const source = xrayAtomic?.source
    if (source === 'cutting_list') return 'Lista de corte'
    if (source === 'extraction') return 'Extração do PDF'
    if (source === 'explode') return 'Desmonte estimado'
    return undefined
  }, [xrayAtomic?.source])

  /** Seleciona módulo e permanece no Raio-X (sem voltar ao PDF). */
  const selectModuleForXray = useCallback(
    (mod: QuoteModuleRow) => {
      setSelection({ kind: 'module', module: mod })
      const envId = tree?.environments.find((e) => e.modules.some((m) => m.id === mod.id))?.id
      if (envId) setExpandedEnvs((prev) => new Set(prev).add(envId))
      setExpandedMods((prev) => new Set(prev).add(mod.id))
      broadcast({ type: 'select', selectionId: mod.id })
      setViewerMode('xray')
    },
    [tree, broadcast],
  )

  const goXrayPrev = useCallback(() => {
    if (xrayModuleIndex <= 0) return
    const prev = xrayModules[xrayModuleIndex - 1]
    if (prev) selectModuleForXray(prev.module)
  }, [xrayModuleIndex, xrayModules, selectModuleForXray])

  const goXrayNext = useCallback(() => {
    if (xrayModuleIndex < 0 || xrayModuleIndex >= xrayModules.length - 1) return
    const next = xrayModules[xrayModuleIndex + 1]
    if (next) selectModuleForXray(next.module)
  }, [xrayModuleIndex, xrayModules, selectModuleForXray])

  const openXrayViewer = () => {
    const mod = selectedModule ?? firstBillableModule
    if (!mod) {
      toast.message('Nenhum módulo na árvore para o Raio-X.')
      return
    }
    // Seleciona o módulo sem chamar focusSelectionOnViewer (que forçava PDF e
    // anulava o clique em Raio-X).
    selectModuleForXray(mod)
  }

  const onSelectMaterial = (material: QuoteMaterialRow, module: QuoteModuleRow) => {
    setSelection({ kind: 'material', material, module })
    const envId = tree?.environments.find((e) => e.modules.some((m) => m.id === module.id))?.id
    if (envId) {
      setExpandedEnvs((prev) => new Set(prev).add(envId))
    }
    setExpandedMods((prev) => new Set(prev).add(module.id))

    const page = resolveSelectionPage(module, material)
    focusSelectionOnViewer({
      page,
      bbox: resolveSelectionBbox(module, material),
      pageImagePath: material.page_image_path || module.page_image_path,
    })
    broadcast({ type: 'select', selectionId: material.id })
  }

  const openEdit = (material: QuoteMaterialRow) => {
    setEditingMaterial(material)
    setEditDraft({
      exact: String(material.exact_quantity),
      full: String(material.full_units_quantity),
      price: String(material.unit_price),
    })
  }

  const saveEdit = async (opts?: { confirmMarket?: boolean }) => {
    if (!editingMaterial) return
    const exact = Number(editDraft.exact)
    const full = Number(editDraft.full)
    const price = Number(editDraft.price)
    if ([exact, full, price].some((n) => Number.isNaN(n))) {
      toast.error('Informe números válidos.')
      return
    }
    if (!(price > 0)) {
      toast.error('O preço deve ser maior que R$ 0,00.')
      return
    }
    const { error } = await updateQuoteMaterial(editingMaterial.id, {
      exact_quantity: exact,
      full_units_quantity: Math.ceil(full),
      unit_price: price,
      using_market_price: opts?.confirmMarket ? false : editingMaterial.using_market_price,
      market_price_confirmed: opts?.confirmMarket
        ? true
        : editingMaterial.market_price_confirmed,
    })
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Insumo atualizado.')
    setExplainContext(editingMaterial.raw_name)
    setEditingMaterial(null)
    setExplainOpen(true)
    await reload()
  }

  const confirmMarketPrice = async (material: QuoteMaterialRow) => {
    const { error } = await updateQuoteMaterial(material.id, {
      market_price_confirmed: true,
    })
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Preço de mercado confirmado.')
    await reload()
  }

  const openPopout = () => {
    const url = `${window.location.origin}/orcamentos-ia?audit=${analysisId}&popout=1`
    const win = window.open(url, 'orcamentos-ia-popout', 'width=1200,height=900,menubar=no,toolbar=no')
    if (!win) {
      toast.error('O navegador bloqueou a nova janela. Permita pop-ups ou abra o link manualmente.')
      return
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.x),
      y: dragRef.current.panY + (e.clientY - dragRef.current.y),
    })
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-[#0066FF]" />
        Carregando Audit Workspace…
      </div>
    )
  }

  if (!tree) {
    return (
      <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
        Análise não encontrada.
        {onBack && (
          <Button type="button" variant="link" onClick={onBack} className="gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para lista de orçamentos
          </Button>
        )}
      </div>
    )
  }

  const showBreakerBanner =
    tree.status === 'NEEDS_REVIEW' || (circuitBreaker && circuitBreaker.ok === false)
  const breakerBlockers = (
    circuitBreaker?.blockers?.length
      ? circuitBreaker.blockers
      : ['Status NEEDS_REVIEW — confira cobertura, preços e quantidades.']
  ).slice(0, 6)

  const asyncProgressText = formatAsyncPageProgress(tree.totals)
  const isPipelineBusy = ![
    'COMPLETED',
    'FAILED',
    'NEEDS_REVIEW',
  ].includes(String(tree.status || ''))

  const showFolderTabs = Boolean(folderProject && folderBatches.length >= 1)

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col gap-2 rounded-2xl bg-[#f7f4ef] p-2 pb-10 sm:gap-3 sm:p-3 sm:pb-12 md:p-4">
      {showFolderTabs && folderProject ? (
        <ProjectFolderTabs
          project={folderProject}
          batches={folderBatches}
          activeAnalysisId={analysisId}
          viewMode={folderViewMode}
          onViewModeChange={setFolderViewMode}
          onSelectBatch={(id) => {
            setFolderViewMode('history')
            if (id !== analysisId) onOpenBatch?.(id)
          }}
        />
      ) : null}
      {showFolderTabs && folderViewMode === 'consolidated' ? (
        <p className="shrink-0 text-[11px] text-muted-foreground">
          Use Minimizar no painel acima se quiser mais espaço. Para editar um intervalo, abra
          Histórico e escolha o lote.
        </p>
      ) : null}
      {isPipelineBusy ? (
        <div className="sticky top-0 z-20 flex shrink-0 flex-col gap-2">
          {asyncProgressText ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-[#0066FF]/30 bg-[#0066FF]/10 px-3 py-2 text-sm text-[#003d99] shadow-sm"
            >
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0066FF]" />
              <span className="font-medium">{asyncProgressText}</span>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <AiThoughtConsole
              status={tree.status as QuoteAnalysisStatus}
              pipelineStage={
                typeof tree.totals?.pipeline_stage === 'string'
                  ? (tree.totals.pipeline_stage as PipelineStageId)
                  : null
              }
              pipelineDetail={
                typeof tree.totals?.pipeline_detail === 'string'
                  ? tree.totals.pipeline_detail
                  : null
              }
              thoughtLog={
                Array.isArray(tree.totals?.thought_log)
                  ? (tree.totals.thought_log as ThoughtLogEntry[])
                  : []
              }
              analysisId={analysisId}
              companyId={companyId}
              projectId={
                projectIdProp ||
                (typeof tree.project_id === 'string' ? tree.project_id : null) ||
                (typeof tree.totals?.project_id === 'string'
                  ? (tree.totals.project_id as string)
                  : null)
              }
              pagesProcessed={
                Number(tree.totals?.pages_processed) ||
                Number(tree.totals?.current_page) ||
                undefined
              }
              totals={
                tree.totals && typeof tree.totals === 'object'
                  ? (tree.totals as Record<string, unknown>)
                  : null
              }
              errorMessage={
                typeof tree.totals?.pipeline_detail === 'string' &&
                String(tree.status).toUpperCase() === 'FAILED'
                  ? tree.totals.pipeline_detail
                  : null
              }
              density="workshop"
            />
          </div>
        </div>
      ) : null}
      {showBreakerBanner ? (
        <div
          role="alert"
          className="sticky top-0 z-20 shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 shadow-sm"
        >
          <p className="font-semibold">Circuit breaker — revisão necessária</p>
          <p className="mt-1 text-amber-900/90">
            A análise não foi liberada como concluída. Corrija os pontos abaixo (ou use
            Reauditar) e ajuste preços manualmente se precisar.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/90">
            {breakerBlockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-base font-semibold tracking-tight text-[#2a1812] sm:text-lg">
            Conferência do orçamento
          </h2>
          <p className="hidden text-xs text-[#6b5244] sm:block">
            Confira os materiais que a IA encontrou e ajuste preços antes de enviar ao cliente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Modalidades MPC */}
          <div className="flex rounded-lg border border-border p-0.5">
            {(Object.keys(PRICING_MODALITY_LABEL) as PricingModality[]).map((key) => (
              <button
                key={key}
                type="button"
                title={PRICING_MODALITY_HINT[key]}
                onClick={() => setModality(key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                  pricingParams.modality === key
                    ? 'bg-[#0066FF] text-white'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {PRICING_MODALITY_LABEL[key]}
              </button>
            ))}
          </div>
          {pricingParams.modality === 'mpc_margin' && (
            <label
              className="flex items-center gap-1 text-[11px] text-muted-foreground"
              title="Parte do preço de venda que cobre impostos, comissões, taxas e lucro"
            >
              Margem
              <Input
                type="number"
                className="h-7 w-14 text-xs"
                value={pricingParams.mpcPercent}
                onChange={(e) =>
                  setPricingParams((p) => ({
                    ...p,
                    mpcPercent: Number(e.target.value) || 0,
                  }))
                }
              />
              %
            </label>
          )}
          {pricingParams.modality === 'material_multiplier' && (
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Custo ×
              <Input
                type="number"
                step="0.1"
                className="h-7 w-14 text-xs"
                value={pricingParams.materialMultiplier}
                onChange={(e) =>
                  setPricingParams((p) => ({
                    ...p,
                    materialMultiplier: Number(e.target.value) || 0,
                  }))
                }
              />
            </label>
          )}
          <PricingAdjustmentsButton
            params={pricingParams}
            onClick={() => setPricingAdjustOpen(true)}
          />
          {pricing && (
            <div
              className="hidden rounded-lg border border-[#8d5e22]/25 bg-[#fffcf8] px-3 py-1 text-right sm:block"
              title={`Cálculo: ${pricing.formulaLabel}`}
            >
              <p className="text-[10px] text-[#8a7060]">Preço de venda</p>
              <p className="text-sm font-semibold tabular-nums text-[#2a1812]">
                {formatBRL(pricing.salePrice)}
              </p>
              <p className="text-[10px] text-[#8a7060]">
                Materiais {formatBRL(pricing.materialsCost)}
              </p>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setMemoriesOpen(true)}
          >
            <Brain className="h-3.5 w-3.5" />
            Memórias do Max
          </Button>
          {tree && (
            <QuotePresentationExportButton
              tree={tree}
              pricingParams={pricingParams}
              onPricingParamsChange={setPricingParams}
              pageImages={pageImages}
              branding={{
                companyName: empresa?.nome || 'Garbo Movelaria',
                logoUrl: empresa?.logo_url,
                cnpj: empresa?.cnpj,
                razaoSocial: empresa?.razao_social,
              }}
              disabled={loading}
            />
          )}
          <Button
            type="button"
            variant={showShoppingList ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowShoppingList((v) => !v)}
          >
            Lista de compras
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!industrialLabels.length}
            title="Copia etiquetas industriais do módulo selecionado (ambiente + cotas)"
            onClick={async () => {
              const text = formatLabelsForPrint(industrialLabels)
              if (!text) {
                toast.error('Selecione um módulo para gerar etiquetas.')
                return
              }
              try {
                await navigator.clipboard.writeText(text)
                toast.success(`${industrialLabels.length} etiqueta(s) copiada(s).`)
              } catch {
                toast.error('Não foi possível copiar. Tente de novo.')
              }
            }}
          >
            <Tags className="h-3.5 w-3.5" />
            Etiquetas
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-[#0066FF]/30 text-[#0066FF] hover:bg-[#0066FF]/10"
            onClick={() => void handleReaudit()}
            disabled={reauditing || reprocessing}
            title="Confere coberturas, BOM e marcações sem apagar seus preços"
          >
            {reauditing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Reauditar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void handleReprocess(false)}
            disabled={reprocessing || reauditing || cancelling}
            title="Continua do checkpoint se existir"
          >
            {reprocessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Reprocessar PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-amber-500/40 text-amber-800 hover:bg-amber-50"
            onClick={() => void handleReprocess(true)}
            disabled={reprocessing || reauditing || cancelling}
            title="Apaga progresso e recomeça da página 1"
          >
            {reprocessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Recomeçar do zero
          </Button>
          {isPipelineBusy ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-red-500/40 text-red-700 hover:bg-red-50"
              onClick={() => void handleCancel()}
              disabled={cancelling || reauditing}
              title="Para a leitura agora (pode Retomar depois)"
            >
              {cancelling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {cancelling ? 'Interrompendo…' : 'Interromper'}
            </Button>
          ) : null}
          {onBack && (
            <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para lista
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Atualizar
          </Button>
          <Button type="button" size="sm" onClick={openPopout}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Abrir em outra tela
          </Button>
        </div>
      </div>

      {showShoppingList && (
        <div className="shrink-0 overflow-hidden rounded-xl border border-[#0066FF]/20 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0066FF]/15 bg-[#f4f8ff] px-3 py-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0066FF]">
                Lista de compras
              </p>
              <p className="text-[11px] text-[#8a7060]">
                {shoppingList.length} {shoppingList.length === 1 ? 'material' : 'materiais'} consolidados
              </p>
            </div>
            <div className="rounded-lg border border-[#0066FF]/25 bg-white px-3 py-1.5 text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#8a7060]">
                Total materiais
              </p>
              <p className="text-base font-semibold tabular-nums text-[#2a1812]">
                {formatBRL(shoppingListMaterialsTotal)}
              </p>
            </div>
          </div>
          <div className="max-h-48 overflow-auto">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur">
                <tr className="border-b border-border">
                  <th className="w-[32%] px-3 py-2 font-medium">Item</th>
                  <th className="w-[12%] px-2 py-2 font-medium">Exato</th>
                  <th className="w-[12%] px-2 py-2 font-medium">Compra</th>
                  <th className="w-[12%] px-2 py-2 text-right font-medium">Unitário</th>
                  <th className="w-[14%] px-2 py-2 text-right font-medium text-[#0066FF]">
                    Total
                  </th>
                  <th className="w-[18%] px-3 py-2 font-medium">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {shoppingList.map((row) => (
                  <tr key={row.key} className="border-b border-border/50">
                    <td className="truncate px-3 py-1.5 font-medium" title={row.name}>
                      {row.name}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                      {row.exactQuantity} {row.exactUnit}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {row.purchaseQuantity} {row.purchaseUnit}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatBRL(row.unitPrice)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-[#2a1812]">
                      {formatBRL(row.lineTotal)}
                    </td>
                    <td
                      className="truncate px-3 py-1.5 text-muted-foreground"
                      title={row.notes || undefined}
                    >
                      {row.notes}
                    </td>
                  </tr>
                ))}
                {!shoppingList.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                      Sem itens para consolidar.
                    </td>
                  </tr>
                )}
              </tbody>
              {shoppingList.length > 0 && (
                <tfoot className="sticky bottom-0 border-t border-[#0066FF]/20 bg-[#f4f8ff]/95 backdrop-blur">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right text-[11px] font-medium text-[#6b5244]">
                      Total materiais
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums text-[#0066FF]">
                      {formatBRL(shoppingListMaterialsTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/*
        Grid responsivo: a página do PDF sempre tem faixa própria de altura.
        Mobile → página no topo (≈40dvh) + materiais embaixo.
        lg → página | materiais; cockpit sob as duas.
        xl → três colunas lado a lado.
      */}
      <div
        className={cn(
          // Altura mínima generosa + página scrollável (não trava em 100vh).
          'grid min-h-[min(78dvh,860px)] gap-2 sm:gap-3',
          viewerMode === 'xray'
            ? 'grid-rows-[minmax(320px,52dvh)_minmax(280px,1fr)]'
            : 'grid-rows-[minmax(240px,42dvh)_minmax(280px,1fr)]',
          'lg:grid-cols-2 lg:grid-rows-[minmax(420px,1fr)_minmax(220px,auto)]',
          viewerMode === 'xray'
            ? 'xl:grid-cols-[minmax(420px,1.55fr)_minmax(0,0.95fr)_minmax(220px,0.58fr)] xl:grid-rows-[minmax(560px,72dvh)]'
            : 'xl:grid-cols-[minmax(300px,1.2fr)_minmax(0,1fr)_minmax(260px,0.72fr)] xl:grid-rows-[minmax(560px,72dvh)]',
        )}
      >
        {/* Esquerda: PDF / Raio-X — sempre visível */}
        <section
          className={cn(
            'relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#0066FF]/20 bg-card shadow-[0_0_0_1px_rgba(0,102,255,0.06)]',
            'max-lg:sticky max-lg:top-0 max-lg:z-20',
            'lg:row-span-1 xl:row-auto',
            viewerMode === 'xray' && 'min-h-[min(70dvh,720px)]',
          )}
        >
          <ThoughtShaderCanvas
            className={cn(
              'pointer-events-none absolute inset-0 z-0',
              viewerMode === 'xray' ? 'opacity-0' : 'opacity-[0.55]',
            )}
            progress={pageNumber / Math.max(pageCount || pageImages.length || 1, 1)}
            intensity={selectionLabel ? 0.55 : 0.28}
            active={viewerMode !== 'xray'}
          />
          <div className="relative z-[1] flex flex-wrap items-center gap-2 border-b border-[#0066FF]/15 bg-white/80 px-3 py-2 backdrop-blur-md">
            <div className="flex rounded-md border border-border p-0.5">
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium',
                  viewerMode === 'pdf' ? 'bg-[#0066FF] text-white' : 'text-muted-foreground',
                )}
                onClick={() => setViewerMode('pdf')}
              >
                <FileText className="h-3.5 w-3.5" />
                PDF
              </button>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium',
                  viewerMode === 'xray' ? 'bg-[#0066FF] text-white' : 'text-muted-foreground',
                  !firstBillableModule && 'cursor-not-allowed opacity-40',
                )}
                onClick={openXrayViewer}
                disabled={!firstBillableModule}
                title={
                  selectedModule
                    ? `Raio-X 3D · ${selectedModule.name}`
                    : firstBillableModule
                      ? `Raio-X 3D · abre ${firstBillableModule.name}`
                      : 'Nenhum módulo disponível'
                }
              >
                <Box className="h-3.5 w-3.5" />
                Raio-X
              </button>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={
                viewerMode === 'xray'
                  ? xrayModuleIndex <= 0
                  : pageNumber <= 1
              }
              onClick={() => {
                if (viewerMode === 'xray') {
                  goXrayPrev()
                  return
                }
                const p = Math.max(1, pageNumber - 1)
                setPageNumber(p)
                setPan({ x: 0, y: 0 })
                if (pageImages.some((img) => img.index === p)) setPreferPageImage(true)
                else setPreferPageImage(false)
                broadcast({ type: 'page', page: p })
              }}
              title={viewerMode === 'xray' ? 'Módulo anterior' : 'Página anterior'}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[5rem] text-center text-xs tabular-nums">
              {viewerMode === 'xray'
                ? xrayModuleIndex >= 0
                  ? `${xrayModuleIndex + 1} / ${xrayModules.length}`
                  : `— / ${xrayModules.length || '—'}`
                : `${pageNumber} / ${pageCount || pageImages.length || '—'}`}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={
                viewerMode === 'xray'
                  ? xrayModuleIndex < 0 || xrayModuleIndex >= xrayModules.length - 1
                  : pageNumber >= (pageCount || pageImages.length)
              }
              onClick={() => {
                if (viewerMode === 'xray') {
                  goXrayNext()
                  return
                }
                const max = pageCount || pageImages.length
                const p = Math.min(max, pageNumber + 1)
                setPageNumber(p)
                setPan({ x: 0, y: 0 })
                if (pageImages.some((img) => img.index === p)) setPreferPageImage(true)
                else setPreferPageImage(false)
                broadcast({ type: 'page', page: p })
              }}
              title={viewerMode === 'xray' ? 'Próximo módulo' : 'Próxima página'}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  const z = Math.max(0.5, zoom - 0.15)
                  setZoom(z)
                  broadcast({ type: 'zoom', zoom: z })
                }}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  const z = Math.min(3, zoom + 0.15)
                  setZoom(z)
                  broadcast({ type: 'zoom', zoom: z })
                }}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {viewerMode === 'xray' ? (
            selectedModule && atomic_pieces.length > 0 ? (
              <RaioX3D
                className="relative z-[1] min-h-0 flex-1"
                atomic_pieces={atomic_pieces}
                selectedPieceId={
                  selection?.kind === 'material' ? selection.material.id : null
                }
                moduleName={selectedModule.name}
                environmentName={xrayEnvironmentName}
                dimensionsMm={
                  selectedModule.dimensions
                    ? {
                        width_mm: Number(selectedModule.dimensions.width_mm) || null,
                        height_mm: Number(selectedModule.dimensions.height_mm) || null,
                        depth_mm: Number(selectedModule.dimensions.depth_mm) || null,
                      }
                    : null
                }
                moduleIndex={Math.max(0, xrayModuleIndex)}
                moduleCount={Math.max(xrayModules.length, 1)}
                sourceLabel={xraySourceLabel}
                onPrevModule={goXrayPrev}
                onNextModule={goXrayNext}
              />
            ) : (
              <div className="relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-[#0f1419] p-6 text-center">
                <p className="max-w-xs text-xs text-muted-foreground">
                  {selectedModule
                    ? 'Sem peças para montar o Raio-X neste módulo.'
                    : 'Selecione um módulo na árvore (ou clique de novo em Raio-X).'}
                </p>
                {xrayModules.length > 1 && xrayModuleIndex >= 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={xrayModuleIndex <= 0}
                      onClick={goXrayPrev}
                    >
                      Anterior
                    </Button>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {xrayModuleIndex + 1} / {xrayModules.length}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={xrayModuleIndex >= xrayModules.length - 1}
                      onClick={goXrayNext}
                    >
                      Próximo
                    </Button>
                  </div>
                )}
              </div>
            )
          ) : null}
          <div
            ref={mainViewerRef}
            className={cn(
              'relative z-[1] min-h-0 flex-1 cursor-grab overflow-hidden bg-[#e8eef8]/90 active:cursor-grabbing',
              viewerMode === 'xray' && 'hidden',
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {selectionLabel && (
              <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[min(90%,28rem)] rounded-lg bg-[#0066FF] px-3 py-1.5 text-white shadow-lg">
                <p className="truncate text-sm font-semibold">{selectionLabel}</p>
                <p className="text-[11px] text-white/85">
                  Página {pageNumber}
                  {highlightBbox ? ' · área marcada no desenho' : ' · local aproximado nesta folha'}
                </p>
              </div>
            )}
            {!pageThumbUrl && !pdfRef.current && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[#8a7060]">
                Carregando pré-visualização das páginas…
              </div>
            )}
            <div
              className="absolute left-1/2 top-1/2"
              style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))` }}
            >
              <div
                ref={mediaBoxRef}
                className="relative inline-block shadow-2xl"
                style={
                  preferPageImage && pageThumbUrl
                    ? { transform: `scale(${zoom})`, transformOrigin: 'center center' }
                    : undefined
                }
              >
                {preferPageImage && pageThumbUrl ? (
                  <img
                    src={pageThumbUrl}
                    alt={`Página ${pageNumber} do orçamento`}
                    className="block max-h-[min(36dvh,520px)] w-auto max-w-[min(96%,720px)] object-contain sm:max-h-[min(48dvh,720px)] lg:max-h-[min(70dvh,980px)] lg:max-w-[min(92vw,900px)]"
                    draggable={false}
                    onLoad={applyMediaFocus}
                  />
                ) : (
                  <canvas ref={canvasRef} className="block max-w-none" />
                )}
                {highlightBbox && (highlightBbox.page ?? pageNumber) === pageNumber && (
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                  >
                    <rect
                      x={highlightBbox.x}
                      y={highlightBbox.y}
                      width={highlightBbox.width}
                      height={highlightBbox.height}
                      fill={`${HIGHLIGHT}28`}
                      stroke={HIGHLIGHT}
                      strokeWidth={0.01}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Direita: árvore — página sticky no topo da coluna */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:min-h-0">
          <div className="shrink-0 border-b border-border px-3 py-2.5 sm:px-4 sm:py-3">
            {batchScopeBanner ? (
              <div
                className="mb-2 rounded-lg border border-[#0066FF]/25 bg-[#0066FF]/5 px-2.5 py-1.5 text-[11px] text-[#0a3d8f] sm:text-xs"
                role="status"
              >
                Exibindo cotação referente às páginas {batchScopeBanner} (lote selecionado)
              </div>
            ) : null}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#2a1812]">Materiais do orçamento</h3>
                <p className="mt-0.5 text-[11px] text-[#8a7060] sm:text-xs">
                  Clique no móvel para abrir a página certa na pré-visualização.
                </p>
              </div>
              {coverage && (
                <div className="hidden shrink-0 sm:block">
                  <CoverageSummary
                    coverage={coverage}
                    auditorNotes={auditorNotes}
                    coverageScope={coverageScope}
                  />
                </div>
              )}
            </div>

            {/* Mini página sempre à vista nesta coluna (desktop); no mobile a coluna PDF já ocupa o topo */}
            {pageThumbUrl && (
              <button
                type="button"
                onClick={showPageOnMainViewer}
                className={cn(
                  'mt-2 flex w-full items-stretch gap-2 overflow-hidden rounded-xl border bg-gradient-to-br from-[#f4f8ff] to-white text-left transition',
                  'hover:border-[#0066FF]/55 hover:shadow-[0_0_0_3px_rgba(0,102,255,0.12)]',
                  preferPageImage
                    ? 'border-[#0066FF] ring-2 ring-[#0066FF]/20'
                    : 'border-[#0066FF]/25',
                  'max-lg:hidden',
                )}
                title="Focar esta página na pré-visualização"
              >
                <img
                  src={pageThumbUrl}
                  alt={`Página ${pageNumber} do orçamento`}
                  className="h-[4.75rem] w-[3.4rem] shrink-0 object-cover object-top sm:h-24 sm:w-[4.25rem]"
                  draggable={false}
                />
                <span className="flex min-w-0 flex-1 flex-col justify-center py-1.5 pr-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0066FF]">
                    Página {pageNumber}
                    {(pageCount || pageImages.length) > 0
                      ? ` / ${pageCount || pageImages.length}`
                      : ''}
                  </span>
                  <span className="truncate text-xs font-medium text-[#2a1812]">
                    {selectionLabel || 'Clique para ampliar na pré-visualização'}
                  </span>
                  <span className="text-[10px] text-[#8a7060]">Sempre sincronizada com a lista</span>
                </span>
              </button>
            )}

            {coverage && (
              <div className="mt-2 sm:hidden">
                <CoverageSummary
                  coverage={coverage}
                  auditorNotes={auditorNotes}
                  coverageScope={coverageScope}
                />
              </div>
            )}
            {outOfScopeModules.length > 0 && (
              <>
                <button
                  type="button"
                  className="mt-2 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left text-xs"
                  onClick={() => setShowOutOfScope((v) => !v)}
                >
                  <span className="flex items-center gap-1.5 font-medium text-slate-800">
                    <Ban className="h-3.5 w-3.5 text-slate-500" />
                    Fora do orçamento de marcenaria ({outOfScopeModules.length})
                  </span>
                  {showOutOfScope ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </button>
                {showOutOfScope && (
                  <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2 text-[11px]">
                    <p className="text-slate-500">
                      Pedras, obra e decoração comprada pronta — não entram no valor.
                    </p>
                    {outOfScopeModules.map(({ env, module }) => (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => onSelectModule(module)}
                        className={cn(
                          'block w-full truncate rounded px-1.5 py-1 text-left text-slate-700 hover:bg-slate-100',
                          selection?.kind === 'module' &&
                            selection.module.id === module.id &&
                            'bg-[#0066FF]/10 ring-1 ring-[#0066FF]/35',
                        )}
                      >
                        {module.name}
                        {new Set(outOfScopeModules.map((o) => o.env)).size > 1 && (
                          <span className="text-slate-400"> · {env}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {/* pb-28: espaço para os botões flutuantes (chat do Max / atalhos) */}
            <div className="space-y-2 p-3 pb-28">
              <PriceReviewBanner
                materials={tree.environments.flatMap((e) =>
                  e.modules.filter((m) => !m.out_of_scope).flatMap((m) => m.materials),
                )}
              />
              {tree.environments.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Nenhum ambiente nesta análise.
                </p>
              )}
              {tree.environments.map((env) => {
                const envOpen = expandedEnvs.has(env.id)
                const scopedModules = env.modules.filter((m) => !m.out_of_scope)
                if (!scopedModules.length) return null
                return (
                  <div key={env.id} className="rounded-xl border border-border/80">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold"
                      onClick={() => {
                        setExpandedEnvs((prev) => {
                          const next = new Set(prev)
                          if (next.has(env.id)) next.delete(env.id)
                          else next.add(env.id)
                          return next
                        })
                      }}
                    >
                      {envOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {env.name}
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        {scopedModules.length} {scopedModules.length === 1 ? 'móvel' : 'móveis'}
                      </Badge>
                    </button>
                    {envOpen && (
                      <div className="space-y-1 border-t border-border/60 px-2 py-2">
                        {scopedModules.map((mod) => {
                          const modOpen = expandedMods.has(mod.id)
                          const selected =
                            selection?.kind === 'module' && selection.module.id === mod.id
                          return (
                            <div key={mod.id} className="rounded-lg">
                              <div
                                className={cn(
                                  'flex items-center gap-1 rounded-lg px-2 py-1.5',
                                  selected && 'bg-[#0066FF]/10 ring-1 ring-[#0066FF]/40',
                                )}
                              >
                                <button
                                  type="button"
                                  className="text-muted-foreground"
                                  onClick={() => {
                                    setExpandedMods((prev) => {
                                      const next = new Set(prev)
                                      if (next.has(mod.id)) next.delete(mod.id)
                                      else next.add(mod.id)
                                      return next
                                    })
                                  }}
                                >
                                  {modOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 text-left"
                                  onClick={() => onSelectModule(mod)}
                                  title="Ver este móvel na pré-visualização"
                                >
                                  <span className="block truncate text-sm font-semibold text-[#2a1812]">
                                    {mod.name}
                                  </span>
                                  <span className="block text-[11px] text-[#8a7060]">
                                    {(() => {
                                      const page = resolveSelectionPage(mod)
                                      const pageLabel = page ? `pág. ${page}` : null
                                      const itemsLabel = `${mod.materials.length} ${
                                        mod.materials.length === 1 ? 'item' : 'itens'
                                      }`
                                      const pending = mod.materials.filter(
                                        (m) =>
                                          !describeMaterial(m).cuttingList &&
                                          describeMaterial(m).priceStatus !== 'ok',
                                      ).length
                                      const sheetGap = mod.materials.some(isUnpricedSheetAggregate)
                                      const billableGap = mod.materials.filter(isBillableUnpriced).length
                                      const pendingLabel = sheetGap
                                        ? 'preço da chapa faltando'
                                        : billableGap
                                          ? `${billableGap} sem preço`
                                          : pending
                                            ? `${pending} ${pending === 1 ? 'preço' : 'preços'} para conferir`
                                            : null
                                      return [pageLabel, itemsLabel, pendingLabel]
                                        .filter(Boolean)
                                        .join(' · ')
                                    })()}
                                  </span>
                                </button>
                                <span className="shrink-0 text-sm font-semibold tabular-nums text-[#2a1812]">
                                  {formatBRL(
                                    mod.materials.reduce((a, m) => a + describeMaterial(m).total, 0),
                                  )}
                                </span>
                              </div>
                              {modOpen && (
                                <div className="ml-4 space-y-0.5 border-l border-[#8d5e22]/15 py-1 pl-2">
                                  {(() => {
                                    const billable = mod.materials.filter(
                                      (m) => !describeMaterial(m).cuttingList,
                                    )
                                    const cutting = mod.materials.filter(
                                      (m) => describeMaterial(m).cuttingList,
                                    )
                                    const ordered = [
                                      ...billable.filter((m) =>
                                        /^chapa\s*[—\-–]/i.test(m.raw_name),
                                      ),
                                      ...billable.filter(
                                        (m) => !/^chapa\s*[—\-–]/i.test(m.raw_name),
                                      ),
                                    ]
                                    return (
                                      <>
                                        {ordered.map((mat) => (
                                          <MaterialRow
                                            key={mat.id}
                                            mat={mat}
                                            selected={
                                              selection?.kind === 'material' &&
                                              selection.material.id === mat.id
                                            }
                                            onSelect={() => onSelectMaterial(mat, mod)}
                                            onEdit={() => openEdit(mat)}
                                            onConfirmPrice={() => void confirmMarketPrice(mat)}
                                          />
                                        ))}
                                        {cutting.length > 0 && (
                                          <div className="mt-1.5 rounded-md border border-dashed border-[#8d5e22]/25 bg-[#f7f4ef]/80 px-2 py-1.5">
                                            <p className="px-0.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#8a7060]">
                                              Peças de corte · {cutting.length} · custo na Chapa
                                              acima
                                            </p>
                                            {cutting.map((mat) => (
                                              <MaterialRow
                                                key={mat.id}
                                                mat={mat}
                                                selected={
                                                  selection?.kind === 'material' &&
                                                  selection.material.id === mat.id
                                                }
                                                onSelect={() => onSelectMaterial(mat, mod)}
                                                onEdit={() => openEdit(mat)}
                                                onConfirmPrice={() =>
                                                  void confirmMarketPrice(mat)
                                                }
                                              />
                                            ))}
                                          </div>
                                        )}
                                        {!mod.materials.length && (
                                          <p className="px-2 py-1 text-[11px] text-muted-foreground">
                                            Nenhum material listado para este móvel.
                                          </p>
                                        )}
                                      </>
                                    )
                                  })()}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </section>

        <AuditCockpit
          className={cn(
            'min-h-0 overflow-hidden',
            'max-lg:hidden',
            'lg:col-span-2 lg:min-h-0',
            'xl:col-span-1',
          )}
          blocks={cockpitBlocks}
          onOpenPromptStudio={() => setPromptStudioOpen(true)}
        />
      </div>

      {/* Editor rápido */}
      {editingMaterial && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-4 shadow-xl">
            <h4 className="text-sm font-semibold text-[#2a1812]">Editar material</h4>
            <p className="mt-1 truncate text-xs text-[#6b5244]">{editingMaterial.raw_name}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs">
                Quantidade usada ({formatQuantity(1, editingMaterial.unit_measure).replace(/^1 /, '')})
                <Input
                  value={editDraft.exact}
                  onChange={(e) => setEditDraft((d) => ({ ...d, exact: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-xs">
                Quantidade a comprar
                <Input
                  value={editDraft.full}
                  onChange={(e) => setEditDraft((d) => ({ ...d, full: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-xs">
                Preço {perUnitLabel(editingMaterial.unit_measure)}
                <Input
                  value={editDraft.price}
                  onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingMaterial(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void saveEdit({ confirmMarket: true })}
              >
                Salvar e marcar como conferido
              </Button>
              <Button type="button" onClick={() => void saveEdit()}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      {tree ? (
        <PricingAdjustmentsDialog
          open={pricingAdjustOpen}
          onOpenChange={setPricingAdjustOpen}
          tree={tree}
          value={pricingParams}
          onChange={setPricingParams}
        />
      ) : null}

      <ExplainCorrectionModal
        open={explainOpen}
        onOpenChange={setExplainOpen}
        companyId={companyId}
        contextLabel={explainContext}
      />

      <CompanyMemoriesModal
        open={memoriesOpen}
        onOpenChange={setMemoriesOpen}
        companyId={companyId}
      />

      <PromptStudioModal
        open={promptStudioOpen}
        onOpenChange={setPromptStudioOpen}
        companyId={companyId}
      />

      <AuditChatWidget
        companyId={companyId}
        analysisId={analysisId}
        selectionSummary={selectionSummary}
      />
    </div>
  )
}
