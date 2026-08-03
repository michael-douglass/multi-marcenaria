import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Camera,
  Circle,
  Eraser,
  HelpCircle,
  Loader2,
  Maximize2,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  RectangleHorizontal,
  Ruler,
  Save,
  Slash,
  Trash2,
  Type,
  Undo2,
  Redo2,
  Upload,
  Armchair,
  X,
  MessageSquareText,
  Expand,
  Shrink,
} from 'lucide-react'
import { useObraLousa } from '@/hooks/useObraLousa'
import { useObraLousaViewport } from '@/hooks/useObraLousaViewport'
import { useObraLousaHistory } from '@/hooks/useObraLousaHistory'
import { OBRA_LOUSA_MAX_BYTES, isAcceptedLousaImage } from '@/lib/obra-lousa'
import {
  parsePathData,
  distance,
  offsetAnnotation,
  lousaInkScale,
  lousaWorldStroke,
  type FurnitureModuleType,
  type Point,
  type WhiteboardAnnotation,
} from '@/lib/obra-lousa-annotations'
import { FURNITURE_CATALOG } from '@/lib/obra-lousa-furniture'
import {
  ObraLousaAnnotationsLayer,
  buildEllipse,
  buildFurniture,
  buildLine,
  buildMeasure,
  buildRect,
  buildText,
} from '@/components/obras/lousa/ObraLousaAnnotationsLayer'
import { cn } from '@/lib/utils'

export type LousaTool =
  | 'select'
  | 'pencil'
  | 'eraser'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'points'
  | 'measure'
  | 'measure_arc'
  | 'furniture'

const COLORS = ['#e85d04', '#f2d892', '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#000000']

interface Props {
  obraId: string | null
  open: boolean
  canEdit: boolean
  /** Quando true, embute no modal de detalhe (sem Dialog próprio). */
  embedded?: boolean
  onExported?: () => void
}

