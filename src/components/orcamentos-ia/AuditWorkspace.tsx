import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
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
import PdfJsWorker from '@/lib/pdf-js-worker-entry.ts?worker'
import {
  getSignedPdfUrl,
  getSignedPageImageUrl,
  loadQuoteAnalysisTree,
  updateQuoteMaterial,
  type QuoteAnalysisDetail,
  type QuoteBoundingBox,
  type QuoteMaterialRow,
  type QuoteModuleRow,
} from '@/lib/orcamentos-ia/quote-tree'
import { ExplainCorrectionModal } from '@/components/orcamentos-ia/ExplainCorrectionModal'
import { AuditChatWidget } from '@/components/orcamentos-ia/AuditChatWidget'
import { CompanyMemoriesModal } from '@/components/orcamentos-ia/CompanyMemoriesModal'
import { reprocessOrcamentosIaPipeline } from '@/lib/orcamentos-ia/pipeline'
import type { CoverageReport } from '@/lib/orcamentos-ia/merge-extraction'
import {
  buildShoppingList,
  calculateQuotePricing,
  CONTINGENCY_PRICE_WARNING,
  DEFAULT_PRICING_PARAMS,
  formatBRL,
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

/** Extrai o nº da página de paths como `…/pages/page-009.png`. */
function pageNumberFromImagePath(path: string | null | undefined): number | null {
  if (!path) return null
  const match = path.match(/page-(\d+)\.(?:png|jpe?g|webp)$/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n >= 1 ? n : null
}

function resolveSelectionPage(
  module: QuoteModuleRow,
  material?: QuoteMaterialRow | null,
): number | null {
  const fromBox =
    material?.bounding_box?.page ?? module.bounding_box?.page ?? module.page_number ?? null
  if (fromBox && fromBox >= 1) return fromBox
  return (
    pageNumberFromImagePath(material?.page_image_path) ??
    pageNumberFromImagePath(module.page_image_path)
  )
}

let pdfWorker: Worker | null = null
function ensurePdfWorker() {
  if (pdfWorker) return
  pdfWorker = new PdfJsWorker()
  GlobalWorkerOptions.workerPort = pdfWorker
}

interface AuditWorkspaceProps {
  analysisId: string
  companyId: string
  onBack?: () => void
}

type Selection =
  | { kind: 'module'; module: QuoteModuleRow }
  | { kind: 'material'; material: QuoteMaterialRow; module: QuoteModuleRow }
  | null

export function AuditWorkspace({ analysisId, companyId, onBack }: AuditWorkspaceProps) {
  const [tree, setTree] = useState<QuoteAnalysisDetail | null>(null)
  const [loading, setLoading] = useState(true)
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
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [showCoverage, setShowCoverage] = useState(true)
  const [showOutOfScope, setShowOutOfScope] = useState(false)
  const [memoriesOpen, setMemoriesOpen] = useState(false)
  const [pageThumbUrl, setPageThumbUrl] = useState<string | null>(null)
  /** true = tela grande mostra a PNG da página (miniatura ampliada); false = PDF. */
  const [preferPageImage, setPreferPageImage] = useState(false)
  const mainViewerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)

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
    const hasZeroPrices = flatMats.some((m) => !(Number(m.unit_price) > 0))

    if (data.status === 'COMPLETED' && hasZeroPrices) {
      const repriced = await repriceZeroMaterials({
        companyId: data.company_id,
        materials: flatMats,
      })
      if (repriced.error) {
        toast.error(`Falha ao preencher preços zerados: ${repriced.error}`)
      } else if (repriced.updated > 0) {
        toast.message(
          `${repriced.updated} item(ns) com preço R$ 0,00 foram preenchidos (estoque/mercado/contingência).`,
        )
        const byId = new Map(repriced.materials.map((m) => [m.id, m]))
        treeData = {
          ...data,
          environments: data.environments.map((env) => ({
            ...env,
            modules: env.modules.map((mod) => ({
              ...mod,
              materials: mod.materials.map((m) => byId.get(m.id) ?? m),
            })),
          })),
        }
      }
    }

    setTree(treeData)
    setExpandedEnvs(new Set(treeData.environments.map((e) => e.id)))
    setExpandedMods(
      new Set(treeData.environments.flatMap((e) => e.modules.map((m) => m.id))),
    )

    if (treeData.source_pdf_path) {
      const signed = await getSignedPdfUrl(treeData.source_pdf_path)
      if (signed.url) setPdfUrl(signed.url)
      else toast.error(signed.error || 'PDF não encontrado no Storage.')
    }
    setLoading(false)
  }, [analysisId])

  useEffect(() => {
    void reload()
  }, [reload])

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
              if (mod.bounding_box?.page) setPageNumber(mod.bounding_box.page)
              return
            }
            const mat = mod.materials.find((m) => m.id === msg.selectionId)
            if (mat) {
              setSelection({ kind: 'material', material: mat, module: mod })
              const page = mat.bounding_box?.page ?? mod.bounding_box?.page
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
      const data = await res.arrayBuffer()
      const pdf = await getDocument({ data }).promise
      if (cancelled) {
        await pdf.destroy()
        return
      }
      pdfRef.current = pdf
      setPageCount(pdf.numPages)
      setPageNumber(1)
    })().catch((err) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir PDF')
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

  const selectionSummary = useMemo(() => {
    if (!selection) return undefined
    if (selection.kind === 'module') {
      return `Módulo "${selection.module.name}"`
    }
    return `Material "${selection.material.raw_name}" no módulo "${selection.module.name}" (cat=${selection.material.category}, qtd=${selection.material.exact_quantity}, preço=${selection.material.unit_price})`
  }, [selection])

  const selectedPageImagePath = useMemo(() => {
    if (!selection) return null
    if (selection.kind === 'material') {
      return (
        selection.material.page_image_path ||
        selection.module.page_image_path ||
        null
      )
    }
    return selection.module.page_image_path || null
  }, [selection])

  useEffect(() => {
    let cancelled = false
    setPageThumbUrl(null)
    if (!selectedPageImagePath) {
      setPreferPageImage(false)
      return
    }
    void (async () => {
      const { url } = await getSignedPageImageUrl(selectedPageImagePath)
      if (!cancelled && url) {
        setPageThumbUrl(url)
        // Ao selecionar item com página, já abre na tela grande
        setPreferPageImage(true)
        const page = pageNumberFromImagePath(selectedPageImagePath)
        if (page) {
          setPageNumber(page)
          broadcast({ type: 'page', page })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedPageImagePath, broadcast])

  const showPageOnMainViewer = useCallback(() => {
    if (!pageThumbUrl) return
    setPreferPageImage(true)
    setPan({ x: 0, y: 0 })
    setZoom(1)
    const page =
      (selection?.kind === 'material'
        ? resolveSelectionPage(selection.module, selection.material)
        : selection?.kind === 'module'
          ? resolveSelectionPage(selection.module)
          : null) ?? pageNumberFromImagePath(selectedPageImagePath)
    if (page) {
      setPageNumber(page)
      broadcast({ type: 'page', page })
    }
    mainViewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [pageThumbUrl, selection, selectedPageImagePath, broadcast])

  const pricing = useMemo(
    () => (tree ? calculateQuotePricing(tree, pricingParams) : null),
    [tree, pricingParams],
  )

  const shoppingList = useMemo(
    () =>
      tree
        ? buildShoppingList(tree, { sheetLossPct: pricingParams.sheetLossPct })
        : [],
    [tree, pricingParams.sheetLossPct],
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
    return raw as CoverageReport
  }, [tree])

  const handleReprocess = async () => {
    if (reprocessing) return
    const ok = window.confirm(
      'Reprocessar este PDF com o novo motor (inventário + lotes)? A lista atual de ambientes/itens será substituída.',
    )
    if (!ok) return
    setReprocessing(true)
    toast.message('Reprocessando PDF… isso pode levar alguns minutos.')
    const result = await reprocessOrcamentosIaPipeline({ analysisId, companyId })
    setReprocessing(false)
    if (!result.ok) {
      toast.error(result.error || 'Falha ao reprocessar.')
      return
    }
    toast.success(
      `Reprocessamento concluído${result.materialsSaved != null ? ` (${result.materialsSaved} materiais)` : ''}.`,
    )
    await reload()
  }

  // Render canvas 200 DPI + zoom
  useEffect(() => {
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
      await page.render({ canvas, viewport }).promise
    })().catch(() => {
      /* página inválida */
    })
    return () => {
      cancelled = true
    }
  }, [pageNumber, zoom, pageCount, pdfUrl])

  const onSelectModule = (module: QuoteModuleRow) => {
    setSelection({ kind: 'module', module })
    const page = resolveSelectionPage(module)
    if (page) {
      setPageNumber(page)
      broadcast({ type: 'page', page })
    }
    if (module.page_image_path) setPreferPageImage(true)
    broadcast({ type: 'select', selectionId: module.id })
  }

  const onSelectMaterial = (material: QuoteMaterialRow, module: QuoteModuleRow) => {
    setSelection({ kind: 'material', material, module })
    const page = resolveSelectionPage(module, material)
    if (page) {
      setPageNumber(page)
      broadcast({ type: 'page', page })
    }
    if (material.page_image_path || module.page_image_path) setPreferPageImage(true)
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
    window.open(url, 'orcamentos-ia-popout', 'width=1200,height=900,menubar=no,toolbar=no')
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

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[520px] flex-col gap-3 rounded-2xl bg-[#f7f4ef] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Audit Workspace</h2>
          <p className="text-xs text-slate-600">
            PDF a {PDF_DPI} DPI · highlight {HIGHLIGHT} · sync lista ↔ planta
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Modalidades MPC */}
          <div className="flex rounded-lg border border-border p-0.5">
            {(Object.keys(PRICING_MODALITY_LABEL) as PricingModality[]).map((key) => (
              <button
                key={key}
                type="button"
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
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              MPC
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
              N
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
          {pricingParams.modality === 'per_sqm' && (
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              R$/m²
              <Input
                type="number"
                className="h-7 w-20 text-xs"
                value={pricingParams.pricePerSqm}
                onChange={(e) =>
                  setPricingParams((p) => ({
                    ...p,
                    pricePerSqm: Number(e.target.value) || 0,
                  }))
                }
              />
            </label>
          )}
          {pricing && (
            <div className="hidden rounded-lg border border-[#0066FF]/30 bg-[#0066FF]/5 px-3 py-1 text-right sm:block">
              <p className="text-[10px] text-muted-foreground">{pricing.formulaLabel}</p>
              <p className="text-sm font-semibold tabular-nums text-[#0066FF]">
                {formatBRL(pricing.salePrice)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Custo {formatBRL(pricing.materialsCost)}
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
            onClick={() => void handleReprocess()}
            disabled={reprocessing}
          >
            {reprocessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Reprocessar PDF
          </Button>
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
            Dual Monitor
          </Button>
        </div>
      </div>

      {showShoppingList && (
        <div className="max-h-48 overflow-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-2 py-2 font-medium">Exato</th>
                <th className="px-2 py-2 font-medium">Compra</th>
                <th className="px-2 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {shoppingList.map((row) => (
                <tr key={row.key} className="border-b border-border/50">
                  <td className="px-3 py-1.5 font-medium">{row.name}</td>
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                    {row.exactQuantity} {row.exactUnit}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {row.purchaseQuantity} {row.purchaseUnit}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{formatBRL(row.lineTotal)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{row.notes}</td>
                </tr>
              ))}
              {!shoppingList.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                    Sem itens para consolidar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        {/* Esquerda: PDF */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={pageNumber <= 1}
              onClick={() => {
                const p = Math.max(1, pageNumber - 1)
                setPageNumber(p)
                setPreferPageImage(false)
                broadcast({ type: 'page', page: p })
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[5rem] text-center text-xs tabular-nums">
              {pageNumber} / {pageCount || '—'}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={pageNumber >= pageCount}
              onClick={() => {
                const p = Math.min(pageCount, pageNumber + 1)
                setPageNumber(p)
                setPreferPageImage(false)
                broadcast({ type: 'page', page: p })
              }}
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

          <div
            ref={mainViewerRef}
            className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-[#eef1f5] active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className="absolute left-1/2 top-1/2"
              style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))` }}
            >
              <div
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
                    className="block max-h-[min(78vh,1100px)] w-auto max-w-[min(92vw,900px)] object-contain"
                    draggable={false}
                  />
                ) : (
                  <canvas ref={canvasRef} className="block max-w-none" />
                )}
                {activeBbox && (activeBbox.page ?? pageNumber) === pageNumber && (
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                  >
                    <rect
                      x={activeBbox.x}
                      y={activeBbox.y}
                      width={activeBbox.width}
                      height={activeBbox.height}
                      fill={`${HIGHLIGHT}22`}
                      stroke={HIGHLIGHT}
                      strokeWidth={0.008}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Direita: árvore */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Insumos extraídos</h3>
            {pageThumbUrl && (
              <button
                type="button"
                onClick={showPageOnMainViewer}
                className={cn(
                  'mt-2 w-full overflow-hidden rounded-lg border bg-slate-50 text-left transition',
                  preferPageImage
                    ? 'border-[#0066FF] ring-2 ring-[#0066FF]/25'
                    : 'border-[#0066FF]/30 hover:border-[#0066FF]/60',
                )}
                title="Abrir esta página na tela grande"
              >
                <p className="px-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#0066FF]">
                  Página de origem · clique para ampliar
                </p>
                <img
                  src={pageThumbUrl}
                  alt="Página do orçamento"
                  className="max-h-36 w-full object-contain object-top"
                  draggable={false}
                />
              </button>
            )}
            {coverage && (
              <button
                type="button"
                className="mt-2 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left text-xs"
                onClick={() => setShowCoverage((v) => !v)}
              >
                <span className="font-medium text-slate-800">
                  Cobertura {coverage.coveredCount}/{coverage.expectedCount || coverage.extracted.length}
                </span>
                {showCoverage ? (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                )}
              </button>
            )}
            {coverage && showCoverage && (
              <div className="mt-2 space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-[11px]">
                {coverage.missing?.length ? (
                  <>
                    <p className="flex items-center gap-1 font-semibold text-amber-900">
                      <AlertTriangle className="h-3 w-3" />
                      Faltando no inventário
                    </p>
                    {coverage.missing.map((m, i) => (
                      <p key={`miss-${i}`} className="text-amber-800">
                        {m.environment} → {m.module}
                      </p>
                    ))}
                  </>
                ) : (
                  <p className="flex items-center gap-1 font-medium text-emerald-800">
                    <Check className="h-3 w-3" />
                    Todos os módulos do inventário estão na árvore
                  </p>
                )}
                {coverage.extracted?.length > 0 && (
                  <div className="border-t border-amber-200/80 pt-1.5">
                    <p className="mb-1 font-semibold text-slate-700">Extraídos</p>
                    {coverage.extracted.map((m, i) => (
                      <p key={`ext-${i}`} className="text-slate-600">
                        {m.environment} → {m.module}
                      </p>
                    ))}
                  </div>
                )}
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
                    Fora do Escopo ({outOfScopeModules.length}) · sem custo
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
                      Marmoraria, obra civil e decoração — cotados por terceiros.
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
                        {env} → {module.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Ambientes → Módulos → Materiais (consumo exato × compras inteiras)
            </p>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-2 p-3">
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
                        {scopedModules.length} mód.
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
                                  className="flex-1 truncate text-left text-sm font-medium"
                                  onClick={() => onSelectModule(mod)}
                                >
                                  {mod.name}
                                </button>
                              </div>
                              {modOpen && (
                                <div className="ml-4 space-y-1 border-l border-border/50 pl-2 py-1">
                                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                                    <span>Material</span>
                                    <span>Exato</span>
                                    <span>Compra</span>
                                  </div>
                                  {mod.materials.map((mat) => {
                                    const matSelected =
                                      selection?.kind === 'material' &&
                                      selection.material.id === mat.id
                                    return (
                                      <div key={mat.id} className="space-y-1">
                                        <button
                                          type="button"
                                          onClick={() => onSelectMaterial(mat, mod)}
                                          onDoubleClick={() => openEdit(mat)}
                                          className={cn(
                                            'grid w-full grid-cols-[1fr_auto_auto] gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/50',
                                            matSelected &&
                                              'bg-[#0066FF]/10 ring-1 ring-[#0066FF]/35',
                                          )}
                                        >
                                          <span className="truncate font-medium">{mat.raw_name}</span>
                                          <span className="tabular-nums text-muted-foreground">
                                            {mat.exact_quantity} {mat.unit_measure}
                                          </span>
                                          <span className="tabular-nums font-medium">
                                            {mat.full_units_quantity}
                                          </span>
                                        </button>
                                        {mat.using_market_price && !mat.market_price_confirmed && (
                                          <div className="mx-1 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-900 dark:text-amber-100">
                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                            <span className="flex-1">
                                              {mat.notes?.includes(CONTINGENCY_PRICE_WARNING)
                                                ? CONTINGENCY_PRICE_WARNING
                                                : 'Preço de mercado'}{' '}
                                              R$ {Number(mat.unit_price).toFixed(2)} — confirme ou
                                              edite (duplo clique).
                                            </span>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              className="h-7 gap-1 text-[11px]"
                                              onClick={() => void confirmMarketPrice(mat)}
                                            >
                                              <Check className="h-3 w-3" />
                                              Confirmar
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              className="h-7 text-[11px]"
                                              onClick={() => openEdit(mat)}
                                            >
                                              Informar custo
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {!mod.materials.length && (
                                    <p className="px-2 py-1 text-[11px] text-muted-foreground">
                                      Sem materiais neste módulo.
                                    </p>
                                  )}
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
      </div>

      {/* Editor rápido */}
      {editingMaterial && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-4 shadow-xl">
            <h4 className="text-sm font-semibold">Editar insumo</h4>
            <p className="mt-1 truncate text-xs text-muted-foreground">{editingMaterial.raw_name}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs">
                Consumo exato
                <Input
                  value={editDraft.exact}
                  onChange={(e) => setEditDraft((d) => ({ ...d, exact: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-xs">
                Compra inteira
                <Input
                  value={editDraft.full}
                  onChange={(e) => setEditDraft((d) => ({ ...d, full: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-xs">
                Preço unitário
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
                Salvar e confirmar preço
              </Button>
              <Button type="button" onClick={() => void saveEdit()}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

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

      <AuditChatWidget
        companyId={companyId}
        analysisId={analysisId}
        selectionSummary={selectionSummary}
      />
    </div>
  )
}
