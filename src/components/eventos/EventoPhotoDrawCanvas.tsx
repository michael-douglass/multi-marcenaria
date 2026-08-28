import { useRef, useState } from 'react'
import type { EventoDesenho } from '@/lib/evento-types'
import { EVENTO_LAPIS_CORES } from '@/lib/evento-types'
import { cn } from '@/lib/utils'

interface EventoPhotoDrawCanvasProps {
  src: string
  anotacoes: EventoDesenho[]
  onChange: (next: EventoDesenho[]) => void
}

function pontoSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect()
  const x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 1000
  const y = ((clientY - rect.top) / Math.max(rect.height, 1)) * 1000
  return { x, y }
}

export function EventoPhotoDrawCanvas({ src, anotacoes, onChange }: EventoPhotoDrawCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<'lapis' | 'borracha'>('lapis')
  const [cor, setCor] = useState<string>(EVENTO_LAPIS_CORES[0])
  const [espessura, setEspessura] = useState(4)
  const drawingRef = useRef<{ id: string; points: string } | null>(null)

  const endStroke = () => {
    const current = drawingRef.current
    drawingRef.current = null
    if (!current || !current.points.includes(' L ')) return
    onChange([
      ...anotacoes,
      { id: current.id, path_data: current.points, cor, stroke_width: espessura },
    ])
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <img src={src} alt="" className="block h-auto w-full" />
        <svg
          ref={svgRef}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={(event) => {
            if (tool === 'borracha') {
              const id = (event.target as SVGElement).getAttribute('data-drawing-id')
              if (id) onChange(anotacoes.filter((d) => d.id !== id))
              return
            }
            const svg = svgRef.current
            if (!svg) return
            svg.setPointerCapture(event.pointerId)
            const { x, y } = pontoSvg(svg, event.clientX, event.clientY)
            drawingRef.current = { id: crypto.randomUUID(), points: `M ${x.toFixed(1)} ${y.toFixed(1)}` }
          }}
          onPointerMove={(event) => {
            if (tool === 'borracha') {
              if (event.buttons === 0) return
              const id = (event.target as SVGElement).getAttribute('data-drawing-id')
              if (id) onChange(anotacoes.filter((d) => d.id !== id))
              return
            }
            const current = drawingRef.current
            const svg = svgRef.current
            if (!current || !svg) return
            const { x, y } = pontoSvg(svg, event.clientX, event.clientY)
            current.points += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
            const live = svg.querySelector('[data-live="1"]') as SVGPathElement | null
            if (live) live.setAttribute('d', current.points)
          }}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        >
          {anotacoes.map((desenho) => (
            <path
              key={desenho.id}
              data-drawing-id={desenho.id}
              d={desenho.path_data}
              fill="none"
              stroke={desenho.cor}
              strokeWidth={desenho.stroke_width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <path data-live="1" d="" fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round" />
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn('btn btn-sm', tool === 'lapis' ? 'btn-gold' : 'btn-outline')}
          onClick={() => setTool('lapis')}
        >
          Lápis
        </button>
        <button
          type="button"
          className={cn('btn btn-sm', tool === 'borracha' ? 'btn-gold' : 'btn-outline')}
          onClick={() => setTool('borracha')}
        >
          Borracha
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onChange([])}
        >
          Limpar traços
        </button>
        <div className="flex gap-1">
          {EVENTO_LAPIS_CORES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              className={cn('h-6 w-6 rounded-full border', cor === c && 'ring-2 ring-gold')}
              style={{ background: c }}
              onClick={() => setCor(c)}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-cream-faint">
          Espessura
          <input
            type="range"
            min={2}
            max={14}
            value={espessura}
            onChange={(e) => setEspessura(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  )
}
