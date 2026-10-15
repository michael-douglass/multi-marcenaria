import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  Maximize2,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  orcamentoVisualizarNestedClass,
  orcamentoVisualizarOverlayClass,
} from '@/lib/overlay-z-index'
import { cn } from '@/lib/utils'
import { getSignedPdfUrl } from '@/lib/orcamentos-ia/quote-tree'
import { formatPageRanges, parsePageRangeInput } from '@/lib/orcamentos-ia/page-ranges'
import {
  loadProjectPageFullImageUrl,
  loadProjectPageThumbUrls,
  PROJECT_THUMB_WIDTH,
  uploadQuoteProjectThumb,
} from '@/lib/orcamentos-ia/project-page-thumbs'
import {
  loadPdfDocument,
  loadPdfFromFile,
  renderPdfPageFromDocument,
  type PdfPageImage,
} from '@/lib/pdf-render'
import type { PDFDocumentProxy } from 'pdfjs-dist'

const THUMB_WIDTH = PROJECT_THUMB_WIDTH
const PREVIEW_WIDTH = 520
/** JPEG da tela cheia — mais nítido que a grade. */
const FULLSCREEN_JPEG_QUALITY = 0.93

/** Largura alvo em px reais (considera tela retina — sem isso a foto fica mole). */
function fullscreenTargetWidthPx(): number {
  if (typeof window === 'undefined') return 1800
  const cssW = Math.max(window.innerWidth - 112, 900)
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2.5)
  return Math.min(2800, Math.round(cssW * dpr))
}

/** Só data: (render do PDF) conta como nitidez final; Storage pode ser menor que a tela. */
function isFinalSharpSrc(src: string | null | undefined): boolean {
  return Boolean(src && src.startsWith('data:'))
}

function probeImageWidth(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth || 0)
    img.onerror = () => resolve(0)
    img.src = src
  })
}

export interface PageGridSelectorProps {
  /** Pasta no Storage — opcional se localFile for passado. */
  projectId?: string
  companyId?: string
  /** Path no Storage (quote_projects.pdf_url). */
  pdfUrl?: string | null
  /** PDF local — prévia imediata sem esperar upload. */
  localFile?: File | null
  pageCount: number
  budgetedPages?: number[]
  /** pageNumber → rótulo do lote (ex.: "1-15"). */
  batchLabels?: Record<number, string>
  disabled?: boolean
  onConfirm: (pages: number[]) => void
  /** Apagar cotação das páginas já orçadas (e o lote que as cobre). */
  onRemoveBudgeted?: (pages: number[]) => void
  onCancel?: () => void
  className?: string
  /** Título curto acima da grade. */
  title?: string
  /** Texto de apoio. */
  subtitle?: string
}

type FilterMode = 'all' | 'pending' | 'done'

