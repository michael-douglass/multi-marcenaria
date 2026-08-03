import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useObraLousa } from '@/hooks/useObraLousa'
import { useObraLousaViewport } from '@/hooks/useObraLousaViewport'
import { useObraLousaHistory } from '@/hooks/useObraLousaHistory'
import { OBRA_LOUSA_MAX_BYTES, isAcceptedLousaImage } from '@/lib/obra-lousa'
import {
  parsePathData,
  distance,
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
  const [boardSize, setBoardSize] = useState({ w: 640, h: 420 })
  const [tool, setTool] = useState<LousaTool>('pencil')
  const toolRef = useRef<LousaTool>('pencil')
  const setToolSafe = useCallback((next: LousaTool) => {
    toolRef.current = next
    setTool(next)
  }, [])
  const [color, setColor] = useState(COLORS[0])
  const colorRef = useRef(COLORS[0])
  const setColorSafe = (c: string) => { colorRef.current = c; setColor(c) }
  const [strokeWidth, setStrokeWidth] = useState(3)
  const strokeWidthRef = useRef(3)
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

  const worldW = Number(lousa.activeImage?.width) || 1280
  const worldH = Number(lousa.activeImage?.height) || 720

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
        setTextDraft('')
        setSelectedId(row.id)
      }
    }
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
      setSelectedId(null)
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
      await persistAnnotation(buildText(pt))
      setToolSafe('select')
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
    if (id) {
      const d = lousa.activeDrawings.find(x => x.id === id)
      const parsed = d ? parsePathData(d.path_data) : null
      if (parsed?.type === 'annotation' && parsed.annotation.kind === 'text') {
        setTextEditingId(id)
        setTextDraft(parsed.annotation.text)
      } else {
        setTextEditingId(null)
      }
    }
  }

  const saveTextEdit = async () => {
    if (!textEditingId || !lousa.activeImageId) return
    const d = lousa.activeDrawings.find(x => x.id === textEditingId)
    if (!d) return
    const parsed = parsePathData(d.path_data)
    if (parsed?.type !== 'annotation' || parsed.annotation.kind !== 'text') return
    await lousa.updateAnnotation(
      textEditingId,
      { ...parsed.annotation, text: textDraft },
      lousa.activeImageId,
    )
    setTextEditingId(null)
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
    { id: 'select', icon: <MousePointer2 size={15} />, label: 'Selecionar' },
    { id: 'pencil', icon: <Pencil size={15} />, label: 'Desenhar' },
    { id: 'eraser', icon: <Eraser size={15} />, label: 'Apagar' },
    { id: 'line', icon: <Slash size={15} />, label: 'Linha' },
    { id: 'rect', icon: <RectangleHorizontal size={15} />, label: 'Retângulo' },
    { id: 'ellipse', icon: <Circle size={15} />, label: 'Elipse' },
    { id: 'text', icon: <Type size={15} />, label: 'Texto' },
    { id: 'points', icon: <Plus size={15} />, label: 'Pontos' },
    { id: 'measure', icon: <Ruler size={15} />, label: 'Medir' },
    { id: 'furniture', icon: <Armchair size={15} />, label: 'Móveis' },
  ], [])

  if (!open) return null

  const board = (
    <div className="flex flex-col gap-3">
      {/* Anexar foto — sempre no topo */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      )}

      <p className="text-[0.65rem] text-[#d4bc9f] -mt-1">
        Anexe uma foto (até 100 MB), risque em cima e clique em <strong className="text-[#f2d892]">Salvar no card</strong> —
        a imagem riscada vai para Fotos e Documentos e sai da Lousa.
      </p>

      {/* Toolbar */}
      {!toolbarCollapsed && lousa.activeImage && (
        <div
          className="flex flex-wrap items-center gap-1.5 rounded-lg p-2"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)', border: '1px solid rgba(240,210,140,0.18)' }}
        >
          {canEdit && tools.map(t => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              onClick={() => {
                setToolSafe(t.id)
                if (t.id === 'furniture') setShowFurnitureMenu(v => !v)
                else setShowFurnitureMenu(false)
                // limpa gestos em andamento ao trocar ferramenta
                pointsRef.current = []
                measureStepRef.current = {}
                furnitureStepRef.current = null
                draftAnnotationRef.current = null
                setDraftAnnotation(null)
              }}
              className={cn(
                'rounded-md p-2 text-[#edd9c4] hover:bg-white/10 transition-colors',
                tool === t.id && 'bg-[#f2d892]/20 text-[#f2d892]',
              )}
            >
              {t.icon}
            </button>
          ))}

          {canEdit && (
            <>
              <span className="mx-1 h-5 w-px bg-[rgba(240,210,140,0.2)]" />
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setColorSafe(c)}
                  className={cn(
                    'h-5 w-5 rounded-full border-2',
                    color === c ? 'border-white scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="ml-1 flex items-center gap-1 text-[0.65rem] text-[#edd9c4]">
                Grossura
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={strokeWidth}
                  onChange={e => setStrokeWidthSafe(Number(e.target.value))}
                  className="w-16"
                />
              </label>
            </>
          )}

          <span className="mx-1 h-5 w-px bg-[rgba(240,210,140,0.2)]" />
          <button type="button" title="Desfazer" onClick={() => void handleUndo()} className="rounded-md p-2 text-[#edd9c4] hover:bg-white/10">
            <Undo2 size={15} />
          </button>
          <button type="button" title="Refazer" disabled className="rounded-md p-2 text-[#edd9c4]/40">
            <Redo2 size={15} />
          </button>
          <button type="button" title="Zoom −" onClick={() => viewport.zoomBy(0.85)} className="rounded-md p-2 text-[#edd9c4] hover:bg-white/10">
            <Minus size={15} />
          </button>
          <button type="button" title="Zoom +" onClick={() => viewport.zoomBy(1.15)} className="rounded-md p-2 text-[#edd9c4] hover:bg-white/10">
            <Plus size={15} />
          </button>
          <button type="button" title="Ajustar foto" onClick={() => viewport.fit()} className="rounded-md p-2 text-[#edd9c4] hover:bg-white/10">
            <Maximize2 size={15} />
          </button>
          <button type="button" title="Ajuda" onClick={() => setShowHelp(v => !v)} className="rounded-md p-2 text-[#edd9c4] hover:bg-white/10">
            <HelpCircle size={15} />
          </button>
          {!fullscreen && (
            <button type="button" title="Tela cheia" onClick={() => setFullscreen(true)} className="rounded-md p-2 text-[#edd9c4] hover:bg-white/10">
              <Expand size={15} />
            </button>
          )}
        </div>
      )}

      {lousa.activeImage && (
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
          <p>3. Cada foto guarda sua observação e seus riscos automaticamente.</p>
          <p>4. “Salvar no card” gera a imagem final, coloca em Fotos e Documentos e tira da Lousa.</p>
        </div>
      )}

      {/* Board */}
      <div
        ref={boardRef}
        className={cn(
          'relative overflow-hidden rounded-lg touch-none',
          dragOver && 'ring-2 ring-[#f2d892] ring-offset-2 ring-offset-transparent',
        )}
        style={{
          height: fullscreen ? 'min(70vh, 640px)' : 420,
          backgroundColor: '#0c0a08',
          border: dragOver
            ? '1px dashed rgba(242,216,146,0.8)'
            : '1px solid rgba(240,210,140,0.2)',
          cursor: !lousa.activeImage
            ? 'pointer'
            : tool === 'pencil' || tool === 'line' || tool === 'rect' || tool === 'ellipse'
              ? 'crosshair'
              : tool === 'eraser'
                ? 'cell'
                : 'default',
        }}
        onPointerDown={e => void onPointerDown(e)}
        onPointerMove={onPointerMove}
        onPointerUp={e => void onPointerUp(e)}
        onPointerCancel={() => {
          drawingRef.current = false
          panningActiveRef.current = false
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
                draftStrokeWidth={strokeWidth}
                readOnly={!canEdit}
                onSelect={id => void handleSelectDrawing(id)}
              />
            </svg>
          </div>
        )}
      </div>

      {/* Miniaturas */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {lousa.images.map(img => (
          <button
            key={img.id}
            type="button"
            onClick={() => lousa.setActiveImageId(img.id)}
            className={cn(
              'relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2',
              lousa.activeImageId === img.id ? 'border-[#f2d892]' : 'border-transparent opacity-70',
            )}
            title={img.file_name}
          >
            {img.signedUrl ? (
              <img src={img.signedUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-black/40" />
            )}
          </button>
        ))}
      </div>

      {/* Observação da foto ativa */}
      {lousa.activeImage && (
        <div
          className="rounded-lg p-3 space-y-2"
          style={{ backgroundColor: 'rgba(240,210,140,0.06)', border: '1px solid rgba(240,210,140,0.15)' }}
        >
          <div className="flex items-center gap-1.5 text-[#f2d892]">
            <MessageSquareText size={13} />
            <p className="text-[0.65rem] uppercase tracking-wider font-semibold">
              Observação desta foto
            </p>
          </div>
          {canEdit ? (
            <>
              <textarea
                value={obsDraft}
                onChange={e => setObsDraft(e.target.value)}
                rows={2}
                placeholder="Ex.: parede da cozinha, lado do fogão — medidas a confirmar..."
                className="w-full rounded-md bg-black/30 border border-[rgba(240,210,140,0.2)] px-3 py-2 text-sm text-cream placeholder:text-[#d4bc9f]/60 resize-y"
              />
              <button
                type="button"
                disabled={obsSaving}
                onClick={() => void handleSaveObservacao()}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-[rgba(240,210,140,0.12)] text-[#f2d892] hover:bg-[rgba(240,210,140,0.22)] disabled:opacity-50"
              >
                {obsSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Salvar observação
              </button>
            </>
          ) : (
            <p className="text-sm text-cream whitespace-pre-wrap">
              {lousa.activeImage.observacao?.trim() || 'Sem observação.'}
            </p>
          )}
        </div>
      )}

      {textEditingId && canEdit && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <p className="text-[0.65rem] text-[#edd9c4] mb-1">Editar texto</p>
            <input
              value={textDraft}
              onChange={e => setTextDraft(e.target.value)}
              className="w-full rounded-md bg-black/30 border border-[rgba(240,210,140,0.2)] px-3 py-2 text-sm text-cream"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={() => void saveTextEdit()}
            className="rounded-lg px-3 py-2 text-xs font-semibold bg-[#f2d892]/20 text-[#f2d892]"
          >
            OK
          </button>
          <button type="button" onClick={() => setTextEditingId(null)} className="rounded-lg p-2 text-[#edd9c4]">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Ações secundárias */}
      <div className="flex flex-wrap gap-2">
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
          <div className="mb-2">
            <p className="text-xs text-[#edd9c4]">Lousa aberta em tela cheia…</p>
          </div>
        )}
        <Modal
          open={fullscreen}
          onClose={() => setFullscreen(false)}
          title="Lousa da Obra"
          wide
          closeOnBackdrop={false}
        >
          {board}
        </Modal>
      </>
    )
  }

  return board
}
