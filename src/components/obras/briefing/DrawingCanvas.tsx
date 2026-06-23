import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, Pen, RotateCcw, Trash2 } from 'lucide-react'

interface DrawingCanvasProps {
  readOnly?: boolean
  initialDataUrl?: string | null
  onExport?: (blob: Blob) => void
  height?: number
}

const COLORS = ['#f2d892', '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#000000']

export function DrawingCanvas({
  readOnly = false,
  initialDataUrl,
  onExport,
  height = 280,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [lineWidth, setLineWidth] = useState(3)

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (historyRef.current.length > 30) historyRef.current.shift()
  }, [getCtx])

  const loadImage = useCallback((dataUrl: string) => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = '#1a1410'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1)
      const w = img.width * scale
      const h = img.height * scale
      const x = (canvas.width - w) / 2
      const y = (canvas.height - h) / 2
      ctx.drawImage(img, x, y, w, h)
      saveHistory()
    }
    img.src = dataUrl
  }, [getCtx, saveHistory])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#1a1410'
    ctx.fillRect(0, 0, rect.width, rect.height)
    if (initialDataUrl) loadImage(initialDataUrl)
    else saveHistory()
  }, [getCtx, initialDataUrl, loadImage, saveHistory])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    drawingRef.current = true
    lastPointRef.current = getPoint(e)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || readOnly) return
    const ctx = getCtx()
    const last = lastPointRef.current
    if (!ctx || !last) return
    const point = getPoint(e)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 3 : lineWidth
    ctx.strokeStyle = tool === 'eraser' ? '#1a1410' : color
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
    if (onExport && canvasRef.current) {
      canvasRef.current.toBlob(blob => { if (blob) onExport(blob) }, 'image/png', 0.92)
    }
  }

  const undo = () => {
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (!ctx || !canvas || historyRef.current.length <= 1) return
    historyRef.current.pop()
    const prev = historyRef.current[historyRef.current.length - 1]
    if (prev) ctx.putImageData(prev, 0, 0)
    if (onExport) {
      canvas.toBlob(blob => { if (blob) onExport(blob) }, 'image/png', 0.92)
    }
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx || readOnly) return
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#1a1410'
    ctx.fillRect(0, 0, rect.width, rect.height)
    saveHistory()
    if (onExport) {
      canvas.toBlob(blob => { if (blob) onExport(blob) }, 'image/png', 0.92)
    }
  }

  return (
    <div className="space-y-2">
      {!readOnly && (
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
          <button type="button" onClick={clear} className="btn btn-outline btn-sm" title="Limpar">
            <Trash2 size={14} />
          </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full touch-none rounded-lg border border-[rgba(240,210,140,0.2)] bg-[#1a1410]"
        style={{ height }}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
      />
    </div>
  )
}