export function PageGridSelector({
  projectId,
  companyId,
  pdfUrl,
  localFile = null,
  pageCount,
  budgetedPages = [],
  batchLabels = {},
  disabled = false,
  onConfirm,
  onRemoveBudgeted,
  onCancel,
  className,
  title = 'Escolher páginas a cotar',
  subtitle,
}: PageGridSelectorProps) {
  const canRemoveBudgeted = typeof onRemoveBudgeted === 'function'
  const budgeted = useMemo(
    () => new Set(budgetedPages.filter((n) => Number.isInteger(n) && n > 0)),
    [budgetedPages],
  )
  const allPages = useMemo(
    () => Array.from({ length: Math.max(0, pageCount) }, (_, i) => i + 1),
    [pageCount],
  )
  const pendingPages = useMemo(
    () => allPages.filter((n) => !budgeted.has(n)),
    [allPages, budgeted],
  )

  const [selected, setSelected] = useState<Set<number>>(new Set())
  /** Páginas já orçadas marcadas para apagar a cotação. */
  const [removeSelected, setRemoveSelected] = useState<Set<number>>(new Set())
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadingLabel, setLoadingLabel] = useState('Preparando prévia…')
  const [error, setError] = useState<string | null>(null)
  const [rangeText, setRangeText] = useState('')
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>(() =>
    budgetedPages.length > 0 ? 'pending' : 'all',
  )
  const [focusPage, setFocusPage] = useState<number | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  /** Página aberta no visualizador em tela cheia (null = fechado). */
  const [fullscreenPage, setFullscreenPage] = useState<number | null>(null)
  const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null)
  const [fullscreenSharp, setFullscreenSharp] = useState(false)
  const [fullscreenLoading, setFullscreenLoading] = useState(false)
  /** Cache hi-res em ref — evita re-disparar o efeito a cada página salva. */
  const fullscreenHiResRef = useRef<Map<number, string>>(new Map())
  /** PDF compartilhado da grade/tela cheia — não baixar de novo a cada seta. */
  const fullscreenPdfRef = useRef<PDFDocumentProxy | null>(null)
  const fullscreenPdfKeyRef = useRef('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSelected(new Set())
    setRemoveSelected(new Set())
    setFocusPage(pendingPages[0] ?? allPages[0] ?? null)
    setLoadingLabel(
      localFile ? 'Gerando prévia do PDF…' : 'Carregando miniaturas já convertidas…',
    )

    void (async () => {
      try {
        const next = new Map<number, string>()
        if (companyId && projectId) {
          setLoadingLabel('Carregando miniaturas já salvas…')
          const existing = await loadProjectPageThumbUrls(companyId, projectId, pageCount)
          if (cancelled) return
          for (const [k, v] of existing) next.set(k, v)
          if (next.size > 0) {
            setThumbs(new Map(next))
            // Já dá para escolher com as miniaturas prontas — resto carrega em fundo.
            setLoading(false)
            if (next.size >= pageCount) {
              setLoadingLabel('')
              return
            }
          }
        }

        const missing = allPages.filter((n) => !next.has(n))
        if (missing.length) {
          setLoadingLabel(
            next.size > 0
              ? `Salvando prévia das ${missing.length} faltante(s)…`
              : `Gerando e salvando prévia de ${missing.length} página(s)…`,
          )
          let pdf: PDFDocumentProxy
          const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
            new Promise<T>((resolve, reject) => {
              const t = window.setTimeout(
                () => reject(new Error(`${label} demorou demais. Clique em Cancelar e envie o PDF de novo.`)),
                ms,
              )
              p.then(
                (v) => {
                  window.clearTimeout(t)
                  resolve(v)
                },
                (e) => {
                  window.clearTimeout(t)
                  reject(e)
                },
              )
            })

          if (localFile) {
            pdf = await withTimeout(loadPdfFromFile(localFile), 45_000, 'Abrir o PDF')
          } else if (pdfUrl) {
            const signed = await getSignedPdfUrl(pdfUrl)
            if (!signed.url) throw new Error(signed.error || 'PDF da pasta indisponível.')
            pdf = await withTimeout(loadPdfDocument(signed.url), 60_000, 'Baixar o PDF')
          } else if (next.size === 0) {
            throw new Error('Nenhum PDF disponível para pré-visualizar.')
          } else {
            if (!cancelled) setLoading(false)
            return
          }
          if (cancelled) return

          // Libera a grade cedo: usuário já interage enquanto as restantes aparecem.
          if (!cancelled) {
            setLoading(false)
            setLoadingLabel('Montando miniaturas… (já pode marcar as páginas)')
          }

          const ordered = [
            ...missing.filter((n) => !budgeted.has(n)),
            ...missing.filter((n) => budgeted.has(n)),
          ]

          const CONCURRENCY = 3
          let cursor = 0
          let done = 0
          const worker = async () => {
            while (cursor < ordered.length) {
              if (cancelled) return
              const pageNumber = ordered[cursor++]
              try {
                const img: PdfPageImage = await renderPdfPageFromDocument(
                  pdf,
                  pageNumber,
                  THUMB_WIDTH,
                )
                next.set(pageNumber, img.src)
                done += 1
                if (!cancelled) {
                  setThumbs(new Map(next))
                  setLoadingLabel(`Prévia ${done}/${ordered.length}… (salvando na pasta)`)
                }
                // Persiste na pasta para a próxima abertura não regenerar.
                if (companyId && projectId) {
                  void uploadQuoteProjectThumb({
                    companyId,
                    projectId,
                    pageNumber,
                    dataUrl: img.src,
                  })
                }
              } catch {
                /* página individual falhou — segue */
              }
            }
          }
          await Promise.all(
            Array.from({ length: Math.min(CONCURRENCY, ordered.length) }, () => worker()),
          )
        }
        if (!cancelled) {
          setThumbs(next)
          setLoading(false)
          setLoadingLabel('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao montar a grade de páginas.')
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    companyId,
    projectId,
    pdfUrl,
    localFile,
    pageCount,
    budgetedPages.join(','),
  ])

  // Prévia grande da página em foco (usa thumb ou render maior sob demanda).
  useEffect(() => {
    if (focusPage == null) {
      setPreviewSrc(null)
      return
    }
    const thumb = thumbs.get(focusPage)
    if (thumb) {
      setPreviewSrc(thumb)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    void (async () => {
      try {
        let pdf: PDFDocumentProxy
        if (localFile) {
          pdf = await loadPdfFromFile(localFile)
        } else if (pdfUrl) {
          const signed = await getSignedPdfUrl(pdfUrl)
          if (!signed.url || cancelled) return
          pdf = await loadPdfDocument(signed.url)
        } else {
          return
        }
        const img = await renderPdfPageFromDocument(pdf, focusPage, PREVIEW_WIDTH)
        if (!cancelled) setPreviewSrc(img.src)
      } catch {
        if (!cancelled) setPreviewSrc(null)
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [focusPage, thumbs, pdfUrl, localFile])

  const visiblePages = useMemo(() => {
    if (filter === 'pending') return pendingPages
    if (filter === 'done') return allPages.filter((n) => budgeted.has(n))
    return allPages
  }, [filter, pendingPages, allPages, budgeted])

  /** Na tela cheia navega por todas as páginas do PDF (não só o filtro). */
  const fullscreenAlbum = allPages
  const fullscreenIndex =
    fullscreenPage != null ? fullscreenAlbum.indexOf(fullscreenPage) : -1
  const canGoPrev = fullscreenIndex > 0
  const canGoNext =
    fullscreenIndex >= 0 && fullscreenIndex < fullscreenAlbum.length - 1

  const openFullscreen = (pageNumber: number) => {
    setFocusPage(pageNumber)
    setFullscreenPage(pageNumber)
  }

  const closeFullscreen = () => {
    setFullscreenPage(null)
    setFullscreenSrc(null)
    setFullscreenSharp(false)
    setFullscreenLoading(false)
    // Mantém o PDF em memória: reabrir a tela cheia já sai nítido.
  }

  // Libera o PDF só ao trocar arquivo ou desmontar a grade.
  useEffect(() => {
    return () => {
      const pdf = fullscreenPdfRef.current
      fullscreenPdfRef.current = null
      fullscreenPdfKeyRef.current = ''
      if (pdf) void pdf.destroy().catch(() => undefined)
    }
  }, [])

  // Ao trocar o PDF da pasta, limpa cache — sem baixar o arquivo inteiro em fundo
  // (PDFs grandes ~80MB competiam com a cotação e geravam "Failed to fetch").
  useEffect(() => {
    const key = localFile
      ? `file:${localFile.name}:${localFile.size}:${localFile.lastModified}`
      : pdfUrl
        ? `url:${pdfUrl}`
        : ''
    if (!key) return
    if (fullscreenPdfKeyRef.current === key && fullscreenPdfRef.current) return
    const prev = fullscreenPdfRef.current
    fullscreenPdfRef.current = null
    fullscreenPdfKeyRef.current = ''
    fullscreenHiResRef.current = new Map()
    if (prev) void prev.destroy().catch(() => undefined)
  }, [localFile, pdfUrl])

  const goFullscreenRelative = (delta: number) => {
    if (fullscreenPage == null) return
    const idx = fullscreenAlbum.indexOf(fullscreenPage)
    if (idx < 0) return
    const next = fullscreenAlbum[idx + delta]
    if (next == null) return
    setFocusPage(next)
    setFullscreenPage(next)
  }

  // Mantém thumbs em ref: o Map muda o tempo todo ao gerar miniaturas
  // e não pode cancelar o render hi-res da tela cheia.
  const thumbsRef = useRef(thumbs)
  thumbsRef.current = thumbs

  // Imagem nítida na tela cheia: pages/ → PDF hi-res. Miniatura NÃO é esticada.
  // Usa "generation" em vez de cancelar o download do PDF (evita ficar eterno embaçado).
  const fullscreenGenRef = useRef(0)
  useEffect(() => {
    if (fullscreenPage == null) {
      setFullscreenSrc(null)
      setFullscreenSharp(false)
      setFullscreenLoading(false)
      return
    }
    const page = fullscreenPage
    const cached = fullscreenHiResRef.current.get(page)
    if (cached && isFinalSharpSrc(cached)) {
      setFullscreenSrc(cached)
      setFullscreenSharp(true)
      setFullscreenLoading(false)
      return
    }

    const thumb = thumbsRef.current.get(page) ?? null
    if (thumb) {
      // Só amplia se já for render final (data:); senão mantém pequena.
      setFullscreenSrc(thumb)
      setFullscreenSharp(isFinalSharpSrc(thumb))
    } else {
      setFullscreenSrc(null)
      setFullscreenSharp(false)
    }

    const gen = ++fullscreenGenRef.current
    setFullscreenLoading(true)
    const targetW = fullscreenTargetWidthPx()

    void (async () => {
      try {
        // 1) pages/ como degrau intermediário (melhor que miniatura 240px).
        if (companyId && projectId) {
          const fullUrl = await loadProjectPageFullImageUrl(
            companyId,
            projectId,
            page,
          )
          if (fullUrl) {
            const w = await probeImageWidth(fullUrl)
            if (gen === fullscreenGenRef.current && w >= 900) {
              setFullscreenSrc(fullUrl)
              setFullscreenSharp(true) // pode ampliar já; o PDF ainda melhora
            }
          }
        }

        // 2) Sempre renderiza do PDF na resolução da tela (nitidez final).
        const pdfKey = localFile
          ? `file:${localFile.name}:${localFile.size}:${localFile.lastModified}`
          : pdfUrl
            ? `url:${pdfUrl}`
            : ''
        if (!pdfKey) {
          if (gen === fullscreenGenRef.current) setFullscreenLoading(false)
          return
        }

        let pdf = fullscreenPdfRef.current
        if (!pdf || fullscreenPdfKeyRef.current !== pdfKey) {
          if (localFile) {
            pdf = await loadPdfFromFile(localFile)
          } else if (pdfUrl) {
            const signed = await getSignedPdfUrl(pdfUrl)
            if (!signed.url) {
              throw new Error(signed.error || 'PDF da pasta indisponível.')
            }
            pdf = await loadPdfDocument(signed.url)
          } else {
            throw new Error('Sem PDF para gerar a prévia nítida.')
          }
          fullscreenPdfRef.current = pdf
          fullscreenPdfKeyRef.current = pdfKey
        }

        const img = await renderPdfPageFromDocument(
          pdf,
          page,
          targetW,
          FULLSCREEN_JPEG_QUALITY,
        )
        fullscreenHiResRef.current.set(page, img.src)
        if (gen === fullscreenGenRef.current) {
          setFullscreenSrc(img.src)
          setFullscreenSharp(true)
          setFullscreenLoading(false)
        }

        // Pré-carrega vizinhança já no tamanho final (data:).
        const neighbors = [page - 1, page + 1].filter(
          (n) => n >= 1 && n <= pageCount && !fullscreenHiResRef.current.has(n),
        )
        for (const n of neighbors) {
          try {
            const warm = await renderPdfPageFromDocument(
              pdf,
              n,
              targetW,
              FULLSCREEN_JPEG_QUALITY,
            )
            fullscreenHiResRef.current.set(n, warm.src)
          } catch {
            /* ignora pré-carga */
          }
        }
      } catch (err) {
        console.error('[PageGridSelector] falha ao gerar tela cheia nítida', err)
        if (gen === fullscreenGenRef.current) {
          setFullscreenLoading(false)
        }
      }
    })()
  }, [fullscreenPage, pdfUrl, localFile, pageCount, companyId, projectId])

  // Setas ← → na tela cheia (Esc fica a cargo do Dialog aninhado).
  useEffect(() => {
    if (fullscreenPage == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        goFullscreenRelative(-1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        goFullscreenRelative(1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreenPage, fullscreenAlbum.join(',')])

  const touchStartX = useRef<number | null>(null)

  const toggle = (pageNumber: number) => {
    if (disabled) return
    setFocusPage(pageNumber)
    if (budgeted.has(pageNumber)) {
      if (!canRemoveBudgeted) return
      setSelected(new Set())
      setRemoveSelected((prev) => {
        const next = new Set(prev)
        if (next.has(pageNumber)) next.delete(pageNumber)
        else next.add(pageNumber)
        return next
      })
      return
    }
    setRemoveSelected(new Set())
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pageNumber)) next.delete(pageNumber)
      else next.add(pageNumber)
      return next
    })
  }

  const selectAllPending = () => {
    setSelected(new Set(pendingPages))
    setRemoveSelected(new Set())
    if (pendingPages[0]) setFocusPage(pendingPages[0])
  }

  const selectAllBudgeted = () => {
    if (!canRemoveBudgeted) return
    const done = allPages.filter((n) => budgeted.has(n))
    setRemoveSelected(new Set(done))
    setSelected(new Set())
    if (done[0]) setFocusPage(done[0])
    setFilter('done')
  }

  const clearSelection = () => {
    setSelected(new Set())
    setRemoveSelected(new Set())
  }

  const applyRangeShortcut = () => {
    const parsed = parsePageRangeInput(rangeText, pageCount)
    if (!parsed.ok) {
      setRangeError(parsed.error)
      return
    }
    const onlyPending = parsed.pages.filter((p) => !budgeted.has(p))
    const onlyBudgeted = parsed.pages.filter((p) => budgeted.has(p))
    if (canRemoveBudgeted && onlyBudgeted.length && !onlyPending.length) {
      setRangeError(null)
      setRemoveSelected(new Set(onlyBudgeted))
      setSelected(new Set())
      setFocusPage(onlyBudgeted[0])
      setFilter('done')
      return
    }
    if (!onlyPending.length) {
      setRangeError(
        canRemoveBudgeted
          ? 'Digite páginas pendentes para cotar, ou só páginas já orçadas para apagar a cotação.'
          : 'Essas páginas já foram orçadas. Escolha páginas pendentes.',
      )
      return
    }
    setRangeError(null)
    setSelected(new Set(onlyPending))
    setRemoveSelected(new Set())
    setFocusPage(onlyPending[0])
    setFilter('pending')
  }

  const selectedCount = selected.size
  const removeCount = removeSelected.size
  const orderedSelected = useMemo(
    () => [...selected].sort((a, b) => a - b),
    [selected],
  )
  const orderedRemove = useMemo(
    () => [...removeSelected].sort((a, b) => a - b),
    [removeSelected],
  )

  return (
    <div
      className={cn(
        'space-y-3 rounded-2xl border border-[#0066FF]/25 bg-[#0066FF]/[0.04] p-3 sm:p-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p
            className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}
          >
            <FileText className="h-4 w-4 text-[#0066FF]" />
            {title}
          </p>
          <p className="text-xs text-muted-foreground">
            {subtitle ||
              (canRemoveBudgeted
                ? 'Azul = cotar · Vermelho nas verdes = apagar cotação daquelas páginas (o lote inteiro some).'
                : 'Clique nas miniaturas para marcar. Verde = já orçada · Azul = selecionada.')}
            {' · '}
            {budgeted.size}/{pageCount} já cotada{budgeted.size === 1 ? '' : 's'} ·{' '}
            {pendingPages.length} pendente{pendingPages.length === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={disabled || pendingPages.length === 0}
            onClick={selectAllPending}
          >
            Todas pendentes
          </Button>
          {canRemoveBudgeted && budgeted.size > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={selectAllBudgeted}
            >
              Todas orçadas
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={disabled || (selectedCount === 0 && removeCount === 0)}
            onClick={clearSelection}
          >
            Limpar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['pending', `Pendentes (${pendingPages.length})`],
            ['done', `Já orçadas (${budgeted.size})`],
            ['all', `Todas (${pageCount})`],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={filter === key ? 'default' : 'outline'}
            className={cn(
              'h-8 text-xs',
              filter === key && 'bg-[#0066FF] hover:bg-[#0052cc]',
            )}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]">
        {loadingLabel && !loading ? (
        <p className="flex items-center gap-2 text-[11px] text-[#0066FF]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {loadingLabel} — você já pode marcar as que aparecerem.
        </p>
      ) : null}

      <ScrollArea className="h-[min(56vh,480px)] rounded-xl border border-border/60 bg-white">
          <div className="p-3">
            {loading && thumbs.size === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-[#0066FF]" />
                <p className="text-sm">{loadingLabel || 'Preparando prévia…'}</p>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
                {error}
              </div>
            )}
            {!error && !loading && visiblePages.length === 0 && thumbs.size === 0 && (
              <p className="py-14 text-center text-sm text-muted-foreground">
                Nenhuma página neste filtro.
              </p>
            )}
            {!error && visiblePages.length > 0 && (!loading || thumbs.size > 0) && (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {visiblePages.map((pageNumber) => {
                  const done = budgeted.has(pageNumber)
                  const isOn = selected.has(pageNumber)
                  const isRemove = removeSelected.has(pageNumber)
                  const isFocus = focusPage === pageNumber
                  const src = thumbs.get(pageNumber)
                  const label = batchLabels[pageNumber]
                  const doneLocked = done && !canRemoveBudgeted
                  return (
                    <div
                      key={pageNumber}
                      onMouseEnter={() => setFocusPage(pageNumber)}
                      className={cn(
                        'group relative overflow-hidden rounded-xl border-2 text-left transition-all',
                        done &&
                          !isRemove &&
                          'border-emerald-500/70 bg-emerald-50/80',
                        done &&
                          isRemove &&
                          'border-destructive ring-2 ring-destructive/40 bg-destructive/10',
                        done && canRemoveBudgeted && 'hover:border-destructive/60',
                        !done && isOn && 'border-[#0066FF] ring-2 ring-[#0066FF]/35',
                        !done &&
                          !isOn &&
                          'border-border/50 bg-white hover:border-[#0066FF]/45',
                        isFocus && (!done || canRemoveBudgeted) && 'shadow-md',
                      )}
                    >
                      <button
                        type="button"
                        disabled={disabled || doneLocked}
                        onClick={() => toggle(pageNumber)}
                        aria-pressed={done ? isRemove : isOn}
                        title={
                          done
                            ? canRemoveBudgeted
                              ? `Já orçada${label ? ` · lote ${label}` : ''} — clique para ${isRemove ? 'desmarcar' : 'marcar'} e apagar cotação`
                              : `Já orçada${label ? ` · lote ${label}` : ''}`
                            : `Página ${pageNumber} — clique para ${isOn ? 'desmarcar' : 'selecionar'}`
                        }
                        className={cn(
                          'block w-full text-left',
                          done && !canRemoveBudgeted && 'cursor-default',
                          (!done || canRemoveBudgeted) && 'cursor-pointer',
                        )}
                      >
                      {src ? (
                        <img
                          src={src}
                          alt={`Página ${pageNumber}`}
                          className="aspect-[3/4] w-full bg-white object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 bg-slate-100 text-xs text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin opacity-50" />
                          Pág. {pageNumber}
                        </div>
                      )}
                      <span
                        className={cn(
                          'absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-md border px-1 text-[11px] font-bold shadow',
                          done &&
                            isRemove &&
                            'border-destructive bg-destructive text-white',
                          done &&
                            !isRemove &&
                            'border-emerald-600 bg-emerald-600 text-white',
                          !done && isOn && 'border-[#0066FF] bg-[#0066FF] text-white',
                          !done && !isOn && 'border-white/50 bg-black/60 text-white',
                        )}
                      >
                        {done && isRemove ? (
                          <Trash2 className="h-3.5 w-3.5" />
                        ) : done || isOn ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          pageNumber
                        )}
                      </span>
                      {done && (
                        <span
                          className={cn(
                            'absolute bottom-1.5 left-1.5 right-1.5 truncate rounded px-1 py-0.5 text-center text-[10px] font-medium text-white',
                            isRemove ? 'bg-destructive/95' : 'bg-emerald-700/90',
                          )}
                        >
                          {isRemove
                            ? 'Apagar'
                            : label
                              ? `Lote ${label}`
                              : 'Concluído'}
                        </span>
                      )}
                      </button>
                      <button
                        type="button"
                        title="Abrir em tela cheia"
                        aria-label={`Abrir página ${pageNumber} em tela cheia`}
                        className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-white/40 bg-black/55 text-white shadow transition hover:bg-black/75"
                        onPointerDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          openFullscreen(pageNumber)
                        }}
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        <aside className="flex min-h-[220px] flex-col gap-2 rounded-xl border border-border/60 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Eye className="h-3.5 w-3.5 text-[#0066FF]" />
              Pré-visualização
              {focusPage != null ? ` · pág. ${focusPage}` : ''}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              disabled={focusPage == null}
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (focusPage != null) openFullscreen(focusPage)
              }}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Tela cheia
            </Button>
          </div>
          <button
            type="button"
            disabled={focusPage == null || !previewSrc}
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (focusPage != null) openFullscreen(focusPage)
            }}
            title={
              focusPage != null
                ? 'Clique para ver em tela cheia'
                : 'Escolha uma página'
            }
            className="relative flex min-h-[200px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-200 bg-slate-50 disabled:cursor-default"
          >
            {previewLoading && (
              <Loader2 className="absolute h-6 w-6 animate-spin text-[#0066FF]" />
            )}
            {previewSrc ? (
              <img
                src={previewSrc}
                alt={focusPage != null ? `Prévia página ${focusPage}` : 'Prévia'}
                className="max-h-[min(48vh,420px)] w-full object-contain"
              />
            ) : (
              <p className="px-4 text-center text-xs text-muted-foreground">
                Passe o mouse ou clique numa miniatura para ampliar.
              </p>
            )}
          </button>
          {focusPage != null && !budgeted.has(focusPage) ? (
            <Button
              type="button"
              size="sm"
              variant={selected.has(focusPage) ? 'outline' : 'default'}
              className={cn(
                'w-full',
                !selected.has(focusPage) && 'bg-[#0066FF] hover:bg-[#0052cc]',
              )}
              disabled={disabled}
              onClick={() => toggle(focusPage)}
            >
              {selected.has(focusPage) ? 'Desmarcar esta página' : 'Selecionar esta página'}
            </Button>
          ) : focusPage != null && budgeted.has(focusPage) && canRemoveBudgeted ? (
            <Button
              type="button"
              size="sm"
              variant={removeSelected.has(focusPage) ? 'outline' : 'destructive'}
              className="w-full"
              disabled={disabled}
              onClick={() => toggle(focusPage)}
            >
              {removeSelected.has(focusPage)
                ? 'Desmarcar (não apagar)'
                : 'Marcar para apagar cotação'}
            </Button>
          ) : focusPage != null && budgeted.has(focusPage) ? (
            <p className="text-center text-[11px] text-emerald-700">
              Esta página já foi orçada
              {batchLabels[focusPage] ? ` (lote ${batchLabels[focusPage]})` : ''}.
            </p>
          ) : null}
        </aside>
      </div>

      <div className="space-y-2">
        <Label htmlFor="page-grid-range" className="text-xs font-medium">
          Atalho: digitar intervalo
          {canRemoveBudgeted ? ' (pendentes = cotar · orçadas = apagar)' : ' (só páginas pendentes)'}
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="page-grid-range"
            value={rangeText}
            disabled={disabled}
            placeholder="ex.: 16-30, 35"
            className="max-w-xs"
            onChange={(e) => {
              setRangeText(e.target.value)
              setRangeError(null)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !rangeText.trim()}
            onClick={applyRangeShortcut}
          >
            Aplicar
          </Button>
        </div>
        {rangeError ? (
          <p className="text-xs text-destructive" role="alert">
            {rangeError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
        <p className="min-w-0 flex-1 text-xs font-medium text-foreground/80">
          {removeCount > 0 ? (
            <>
              Vai apagar a cotação de{' '}
              <strong className="font-semibold text-destructive">
                {removeCount} página{removeCount === 1 ? '' : 's'}
              </strong>
              {' — '}
              {formatPageRanges(orderedRemove)}
              {' (o lote que cobre essas páginas some por completo).'}
            </>
          ) : selectedCount > 0 ? (
            <>
              Vai cotar{' '}
              <strong className="font-semibold text-[#0066FF]">
                {selectedCount} página{selectedCount === 1 ? '' : 's'}
              </strong>
              {' — '}
              {formatPageRanges(orderedSelected)}
              {selectedCount > 20 ? ' (só estas; não o PDF inteiro)' : null}
            </>
          ) : (
            canRemoveBudgeted
              ? 'Marque páginas brancas para cotar, ou verdes para apagar a cotação delas.'
              : 'Selecione ao menos 1 página pendente nas miniaturas.'
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {onCancel && (
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onCancel}>
              Cancelar
            </Button>
          )}
          {removeCount > 0 && onRemoveBudgeted ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={disabled}
              onClick={() => onRemoveBudgeted(orderedRemove)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Apagar cotação · {removeCount} pág.
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={disabled || selectedCount < 1}
              className="bg-[#0066FF] text-white hover:bg-[#0052cc]"
              onClick={() => onConfirm(orderedSelected)}
            >
              {selectedCount > 0
                ? `Iniciar cotação · ${selectedCount} pág.`
                : 'Iniciar cotação'}
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={fullscreenPage != null}
        onOpenChange={(open) => {
          if (!open) closeFullscreen()
        }}
      >
        <DialogContent
          nested
          overlayClassName={cn(orcamentoVisualizarOverlayClass, '!bg-black/92')}
          className={cn(
            orcamentoVisualizarNestedClass,
            // Anula o card central do Dialog: ocupa a janela inteira.
            '!fixed !inset-0 !left-0 !top-0 flex !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden !rounded-none border-0 !bg-black p-0 text-white shadow-none sm:!rounded-none',
            'data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100',
            // Esconde o X padrão do DialogContent — usamos o da barra.
            '[&>button.absolute]:hidden',
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">
            Página {fullscreenPage ?? ''} em tela cheia
          </DialogTitle>

          <header className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-5">
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-semibold tracking-wide">
                Página {fullscreenPage}
                <span className="ml-2 font-normal text-white/60">
                  {(fullscreenIndex >= 0 ? fullscreenIndex : 0) + 1} /{' '}
                  {fullscreenAlbum.length}
                </span>
              </p>
              <p className="text-[11px] text-white/55">
                Clique nas setas ou use ← → · Esc para fechar
                {fullscreenPage != null && budgeted.has(fullscreenPage)
                  ? ' · já orçada'
                  : fullscreenPage != null && selected.has(fullscreenPage)
                    ? ' · selecionada para cotar'
                    : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {fullscreenPage != null && !budgeted.has(fullscreenPage) ? (
                <Button
                  type="button"
                  size="sm"
                  variant={selected.has(fullscreenPage) ? 'outline' : 'default'}
                  className={cn(
                    'h-8 border-white/30 text-xs',
                    !selected.has(fullscreenPage) &&
                      'bg-[#0066FF] text-white hover:bg-[#0052cc]',
                    selected.has(fullscreenPage) &&
                      'bg-transparent text-white hover:bg-white/10',
                  )}
                  disabled={disabled}
                  onClick={() => toggle(fullscreenPage)}
                >
                  {selected.has(fullscreenPage) ? 'Desmarcar' : 'Selecionar'}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 text-white hover:bg-white/15 hover:text-white"
                onClick={closeFullscreen}
                aria-label="Fechar tela cheia"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </header>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center"
            onTouchStart={(e) => {
              touchStartX.current = e.changedTouches[0]?.clientX ?? null
            }}
            onTouchEnd={(e) => {
              const start = touchStartX.current
              touchStartX.current = null
              if (start == null) return
              const end = e.changedTouches[0]?.clientX
              if (end == null) return
              const dx = end - start
              if (Math.abs(dx) < 48) return
              if (dx > 0) goFullscreenRelative(-1)
              else goFullscreenRelative(1)
            }}
          >
            <button
              type="button"
              disabled={!canGoPrev}
              aria-label="Página anterior"
              className="absolute left-2 top-1/2 z-30 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-[#0066FF] text-white shadow-lg transition hover:bg-[#0052cc] disabled:pointer-events-none disabled:opacity-30 sm:left-4"
              onPointerDown={(e) => {
                // pointerdown: evita o Dialog pai “comer” o clique.
                e.preventDefault()
                e.stopPropagation()
                if (!canGoPrev) return
                goFullscreenRelative(-1)
              }}
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            <div className="relative flex h-full min-h-0 w-full flex-1 items-center justify-center px-16 sm:px-20">
              {fullscreenSrc ? (
                <img
                  key={fullscreenSrc.slice(0, 80)}
                  src={fullscreenSrc}
                  alt={`Página ${fullscreenPage} em tela cheia`}
                  className={cn(
                    'object-contain select-none transition-[filter,opacity] duration-200',
                    fullscreenSharp
                      ? 'h-[calc(100dvh-4.5rem)] w-auto max-w-[calc(100vw-7rem)]'
                      : // Miniatura: NÃO esticar — evita o “embaçado” em tela cheia.
                        'max-h-[42vh] max-w-[min(70vw,380px)] opacity-80',
                  )}
                  draggable={false}
                />
              ) : (
                <p className="text-sm text-white/60">Carregando página nítida…</p>
              )}
              {fullscreenLoading || !fullscreenSharp ? (
                <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[11px] text-white shadow">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0066FF]" />
                  Gerando versão nítida… (1ª vez pode levar alguns segundos)
                </div>
              ) : null}
            </div>

            <button
              type="button"
              disabled={!canGoNext}
              aria-label="Próxima página"
              className="absolute right-2 top-1/2 z-30 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-[#0066FF] text-white shadow-lg transition hover:bg-[#0052cc] disabled:pointer-events-none disabled:opacity-30 sm:right-4"
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (!canGoNext) return
                goFullscreenRelative(1)
              }}
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