export function ObraLousa({ obraId, open, canEdit, embedded = true, onExported }: Props) {
  const lousa = useObraLousa(obraId, open)
  const history = useObraLousaHistory()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [boardSize, setBoardSize] = useState({ w: 640, h: 560 })
  const [tool, setTool] = useState<LousaTool>('pencil')
  const toolRef = useRef<LousaTool>('pencil')
  const setToolSafe = useCallback((next: LousaTool) => {
    toolRef.current = next
    setTool(next)
  }, [])
  const [color, setColor] = useState(COLORS[0])
  const colorRef = useRef(COLORS[0])
  const setColorSafe = (c: string) => { colorRef.current = c; setColor(c) }
  const [strokeWidth, setStrokeWidth] = useState(6)
  const strokeWidthRef = useRef(6)
  const setStrokeWidthSafe = (n: number) => { strokeWidthRef.current = n; setStrokeWidth(n) }
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [furnitureType, setFurnitureType] = useState<FurnitureModuleType>('armario_2_portas')
  const [showFurnitureMenu, setShowFurnitureMenu] = useState(false)
  const [obsDraft, setObsDraft] = useState('')
  const [obsSaving, setObsSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftStroke, setDraftStroke] = useState<string | null>(null)
  const [draftAnnotation, setDraftAnnotation] = useState<WhiteboardAnnotation | null>(null)
  const [textEditingId, setTextEditingId] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState('')
  const [busyMsg, setBusyMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const drawingRef = useRef(false)
  const draftStrokeRef = useRef<string | null>(null)
  const draftAnnotationRef = useRef<WhiteboardAnnotation | null>(null)
  const pointsRef = useRef<Point[]>([])
  const measureStepRef = useRef<{ a?: Point; b?: Point }>({})
  const furnitureStepRef = useRef<Point | null>(null)
  const dragStartRef = useRef<Point | null>(null)
  const spacePanRef = useRef(false)
  const panningActiveRef = useRef(false)
  /** Arraste de anotação (caixa de texto, formas, etc.) */
  const moveRef = useRef<{
    id: string
    start: Point
    origin: WhiteboardAnnotation
    moved: boolean
    live: WhiteboardAnnotation
  } | null>(null)
  const [liveMove, setLiveMove] = useState<{ id: string; annotation: WhiteboardAnnotation } | null>(null)

  const worldW = Number(lousa.activeImage?.width) || 1280
  const worldH = Number(lousa.activeImage?.height) || 720
  const inkScale = useMemo(() => lousaInkScale(worldW, worldH), [worldW, worldH])
  const worldStroke = useMemo(
    () => lousaWorldStroke(strokeWidth, inkScale),
    [strokeWidth, inkScale],
  )

  const viewport = useObraLousaViewport({
    worldWidth: worldW,
    worldHeight: worldH,
    containerWidth: boardSize.w,
    containerHeight: boardSize.h,
  })

  useEffect(() => {
    if (!boardRef.current) return
    const el = boardRef.current
    const ro = new ResizeObserver(entries => {
      const cr = entries[0]?.contentRect
      if (cr) setBoardSize({ w: cr.width, h: cr.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, fullscreen, embedded])

  useEffect(() => {
    setObsDraft(lousa.activeImage?.observacao ?? '')
    history.reset()
    setSelectedId(null)
    setDraftStroke(null)
    setDraftAnnotation(null)
    pointsRef.current = []
    measureStepRef.current = {}
    furnitureStepRef.current = null
  }, [lousa.activeImageId])

  useEffect(() => {
    if (!fullscreen) return
    const t = window.setTimeout(() => viewport.fit(), 100)
    return () => window.clearTimeout(t)
  }, [fullscreen, boardSize.w, boardSize.h, worldW, worldH])

  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const wheel = (e: WheelEvent) => viewport.onWheel(e)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('touchstart', viewport.onTouchStart, { passive: true })
    el.addEventListener('touchmove', viewport.onTouchMove, { passive: false })
    el.addEventListener('touchend', viewport.onTouchEnd)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('touchstart', viewport.onTouchStart)
      el.removeEventListener('touchmove', viewport.onTouchMove)
      el.removeEventListener('touchend', viewport.onTouchEnd)
    }
  }, [viewport])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') spacePanRef.current = e.type === 'keydown'
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        void handleUndo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        // redo local: re-apontamos só a pilha — desenhos já persistidos
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  })

  const getLocalPoint = useCallback((e: React.PointerEvent | React.MouseEvent): Point | null => {
    const el = boardRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
  }, [viewport])

  const handleUndo = async () => {
    const id = history.undo()
    if (!id) return
    try {
      await lousa.removeDrawing(id)
    } catch {
      /* ignore */
    }
  }

  const persistStroke = async (path: string) => {
    const row = await lousa.addStroke(path, colorRef.current, strokeWidthRef.current)
    if (row) history.pushCreated(row.id)
  }

  const persistAnnotation = async (annotation: WhiteboardAnnotation) => {
    const row = await lousa.addAnnotation(annotation, colorRef.current, strokeWidthRef.current)
    if (row) {
      history.pushCreated(row.id)
      if (annotation.kind === 'text') {
        setTextEditingId(row.id)
        setTextDraft(annotation.text || '')
        setSelectedId(row.id)
      }
    }
    return row
  }

  const onPointerDown = async (e: React.PointerEvent) => {
    if (!canEdit || !lousa.activeImage) return
    const pt = getLocalPoint(e)
    if (!pt) return
    const currentTool = toolRef.current

    if (e.button === 1 || spacePanRef.current || (currentTool === 'select' && e.altKey)) {
      panningActiveRef.current = true
      viewport.startPan(e.clientX, e.clientY)
      return
    }

    if (currentTool === 'eraser') {
      return
    }

    if (currentTool === 'select') {
      // Clique no fundo: desmarca (clique na anotação para no SVG e inicia arraste)
      if (!moveRef.current) {
        setSelectedId(null)
        setTextEditingId(null)
        setLiveMove(null)
      }
      return
    }

    if (currentTool === 'pencil') {
      drawingRef.current = true
      dragStartRef.current = pt
      const start = `M ${pt.x} ${pt.y}`
      draftStrokeRef.current = start
      setDraftStroke(start)
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      return
    }

    if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'ellipse') {
      drawingRef.current = true
      dragStartRef.current = pt
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      return
    }

    if (currentTool === 'text') {
      // Texto é tratado no onClick (mais confiável que pointerdown sozinho)
      return
    }

    if (currentTool === 'points') {
      pointsRef.current = [...pointsRef.current, pt]
      if (pointsRef.current.length >= 2) {
        const ann: WhiteboardAnnotation = { kind: 'polyline', points: [...pointsRef.current] }
        draftAnnotationRef.current = ann
        setDraftAnnotation(ann)
      }
      return
    }

    if (currentTool === 'measure') {
      const step = measureStepRef.current
      if (!step.a) {
        measureStepRef.current = { a: pt }
        const ann = buildMeasure(pt, pt)
        draftAnnotationRef.current = ann
        setDraftAnnotation(ann)
      } else {
        const ann = buildMeasure(step.a, pt)
        measureStepRef.current = {}
        draftAnnotationRef.current = null
        setDraftAnnotation(null)
        await persistAnnotation(ann)
      }
      return
    }

    if (currentTool === 'measure_arc') {
      const step = measureStepRef.current
      if (!step.a) {
        measureStepRef.current = { a: pt }
      } else if (!step.b) {
        measureStepRef.current = { a: step.a, b: pt }
        const ann = buildMeasure(step.a, pt)
        draftAnnotationRef.current = ann
        setDraftAnnotation(ann)
      } else {
        const ann = buildMeasure(step.a, step.b, pt)
        measureStepRef.current = {}
        draftAnnotationRef.current = null
        setDraftAnnotation(null)
        await persistAnnotation(ann)
      }
      return
    }

    if (currentTool === 'furniture') {
      if (!furnitureStepRef.current) {
        furnitureStepRef.current = pt
        const ann = buildFurniture(furnitureType, pt, pt, colorRef.current)
        draftAnnotationRef.current = ann
        setDraftAnnotation(ann)
      } else {
        const top = furnitureStepRef.current
        furnitureStepRef.current = null
        draftAnnotationRef.current = null
        setDraftAnnotation(null)
        await persistAnnotation(buildFurniture(furnitureType, top, pt, colorRef.current))
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (panningActiveRef.current || e.buttons === 4 || spacePanRef.current) {
      viewport.movePan(e.clientX, e.clientY)
      return
    }

    const pt = getLocalPoint(e)
    if (!pt || !canEdit) return
    const currentTool = toolRef.current

    if (moveRef.current) {
      const { id, start, origin } = moveRef.current
      const dx = pt.x - start.x
      const dy = pt.y - start.y
      if (Math.hypot(dx, dy) > 3) moveRef.current.moved = true
      const live = offsetAnnotation(origin, dx, dy)
      moveRef.current.live = live
      setLiveMove({ id, annotation: live })
      return
    }

    if (currentTool === 'pencil' && drawingRef.current) {
      const next = draftStrokeRef.current
        ? `${draftStrokeRef.current} L ${pt.x} ${pt.y}`
        : `M ${pt.x} ${pt.y}`
      draftStrokeRef.current = next
      setDraftStroke(next)
      return
    }

    if (drawingRef.current && dragStartRef.current) {
      const a = dragStartRef.current
      let ann: WhiteboardAnnotation | null = null
      if (currentTool === 'line') ann = buildLine(a, pt)
      if (currentTool === 'rect') ann = buildRect(a, pt)
      if (currentTool === 'ellipse') ann = buildEllipse(a, pt)
      if (ann) {
        draftAnnotationRef.current = ann
        setDraftAnnotation(ann)
      }
      return
    }

    if (currentTool === 'measure' && measureStepRef.current.a && !measureStepRef.current.b) {
      const ann = buildMeasure(measureStepRef.current.a, pt)
      draftAnnotationRef.current = ann
      setDraftAnnotation(ann)
    }

    if (currentTool === 'measure_arc' && measureStepRef.current.a && measureStepRef.current.b) {
      const ann = buildMeasure(measureStepRef.current.a, measureStepRef.current.b, pt)
      draftAnnotationRef.current = ann
      setDraftAnnotation(ann)
    }

    if (currentTool === 'furniture' && furnitureStepRef.current) {
      const ann = buildFurniture(furnitureType, furnitureStepRef.current, pt, colorRef.current)
      draftAnnotationRef.current = ann
      setDraftAnnotation(ann)
    }
  }

  const onPointerUp = async (_e: React.PointerEvent) => {
    if (panningActiveRef.current) {
      panningActiveRef.current = false
      viewport.endPan()
      return
    }
    viewport.endPan()
    if (!canEdit) return
    const currentTool = toolRef.current

    if (moveRef.current) {
      const move = moveRef.current
      moveRef.current = null
      setLiveMove(null)
      if (move.moved && lousa.activeImageId) {
        try {
          await lousa.updateAnnotation(move.id, move.live, lousa.activeImageId)
        } catch (err) {
          lousa.setError(err instanceof Error ? err.message : 'Falha ao mover a anotação.')
        }
      } else if (!move.moved && move.origin.kind === 'text') {
        // Clique simples na caixa: seleciona (já feito) — não abre editor
        setSelectedId(move.id)
      }
      return
    }

    if (currentTool === 'pencil' && drawingRef.current) {
      drawingRef.current = false
      const path = draftStrokeRef.current
      draftStrokeRef.current = null
      setDraftStroke(null)
      if (path && path.includes('L')) await persistStroke(path)
      return
    }

    if (
      drawingRef.current
      && draftAnnotationRef.current
      && dragStartRef.current
      && (currentTool === 'line' || currentTool === 'rect' || currentTool === 'ellipse')
    ) {
      drawingRef.current = false
      const ann = draftAnnotationRef.current
      draftAnnotationRef.current = null
      setDraftAnnotation(null)
      dragStartRef.current = null
      if (ann.kind === 'rect' && (ann.w < 4 || ann.h < 4)) return
      if (ann.kind === 'ellipse' && (Math.abs(ann.rx) < 2 || Math.abs(ann.ry) < 2)) return
      if (ann.kind === 'line' && distance(ann.a, ann.b) < 4) return
      await persistAnnotation(ann)
    } else if (drawingRef.current) {
      drawingRef.current = false
      draftAnnotationRef.current = null
      setDraftAnnotation(null)
      dragStartRef.current = null
    }
  }

  const onDoubleClick = async () => {
    if (tool === 'points' && pointsRef.current.length >= 2) {
      const points = [...pointsRef.current]
      pointsRef.current = []
      draftAnnotationRef.current = null
      setDraftAnnotation(null)
      await persistAnnotation({ kind: 'polyline', points })
      return
    }
    viewport.fit()
  }

  const handleSelectDrawing = async (id: string | null) => {
    if (toolRef.current === 'eraser' && id && canEdit) {
      try {
        await lousa.removeDrawing(id)
      } catch (err) {
        lousa.setError(err instanceof Error ? err.message : 'Falha ao apagar.')
      }
      setSelectedId(null)
      return
    }
    setSelectedId(id)
  }

  /** Inicia arraste da anotação (ferramenta Selecionar). */
  const handleAnnotationPointerDown = (
    id: string,
    annotation: WhiteboardAnnotation,
    e: React.PointerEvent,
  ) => {
    if (!canEdit) return
    if (toolRef.current === 'eraser') {
      void handleSelectDrawing(id)
      return
    }
    // Com Selecionar (ou após criar texto): permite arrastar
    if (toolRef.current !== 'select') {
      // Outras ferramentas: só seleciona se for borracha (acima) — senão ignore
      return
    }
    e.preventDefault()
    setSelectedId(id)
    setTextEditingId(null)
    const pt = getLocalPoint(e)
    if (!pt) return
    moveRef.current = {
      id,
      start: pt,
      origin: annotation,
      moved: false,
      live: annotation,
    }
    setLiveMove({ id, annotation })
    boardRef.current?.setPointerCapture?.(e.pointerId)
  }

  /** Duplo clique na caixa de texto abre o editor. */
  const handleAnnotationDoubleClick = (id: string, annotation: WhiteboardAnnotation) => {
    if (!canEdit || annotation.kind !== 'text') return
    setSelectedId(id)
    setTextEditingId(id)
    setTextDraft(annotation.text || '')
    setToolSafe('select')
  }

  const saveTextEdit = async () => {
    if (!textEditingId || !lousa.activeImageId) return
    const value = textDraft.trim() || 'Texto'
    const d = lousa.activeDrawings.find(x => x.id === textEditingId)
    if (!d) {
      // ainda sincronizando: tenta de novo com o draft local
      setTextEditingId(null)
      return
    }
    const parsed = parsePathData(d.path_data)
    if (parsed?.type !== 'annotation' || parsed.annotation.kind !== 'text') return
    await lousa.updateAnnotation(
      textEditingId,
      { ...parsed.annotation, text: value },
      lousa.activeImageId,
    )
    setSelectedId(textEditingId)
    setTextEditingId(null)
    setToolSafe('select')
    setSuccessMsg('Texto salvo na Lousa.')
  }

  const handleUploadFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return
    setSuccessMsg(null)
    const list = Array.from(files)
    for (const file of list) {
      if (!isAcceptedLousaImage(file)) {
        lousa.setError('Envie apenas imagens (JPG, PNG, WebP, GIF ou HEIC).')
        continue
      }
      if (file.size > OBRA_LOUSA_MAX_BYTES) {
        lousa.setError('Arquivo acima de 100 MB.')
        continue
      }
      try {
        await lousa.uploadImage(file)
        setSuccessMsg(`Foto “${file.name}” anexada na Lousa.`)
      } catch {
        /* error já no hook */
      }
    }
  }

  const handleSaveObservacao = async () => {
    if (!lousa.activeImageId || !canEdit) return
    setObsSaving(true)
    try {
      await lousa.saveObservacao(lousa.activeImageId, obsDraft)
      setSuccessMsg('Observação salva.')
    } finally {
      setObsSaving(false)
    }
  }

  const handleExport = async () => {
    if (!lousa.activeImage) {
      lousa.setError('Anexe uma foto antes de salvar.')
      return
    }
    if (!confirm(
      'Salvar a foto riscada no card (Fotos e Documentos) e tirar ela da Lousa?',
    )) return

    setBusyMsg('Salvando desenho no card...')
    setSuccessMsg(null)
    try {
      await lousa.exportToAnexos()
      onExported?.()
      setSuccessMsg('Desenho salvo no card! A foto saiu da Lousa e foi para Fotos e Documentos.')
      history.reset()
      setSelectedId(null)
      setTextEditingId(null)
    } catch (err) {
      lousa.setError(err instanceof Error ? err.message : 'Falha ao salvar no card.')
    } finally {
      setBusyMsg(null)
    }
  }

  const onBoardDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!canEdit) return
    void handleUploadFiles(e.dataTransfer.files)
  }

  const tools: { id: LousaTool; icon: ReactNode; label: string }[] = useMemo(() => [
    { id: 'select', icon: <MousePointer2 size={18} />, label: 'Selecionar' },
    { id: 'pencil', icon: <Pencil size={18} />, label: 'Desenhar' },
    { id: 'eraser', icon: <Eraser size={18} />, label: 'Apagar' },
    { id: 'line', icon: <Slash size={18} />, label: 'Linha' },
    { id: 'rect', icon: <RectangleHorizontal size={18} />, label: 'Retângulo' },
    { id: 'ellipse', icon: <Circle size={18} />, label: 'Elipse' },
    { id: 'text', icon: <Type size={18} />, label: 'Texto' },
    { id: 'points', icon: <Plus size={18} />, label: 'Pontos' },
    { id: 'measure', icon: <Ruler size={18} />, label: 'Medir' },
    { id: 'furniture', icon: <Armchair size={18} />, label: 'Móveis' },
  ], [])

  if (!open) return null

  const board = (
    <div className={cn('flex flex-col gap-3', fullscreen && 'flex-1 min-h-0 h-full')}>
      {/* Anexar foto — sempre no topo */}
      {canEdit && (
        <div className={cn('flex flex-wrap items-center gap-2 shrink-0', fullscreen && 'hidden')}>
          <button
            type="button"
            disabled={lousa.uploading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-[#f2d892]/20 text-[#f2d892] hover:bg-[#f2d892]/30 disabled:opacity-50"
          >
            {lousa.uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Anexar foto
          </button>
          <button
            type="button"
            disabled={lousa.uploading}
            onClick={() => cameraRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-[rgba(240,210,140,0.12)] text-[#f2d892] hover:bg-[rgba(240,210,140,0.22)] disabled:opacity-50"
          >
            <Camera size={12} /> Câmera
          </button>
          {lousa.activeImage && (
            <button
              type="button"
              disabled={lousa.saving}
              onClick={() => void handleExport()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold bg-emerald-600/25 text-emerald-300 hover:bg-emerald-600/40 disabled:opacity-50 ml-auto"
            >
              {lousa.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Salvar no card
            </button>
          )}
        </div>
      )}

      {/* inputs sempre montados (também usados na tela cheia) */}
      {canEdit && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic"
            multiple
            className="hidden"
            onChange={e => { void handleUploadFiles(e.target.files); e.target.value = '' }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { void handleUploadFiles(e.target.files); e.target.value = '' }}
          />
        </>
      )}

      {/* Em tela cheia: ações essenciais no topo */}
      {canEdit && fullscreen && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={lousa.uploading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-[#f2d892]/20 text-[#f2d892]"
          >
            <Upload size={12} /> Anexar foto
          </button>
          <button
            type="button"
            disabled={lousa.saving || !lousa.activeImage}
            onClick={() => void handleExport()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold bg-emerald-600/25 text-emerald-300 ml-auto"
          >
            <Save size={12} /> Salvar no card
          </button>
        </div>
      )}

      <p className={cn('text-[0.65rem] text-[#d4bc9f] -mt-1', fullscreen && 'hidden')}>
        Anexe uma foto (até 100 MB), risque em cima e clique em <strong className="text-[#f2d892]">Salvar no card</strong> —
        a imagem riscada vai para Fotos e Documentos e sai da Lousa.
      </p>

      {/* Toolbar */}
      {!toolbarCollapsed && lousa.activeImage && (
        <div
          className="flex flex-wrap items-center gap-1.5 sm:gap-2 rounded-xl p-2 sm:p-2.5 shadow-[inset_0_1px_0_rgba(242,216,146,0.12)]"
          style={{
            background:
              'linear-gradient(165deg, rgba(28,22,16,0.95) 0%, rgba(12,10,8,0.92) 100%)',
            border: '1px solid rgba(240,210,140,0.28)',
          }}
        >
          {canEdit && tools.map(t => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              onClick={() => {
                setToolSafe(t.id)
                if (t.id === 'furniture') setShowFurnitureMenu(v => !v)
                else setShowFurnitureMenu(false)
                pointsRef.current = []
                measureStepRef.current = {}
                furnitureStepRef.current = null
                draftAnnotationRef.current = null
                setDraftAnnotation(null)
              }}
              className={cn(
                'inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-[#edd9c4] hover:bg-white/10 transition-colors active:scale-95',
                tool === t.id && 'bg-[#f2d892]/25 text-[#f2d892] ring-1 ring-[#f2d892]/50 shadow-[0_0_18px_rgba(242,216,146,0.18)]',
              )}
            >
              {t.icon}
            </button>
          ))}

          {canEdit && (
            <>
              <span className="mx-0.5 hidden sm:block h-6 w-px bg-[rgba(240,210,140,0.22)]" />
              <div className="flex items-center gap-1.5 w-full sm:w-auto mt-1 sm:mt-0">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={`Cor ${c}`}
                    onClick={() => setColorSafe(c)}
                    className={cn(
                      'h-8 w-8 sm:h-6 sm:w-6 rounded-full border-2 transition-transform',
                      color === c ? 'border-white scale-110 ring-2 ring-[#f2d892]/40' : 'border-black/40',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="ml-1 flex items-center gap-1.5 text-[0.7rem] text-[#edd9c4]">
                  Traço
                  <input
                    type="range"
                    min={2}
                    max={16}
                    value={strokeWidth}
                    onChange={e => setStrokeWidthSafe(Number(e.target.value))}
                    className="w-20 sm:w-24 accent-[#f2d892]"
                  />
                  <span className="tabular-nums text-[#f2d892] w-4">{strokeWidth}</span>
                </label>
              </div>
            </>
          )}

          <span className="mx-0.5 hidden sm:block h-6 w-px bg-[rgba(240,210,140,0.22)]" />
          <div className="flex items-center gap-1 ml-auto">
            <button type="button" title="Desfazer" onClick={() => void handleUndo()} className="inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-[#edd9c4] hover:bg-white/10">
              <Undo2 size={18} />
            </button>
            <button type="button" title="Refazer" disabled className="inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-[#edd9c4]/35">
              <Redo2 size={18} />
            </button>
            <button type="button" title="Zoom −" onClick={() => viewport.zoomBy(0.85)} className="inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-[#edd9c4] hover:bg-white/10">
              <Minus size={18} />
            </button>
            <button type="button" title="Zoom +" onClick={() => viewport.zoomBy(1.15)} className="inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-[#edd9c4] hover:bg-white/10">
              <Plus size={18} />
            </button>
            <span className="hidden sm:inline text-[0.65rem] tabular-nums text-[#f2d892]/90 min-w-[2.5rem] text-center">
              {Math.round(viewport.viewport.scale * 100)}%
            </span>
            <button type="button" title="Ajustar foto" onClick={() => viewport.fit()} className="inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-[#edd9c4] hover:bg-white/10">
              <Maximize2 size={18} />
            </button>
            <button type="button" title="Ajuda" onClick={() => setShowHelp(v => !v)} className="inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-[#edd9c4] hover:bg-white/10">
              <HelpCircle size={18} />
            </button>
            {!fullscreen && (
              <button type="button" title="Tela cheia" onClick={() => setFullscreen(true)} className="inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-[#edd9c4] hover:bg-white/10">
                <Expand size={18} />
              </button>
            )}
            {fullscreen && (
              <button type="button" title="Sair da tela cheia" onClick={() => setFullscreen(false)} className="inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-[#f2d892] hover:bg-white/10">
                <Shrink size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      {lousa.activeImage && !fullscreen && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setToolbarCollapsed(v => !v)}
            className="text-[0.65rem] text-[#edd9c4] underline"
          >
            {toolbarCollapsed ? 'Mostrar ferramentas' : 'Recolher ferramentas'}
          </button>
          {tool === 'points' && (
            <span className="text-[0.65rem] text-amber-300">Pontos: clique vários pontos · duplo clique finaliza</span>
          )}
          {tool === 'measure' && (
            <span className="text-[0.65rem] text-amber-300">Medir: 1º clique início · 2º clique fim</span>
          )}
          {tool === 'furniture' && (
            <span className="text-[0.65rem] text-amber-300">Móvel: 1º clique no topo · 2º na base</span>
          )}
          {tool === 'eraser' && (
            <span className="text-[0.65rem] text-amber-300">Borracha: clique no risco para apagar</span>
          )}
          {tool === 'select' && (
            <span className="text-[0.65rem] text-amber-300">
              Selecionar: arraste a caixa · duplo clique edita o texto
            </span>
          )}
          {tool === 'text' && (
            <span className="text-[0.65rem] text-amber-300">Texto: clique na foto para criar a caixa</span>
          )}
          {lousa.saving && (
            <span className="flex items-center gap-1 text-[0.65rem] text-[#f2d892]">
              <Loader2 size={12} className="animate-spin" /> Salvando...
            </span>
          )}
        </div>
      )}

      {showFurnitureMenu && canEdit && (
        <div className="flex flex-wrap gap-1.5">
          {FURNITURE_CATALOG.map(item => (
            <button
              key={item.type}
              type="button"
              onClick={() => { setFurnitureType(item.type); setToolSafe('furniture'); setShowFurnitureMenu(false) }}
              className={cn(
                'rounded-md px-2 py-1 text-[0.65rem] border',
                furnitureType === item.type
                  ? 'border-[#f2d892] text-[#f2d892] bg-[#f2d892]/10'
                  : 'border-[rgba(240,210,140,0.2)] text-[#edd9c4]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {showHelp && (
        <div className="rounded-lg p-3 text-xs text-[#edd9c4] space-y-1" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <p>1. Anexe uma foto (botão, câmera ou arraste para a área escura).</p>
          <p>2. Risque com lápis, formas, texto, medição ou móveis.</p>
          <p>3. Com Selecionar, arraste a caixa de texto; duplo clique edita.</p>
          <p>4. Cada foto guarda sua observação e seus riscos automaticamente.</p>
          <p>5. “Salvar no card” gera a imagem final, coloca em Fotos e Documentos e tira da Lousa.</p>
        </div>
      )}

      {/* Board */}
      <div
        ref={boardRef}
        className={cn(
          'relative overflow-hidden rounded-xl touch-none shadow-[0_12px_40px_rgba(0,0,0,0.45)]',
          fullscreen && 'flex-1 min-h-0',
          dragOver && 'ring-2 ring-[#f2d892] ring-offset-2 ring-offset-transparent',
        )}
        style={{
          ...(fullscreen
            ? { flex: '1 1 auto', minHeight: 0, height: 'calc(100dvh - 96px)' }
            : { height: 'clamp(420px, 65dvh, 760px)' }),
          background:
            'radial-gradient(ellipse at 50% 30%, #1a1510 0%, #0c0a08 55%, #070605 100%)',
          border: dragOver
            ? '1px dashed rgba(242,216,146,0.8)'
            : '1px solid rgba(240,210,140,0.28)',
          cursor: !lousa.activeImage
            ? 'pointer'
            : tool === 'pencil' || tool === 'line' || tool === 'rect' || tool === 'ellipse' || tool === 'text'
              ? 'crosshair'
              : tool === 'eraser'
                ? 'cell'
                : 'default',
        }}
        onPointerDown={e => void onPointerDown(e)}
        onPointerMove={onPointerMove}
        onPointerUp={e => void onPointerUp(e)}
        onClick={e => {
          // fallback para a ferramenta Texto (alguns ambientes engolem o pointerdown)
          if (toolRef.current !== 'text' || !canEdit || !lousa.activeImage) return
          if (textEditingId) return
          const pt = getLocalPoint(e)
          if (!pt) return
          e.stopPropagation()
          void (async () => {
            try {
              const created = await persistAnnotation(buildText(pt, 26, inkScale))
              if (!created) {
                lousa.setError('Não foi possível criar a caixa de texto. Tente de novo.')
                return
              }
              setToolSafe('select')
            } catch (err) {
              lousa.setError(err instanceof Error ? err.message : 'Falha ao criar texto.')
            }
          })()
        }}
        onPointerCancel={() => {
          drawingRef.current = false
          panningActiveRef.current = false
          moveRef.current = null
          setLiveMove(null)
          viewport.endPan()
        }}
        onDoubleClick={() => void onDoubleClick()}
        onDragOver={e => {
          e.preventDefault()
          if (canEdit) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onBoardDrop}
      >
        {lousa.loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-[#edd9c4] text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> Carregando lousa...
          </div>
        ) : !lousa.activeImage ? (
          <div
            role="button"
            tabIndex={0}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-3 cursor-pointer"
            onClick={() => canEdit && fileRef.current?.click()}
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ' ') && canEdit) fileRef.current?.click()
            }}
          >
            <Upload size={28} className="text-[#f2d892]" />
            <p className="text-sm text-[#edd9c4]">Nenhuma foto na Lousa ainda.</p>
            {canEdit && (
              <p className="text-xs text-[#d4bc9f] max-w-xs">
                Clique aqui, use “Anexar foto” / “Câmera”, ou arraste uma imagem para esta área (até 100 MB).
              </p>
            )}
          </div>
        ) : (
          <div
            style={{
              transform: `translate(${viewport.viewport.offsetX}px, ${viewport.viewport.offsetY}px) scale(${viewport.viewport.scale})`,
              transformOrigin: '0 0',
              width: worldW,
              height: worldH,
              position: 'relative',
            }}
          >
            {lousa.activeImage.signedUrl && (
              <img
                src={lousa.activeImage.signedUrl}
                alt={lousa.activeImage.file_name}
                draggable={false}
                className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
                style={{ width: worldW, height: worldH }}
              />
            )}
            <svg
              width={worldW}
              height={worldH}
              className="absolute inset-0"
              style={{ overflow: 'visible' }}
            >
              <ObraLousaAnnotationsLayer
                drawings={lousa.activeDrawings}
                selectedId={selectedId}
                draftAnnotation={draftAnnotation}
                draftStroke={draftStroke}
                draftColor={color}
                draftStrokeWidth={worldStroke}
                inkScale={inkScale}
                readOnly={!canEdit}
                liveOverride={liveMove}
                onSelect={id => void handleSelectDrawing(id)}
                onAnnotationPointerDown={handleAnnotationPointerDown}
                onAnnotationDoubleClick={handleAnnotationDoubleClick}
              />
            </svg>
          </div>
        )}

        {/* Faixa visível com a observação da foto */}
        {lousa.activeImage?.observacao?.trim() && (
          <div
            className="absolute left-2 right-2 bottom-2 z-10 rounded-lg px-3 py-2 pointer-events-none"
            style={{
              backgroundColor: 'rgba(242, 216, 146, 0.95)',
              border: '1px solid rgba(242,216,146,1)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
            }}
          >
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[#3d2b1f] mb-0.5">
              Observação desta foto
            </p>
            <p className="text-sm font-semibold text-[#1a120b] whitespace-pre-wrap leading-snug">
              {lousa.activeImage.observacao.trim()}
            </p>
          </div>
        )}

        {/* Editor de texto flutuante — bem visível sobre o quadro */}
        {textEditingId && canEdit && (
          <div
            className="absolute inset-x-3 top-3 z-20 rounded-xl p-3 shadow-2xl"
            style={{
              backgroundColor: 'rgba(20, 16, 12, 0.96)',
              border: '2px solid #f2d892',
            }}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-[#f2d892] mb-2">
              Digite o texto da anotação
            </p>
            <textarea
              value={textDraft}
              onChange={e => setTextDraft(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Ex.: porta de correr · 2,40 m · lado esquerdo"
              className="w-full rounded-md bg-black/50 border border-[rgba(240,210,140,0.35)] px-3 py-2 text-base text-cream placeholder:text-[#d4bc9f]/70 resize-y"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void saveTextEdit()
                }
                if (e.key === 'Escape') setTextEditingId(null)
              }}
            />
            <div className="mt-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setTextEditingId(null)}
                className="rounded-lg px-3 py-1.5 text-xs text-[#edd9c4] hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveTextEdit()}
                className="rounded-lg px-4 py-1.5 text-xs font-bold bg-[#f2d892] text-[#1a120b] hover:bg-[#ffe6a8]"
              >
                Confirmar texto
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Miniaturas */}
      {!fullscreen && (
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {lousa.images.map(img => (
          <button
            key={img.id}
            type="button"
            onClick={() => lousa.setActiveImageId(img.id)}
            className={cn(
              'relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2',
              lousa.activeImageId === img.id ? 'border-[#f2d892]' : 'border-transparent opacity-70',
            )}
            title={img.observacao?.trim() || img.file_name}
          >
            {img.signedUrl ? (
              <img src={img.signedUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-black/40" />
            )}
            {img.observacao?.trim() && (
              <span
                className="absolute bottom-0 inset-x-0 px-0.5 py-0.5 text-[0.55rem] font-bold leading-tight truncate"
                style={{ backgroundColor: 'rgba(242,216,146,0.95)', color: '#1a120b' }}
              >
                {img.observacao.trim()}
              </span>
            )}
          </button>
        ))}
      </div>
      )}

      {/* Observação da foto ativa — bem destacada */}
      {lousa.activeImage && !fullscreen && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            backgroundColor: 'rgba(242, 216, 146, 0.14)',
            border: '2px solid rgba(242, 216, 146, 0.55)',
            boxShadow: '0 0 0 1px rgba(242,216,146,0.12)',
          }}
        >
          <div className="flex items-center gap-2 text-[#f2d892]">
            <MessageSquareText size={16} />
            <p className="text-xs uppercase tracking-wider font-bold">
              Observação desta foto
            </p>
          </div>
          {canEdit ? (
            <>
              <textarea
                value={obsDraft}
                onChange={e => setObsDraft(e.target.value)}
                rows={4}
                placeholder="Escreva aqui a observação desta foto — fica bem visível no quadro e na miniatura."
                className="w-full rounded-lg bg-[#0c0a08] border-2 border-[rgba(240,210,140,0.45)] px-3 py-3 text-base text-[#f8f0e0] placeholder:text-[#d4bc9f]/70 resize-y font-medium leading-relaxed"
              />
              <button
                type="button"
                disabled={obsSaving}
                onClick={() => void handleSaveObservacao()}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold bg-[#f2d892] text-[#1a120b] hover:bg-[#ffe6a8] disabled:opacity-50"
              >
                {obsSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar observação
              </button>
            </>
          ) : (
            <p className="text-base text-[#f8f0e0] whitespace-pre-wrap font-medium leading-relaxed">
              {lousa.activeImage.observacao?.trim() || 'Sem observação.'}
            </p>
          )}
        </div>
      )}

      {/* Ações secundárias */}
      {!fullscreen && (
      <div className={cn('flex flex-wrap gap-2 shrink-0')}>
        {canEdit && lousa.activeImage && (
          <>
            <button
              type="button"
              onClick={() => {
                if (!confirm('Limpar todos os riscos desta foto? A foto permanece.')) return
                void lousa.clearActiveDrawings()
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/10"
            >
              Limpar desenhos
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm('Remover esta foto e todos os riscos dela?')) return
                void lousa.removeImage(lousa.activeImage!)
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
            >
              <Trash2 size={12} /> Remover foto
            </button>
            <button
              type="button"
              disabled={lousa.saving}
              onClick={() => void handleExport()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold bg-emerald-600/25 text-emerald-300 hover:bg-emerald-600/40 disabled:opacity-50"
            >
              {lousa.saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Salvar no card
            </button>
          </>
        )}
      </div>
      )}

      {(lousa.error || busyMsg || successMsg) && (
        <p className={cn(
          'text-xs',
          lousa.error ? 'text-red-400' : successMsg ? 'text-emerald-300' : 'text-[#f2d892]',
        )}>
          {busyMsg ?? lousa.error ?? successMsg}
        </p>
      )}
    </div>
  )

  if (fullscreen) {
    return (
      <>
        {embedded && (
          <div className="mb-2 rounded-lg px-3 py-2 text-xs text-[#edd9c4]" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}>
            Lousa aberta em tela cheia — use o botão de reduzir para voltar.
          </div>
        )}
        {createPortal(
          <div
            className="fixed inset-0 z-[500] flex flex-col"
            style={{ backgroundColor: '#0c0a08' }}
            role="dialog"
            aria-modal="true"
            aria-label="Lousa em tela cheia"
          >
            <div
              className="flex items-center justify-between gap-3 shrink-0 px-4 py-3 border-b"
              style={{ borderColor: 'rgba(240,210,140,0.25)' }}
            >
              <p className="font-display text-lg tracking-widest text-[#f2d892]">Lousa da Obra · Tela cheia</p>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold bg-[#f2d892]/15 text-[#f2d892] hover:bg-[#f2d892]/25"
              >
                <Shrink size={16} />
                Sair da tela cheia
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-4 overflow-hidden">
              {board}
            </div>
          </div>,
          document.body,
        )}
      </>
    )
  }

  return board
}
