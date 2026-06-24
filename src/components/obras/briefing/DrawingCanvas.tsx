import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, Lock, LockOpen, Pen, RotateCcw, Trash2 } from 'lucide-react'

interface DrawingCanvasProps {
  readOnly?: boolean
  /** Identificador estável do anexo salvo — evita recarregar a cada nova URL assinada */
  imageKey?: string | null
  initialDataUrl?: string | null
  onExport?: (blob: Blob) => void
  onClearDrawing?: () => void | Promise<void>
  height?: number
  saveDelayMs?: number
}

const COLORS = ['#f2d892', '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#000000']

const GRID_SIZE = 20

async function urlToObjectUrl(url: string): Promise<string> {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url
  const res = await fetch(url)
  if (!res.ok) throw new Error('Não foi possível carregar o croqui salvo.')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export function DrawingCanvas({
  readOnly = false,
  imageKey = null,
  initialDataUrl,
  onExport,
  onClearDrawing,
  height = 280,
  saveDelayMs = 2000,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const blobUrlRef = useRef<string | null>(null)
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialUrlRef = useRef(initialDataUrl)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [lineWidth, setLineWidth] = useState(3)
  const [locked, setLocked] = useState(!readOnly)
  const [loadingImage, setLoadingImage] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  initialUrlRef.current = initialDataUrl

  const isInteractive = !readOnly && !locked

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  const getCanvasSize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }, [])

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    try {
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
      if (historyRef.current.length > 30) historyRef.current.shift()
    } catch (err) {
      console.error('[DrawingCanvas] Falha ao salvar histórico do croqui:', err)
    }
  }, [getCtx])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    const size = getCanvasSize()
    if (!canvas || !ctx || !size) return
    ctx.clearRect(0, 0, size.width, size.height)
  }, [getCtx, getCanvasSize])

  const loadImage = useCallback(async (dataUrl: string) => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    const size = getCanvasSize()
    if (!canvas || !ctx || !size) return

    setLoadingImage(true)
    setLoadError(null)

    let objectUrl: string | null = null
    try {
      objectUrl = await urlToObjectUrl(dataUrl)
      if (objectUrl.startsWith('blob:') && objectUrl !== dataUrl) {
        blobUrlRef.current = objectUrl
      }

      await new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          clearCanvas()
          const scale = Math.min(size.width / img.width, size.height / img.height, 1)
          const w = img.width * scale
          const h = img.height * scale
          const x = (size.width - w) / 2
          const y = (size.height - h) / 2
          ctx.drawImage(img, x, y, w, h)
          resolve()
        }
        img.onerror = () => reject(new Error('Não foi possível exibir o croqui.'))
        img.src = objectUrl!
      })

      saveHistory()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar o croqui.'
      setLoadError(message)
      clearCanvas()
      saveHistory()
    } finally {
      if (objectUrl?.startsWith('blob:') && objectUrl !== dataUrl) {
        URL.revokeObjectURL(objectUrl)
        blobUrlRef.current = null
      }
      setLoadingImage(false)
    }
  }, [clearCanvas, getCanvasSize, getCtx, saveHistory])

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    const size = getCanvasSize()
    if (!canvas || !ctx || !size) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    clearCanvas()
    historyRef.current = []
  }, [clearCanvas, getCanvasSize, getCtx])

  useEffect(() => {
    setupCanvas()
    if (imageKey && initialUrlRef.current) {
      void loadImage(initialUrlRef.current)
    } else {
      saveHistory()
    }
  }, [imageKey, loadImage, saveHistory, setupCanvas])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current)
    }
  }, [])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const exportDrawing = useCallback(() => {
    const canvas = canvasRef.current
    const size = getCanvasSize()
    if (!onExport || !canvas || !size) return

    const dpr = window.devicePixelRatio || 1
    const off = document.createElement('canvas')
    off.width = canvas.width
    off.height = canvas.height
    const offCtx = off.getContext('2d')
    if (!offCtx) return

    offCtx.fillStyle = '#1a1410'
    offCtx.fillRect(0, 0, off.width, off.height)

    offCtx.strokeStyle = 'rgba(242, 216, 146, 0.14)'
    offCtx.lineWidth = 1
    const step = GRID_SIZE * dpr
    for (let x = 0; x <= off.width; x += step) {
      offCtx.beginPath()
      offCtx.moveTo(x, 0)
      offCtx.lineTo(x, off.height)
      offCtx.stroke()
    }
    for (let y = 0; y <= off.height; y += step) {
      offCtx.beginPath()
      offCtx.moveTo(0, y)
      offCtx.lineTo(off.width, y)
      offCtx.stroke()
    }

    offCtx.drawImage(canvas, 0, 0)
    off.toBlob(blob => { if (blob) onExport(blob) }, 'image/png', 0.92)
  }, [getCanvasSize, onExport])

  const scheduleExport = useCallback(() => {
    if (!onExport) return
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current)
    exportTimerRef.current = setTimeout(() => {
      exportDrawing()
    }, saveDelayMs)
  }, [exportDrawing, onExport, saveDelayMs])

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isInteractive) return
    drawingRef.current = true
    lastPointRef.current = getPoint(e)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !isInteractive) return
    const ctx = getCtx()
    const last = lastPointRef.current
    if (!ctx || !last) return
    const point = getPoint(e)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 3 : lineWidth
    ctx.strokeStyle = color
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
    lastPointRef.current = point
  }

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    saveHistory()
    canvasRef.current?.releasePointerCapture(e.pointerId)
    scheduleExport()
  }

  const undo = () => {
    if (!isInteractive) return
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (!ctx || !canvas || historyRef.current.length <= 1) return
    historyRef.current.pop()
    const prev = historyRef.current[historyRef.current.length - 1]
    if (prev) ctx.putImageData(prev, 0, 0)
    scheduleExport()
  }

  const clear = async () => {
    if (!isInteractive || clearing) return
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current)

    if (onClearDrawing && imageKey) {
      const ok = window.confirm('Apagar o croqui salvo desta pergunta?')
      if (!ok) return
      setClearing(true)
      try {
        await onClearDrawing()
        setupCanvas()
        saveHistory()
      } finally {
        setClearing(false)
      }
      return
    }

    clearCanvas()
    saveHistory()
    scheduleExport()
  }

  const toggleLock = () => {
    if (readOnly) return
    setLocked(prev => !prev)
  }

  return (
    <div className="space-y-2">
      {!readOnly && !locked && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgba(240,210,140,0.15)] bg-[rgba(0,0,0,0.2)] p-2">
          <button
            type="button"
            onClick={() => setTool('pen')}
            className={`btn btn-sm ${tool === 'pen' ? 'btn-gold' : 'btn-outline'}`}
            title="Caneta"
          >
            <Pen size={14} />
          </button>
          <button
            type="button"
            onClick={() => setTool('eraser')}
            className={`btn btn-sm ${tool === 'eraser' ? 'btn-gold' : 'btn-outline'}`}
            title="Borracha"
          >
            <Eraser size={14} />
          </button>
          <input
            type="range"
            min={1}
            max={12}
            value={lineWidth}
            onChange={e => setLineWidth(Number(e.target.value))}
            className="w-20 accent-[#f2d892]"
            title="Espessura"
          />
          <div className="flex gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { setTool('pen'); setColor(c) }}
                className="h-6 w-6 rounded-full border-2 border-white/20"
                style={{ backgroundColor: c }}
                title="Cor"
              />
            ))}
          </div>
          <button type="button" onClick={undo} className="btn btn-outline btn-sm" title="Desfazer">
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={() => void clear()}
            disabled={clearing}
            className="btn btn-outline btn-sm"
            title={imageKey ? 'Apagar croqui salvo' : 'Limpar desenho'}
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            onClick={toggleLock}
            className="btn btn-outline btn-sm ml-auto"
            title="Bloquear croqui"
          >
            <LockOpen size={14} />
            Bloquear
          </button>
        </div>
      )}

      <div
        className="relative w-full overflow-hidden rounded-lg border border-[rgba(240,210,140,0.2)] bg-[#1a1410]"
        style={{ height }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(242, 216, 146, 0.14) 1px, transparent 1px),
              linear-gradient(90deg, rgba(242, 216, 146, 0.14) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
          aria-hidden
        />

        <canvas
          ref={canvasRef}
          className={`relative z-[1] h-full w-full touch-none ${isInteractive ? 'cursor-crosshair' : 'cursor-default'}`}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />

        {!readOnly && locked && (
          <button
            type="button"
            onClick={toggleLock}
            className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 bg-[rgba(10,8,6,0.45)] text-[#f2d892] transition-colors hover:bg-[rgba(10,8,6,0.55)]"
            title="Clique para desbloquear e desenhar"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[rgba(242,216,146,0.45)] bg-[rgba(0,0,0,0.35)] shadow-lg">
              <Lock size={28} strokeWidth={1.75} />
            </span>
            <span className="text-[0.75rem] font-medium text-[#edd9c4]">
              Croqui bloqueado — clique no cadeado para editar
            </span>
          </button>
        )}

        {loadingImage && (
          <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center bg-[rgba(0,0,0,0.25)] text-[0.72rem] text-[#edd9c4]">
            Carregando croqui...
          </div>
        )}
      </div>

      {loadError && (
        <p className="text-[0.68rem] text-red-300">{loadError}</p>
      )}

      {!readOnly && onExport && (
        <p className="text-[0.68rem] text-[#edd9c4]/70">
          O croqui é salvo automaticamente alguns segundos após você parar de desenhar.
        </p>
      )}
    </div>
  )
}
