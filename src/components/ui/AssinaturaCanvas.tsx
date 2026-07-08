import { useCallback, useRef, useState } from 'react'
import { Eraser, Pen } from 'lucide-react'

interface Props {
  onExport: (dataUrl: string) => void
  height?: number
  hint?: string
}

function paintCanvasBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#faf8f5'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#d4a853'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(40, height - 48)
  ctx.lineTo(width - 40, height - 48)
  ctx.stroke()
}

export function AssinaturaCanvas({
  onExport,
  height = 200,
  hint = 'Desenhe sua assinatura com o dedo ou caneta na área abaixo',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const hasStrokeRef = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, [])

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const exportSignature = () => {
    const canvas = canvasRef.current
    if (canvas && hasStrokeRef.current) onExport(canvas.toDataURL('image/png'))
  }

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    drawingRef.current = true
    lastPointRef.current = getPoint(e)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    e.preventDefault()
    const ctx = getCtx()
    const point = getPoint(e)
    const last = lastPointRef.current
    if (!ctx || !point || !last) return

    ctx.strokeStyle = '#1a1208'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPointRef.current = point
    hasStrokeRef.current = true
    setHasStroke(true)
  }

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPointRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    paintCanvasBackground(ctx, canvas.width, canvas.height)
    hasStrokeRef.current = false
    setHasStroke(false)
  }

  const initCanvas = useCallback((node: HTMLCanvasElement | null) => {
    if (!node) return
    canvasRef.current = node
    const ctx = node.getContext('2d')
    if (!ctx) return
    paintCanvasBackground(ctx, node.width, node.height)
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-[#b8957f]">
        <Pen size={14} className="text-[#f2d892]" />
        {hint}
      </div>
      <canvas
        ref={initCanvas}
        width={560}
        height={height}
        aria-label="Área de assinatura manual"
        className="w-full min-h-[180px] cursor-crosshair touch-none select-none rounded-lg border-2 border-[rgba(212,168,83,0.45)] bg-[#faf8f5]"
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerCancel={endDraw}
        onPointerLeave={endDraw}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={clear}>
          <Eraser size={14} />
          Limpar assinatura
        </button>
        <button
          type="button"
          className="btn btn-gold btn-sm"
          disabled={!hasStroke}
          onClick={exportSignature}
        >
          Salvar
        </button>
      </div>
    </div>
  )
}
