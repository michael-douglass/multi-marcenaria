import {
  distance,
  formatMeasureLabel,
  midPoint,
  parsePathData,
  lousaTextVisualScale,
  type FurnitureModuleType,
  type Point,
  type WhiteboardAnnotation,
} from '@/lib/obra-lousa-annotations'
import { furnitureModulePaths } from '@/lib/obra-lousa-furniture'
import type { ObraLousaDrawing } from '@/lib/obra-lousa'

interface Props {
  drawings: ObraLousaDrawing[]
  selectedId: string | null
  draftAnnotation: WhiteboardAnnotation | null
  draftStroke: string | null
  draftColor: string
  /** Grossura já em pixels do mundo (com inkScale aplicado). */
  draftStrokeWidth: number
  inkScale?: number
  readOnly?: boolean
  /** Posição ao vivo enquanto arrasta (antes de gravar). */
  liveOverride?: { id: string; annotation: WhiteboardAnnotation } | null
  onSelect: (id: string | null) => void
  onAnnotationPointerDown?: (
    id: string,
    annotation: WhiteboardAnnotation,
    e: React.PointerEvent,
  ) => void
  onAnnotationDoubleClick?: (id: string, annotation: WhiteboardAnnotation) => void
}

function MeasureGfx({
  a, b, via, label, color, strokeWidth, ink,
}: {
  a: Point
  b: Point
  via?: Point
  label: string
  color: string
  strokeWidth: number
  ink: number
}) {
  const s = Math.max(1, ink)
  const labelPt = via ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 16 * s }
  const d = via
    ? `M ${a.x} ${a.y} Q ${via.x} ${via.y} ${b.x} ${b.y}`
    : `M ${a.x} ${a.y} L ${b.x} ${b.y}`
  const fontSize = Math.round(18 * s)
  const padX = Math.max(22, label.length * 6) * s
  const boxH = 28 * s
  const r = 5 * s

  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx={a.x} cy={a.y} r={r} fill={color} />
      <circle cx={b.x} cy={b.y} r={r} fill={color} />
      {via && <circle cx={via.x} cy={via.y} r={4 * s} fill={color} opacity={0.7} />}
      <rect
        x={labelPt.x - padX}
        y={labelPt.y - boxH / 2}
        width={padX * 2}
        height={boxH}
        rx={6 * s}
        fill="rgba(12, 10, 8, 0.88)"
        stroke={color}
        strokeWidth={Math.max(2, strokeWidth * 0.45)}
      />
      <text
        x={labelPt.x}
        y={labelPt.y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={fontSize}
        fontWeight={800}
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        {label}
      </text>
    </g>
  )
}

function FurnitureGfx({
  moduleType, a, b, color, strokeWidth, widthOverride,
}: {
  moduleType: FurnitureModuleType
  a: Point
  b: Point
  color: string
  strokeWidth: number
  widthOverride?: number
}) {
  const paths = furnitureModulePaths(moduleType, a.x, a.y, b.x, b.y, widthOverride)
  return (
    <g>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      ))}
    </g>
  )
}

function AnnotationGfx({
  annotation,
  color,
  strokeWidth,
  selected,
  ink,
}: {
  annotation: WhiteboardAnnotation
  color: string
  strokeWidth: number
  selected: boolean
  ink: number
}) {
  const sel = selected ? { strokeDasharray: `${8 * ink} ${5 * ink}`, opacity: 1 } : {}

  switch (annotation.kind) {
    case 'line':
      return (
        <line
          x1={annotation.a.x} y1={annotation.a.y}
          x2={annotation.b.x} y2={annotation.b.y}
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" {...sel}
        />
      )
    case 'polyline':
      return (
        <polyline
          points={annotation.points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeLinejoin="round" {...sel}
        />
      )
    case 'rect':
      return (
        <rect
          x={annotation.x} y={annotation.y}
          width={annotation.w} height={annotation.h}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          transform={`rotate(${annotation.rotation} ${annotation.x + annotation.w / 2} ${annotation.y + annotation.h / 2})`}
          {...sel}
        />
      )
    case 'ellipse':
      return (
        <ellipse
          cx={annotation.cx} cy={annotation.cy}
          rx={Math.abs(annotation.rx)} ry={Math.abs(annotation.ry)}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          transform={`rotate(${annotation.rotation} ${annotation.cx} ${annotation.cy})`}
          {...sel}
        />
      )
    case 'text': {
      const ts = lousaTextVisualScale(annotation.fontSize, ink)
      const w = Math.max(annotation.w, 120) * ts
      const h = Math.max(annotation.h, 40) * ts
      const fontSize = (annotation.fontSize || 18) * ts
      const pad = 12 * Math.max(1, ts)
      return (
        <g transform={`rotate(${annotation.rotation} ${annotation.x + w / 2} ${annotation.y + h / 2})`}>
          <rect
            x={annotation.x}
            y={annotation.y}
            width={w}
            height={h}
            fill="rgba(12, 10, 8, 0.88)"
            stroke={color}
            strokeWidth={selected ? Math.max(3, 2.5 * ts) : Math.max(2, 2 * ts)}
            rx={8 * Math.max(1, ts * 0.6)}
            {...sel}
          />
          <text
            x={annotation.x + pad}
            y={annotation.y + fontSize + pad * 0.55}
            fill={color}
            fontSize={fontSize}
            fontWeight={800}
            fontFamily="Georgia, 'Times New Roman', serif"
          >
            {(annotation.text || 'Digite o texto…').slice(0, 80)}
          </text>
        </g>
      )
    }
    case 'measure':
      return (
        <MeasureGfx
          a={annotation.a}
          b={annotation.b}
          via={annotation.via}
          label={annotation.label}
          color={annotation.colorHex ?? color}
          strokeWidth={strokeWidth}
          ink={ink}
        />
      )
    case 'furniture_module':
      return (
        <FurnitureGfx
          moduleType={annotation.moduleType}
          a={annotation.a}
          b={annotation.b}
          color={annotation.colorHex ?? color}
          strokeWidth={strokeWidth}
          widthOverride={annotation.widthOverride}
        />
      )
    default:
      return null
  }
}

function worldStrokeOf(logical: number | string | null | undefined, ink: number): number {
  const n = Number(logical)
  const base = Number.isFinite(n) && n > 0 ? n : 3
  return Math.max(2, base * ink)
}

export function ObraLousaAnnotationsLayer({
  drawings,
  selectedId,
  draftAnnotation,
  draftStroke,
  draftColor,
  draftStrokeWidth,
  inkScale = 1,
  readOnly,
  liveOverride,
  onSelect,
  onAnnotationPointerDown,
  onAnnotationDoubleClick,
}: Props) {
  const ink = Math.max(1, inkScale)

  return (
    <g>
      {drawings.map(d => {
        const parsed = parsePathData(d.path_data)
        if (!parsed) return null
        const selected = selectedId === d.id
        const sw = worldStrokeOf(d.stroke_width, ink)
        if (parsed.type === 'stroke') {
          return (
            <g key={d.id}>
              {/* área de clique mais larga (borracha / selecionar) */}
              <path
                d={parsed.path}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(28 * ink, sw + 18 * ink)}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
                onPointerDown={e => {
                  e.stopPropagation()
                  if (!readOnly) onSelect(d.id)
                }}
              />
              <path
                d={parsed.path}
                fill="none"
                stroke={d.cor}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
                opacity={selected ? 0.9 : 1}
              />
            </g>
          )
        }
        const annotation =
          liveOverride?.id === d.id ? liveOverride.annotation : parsed.annotation
        return (
          <g
            key={d.id}
            style={{ cursor: readOnly ? 'default' : selected ? 'grab' : 'pointer' }}
            onPointerDown={e => {
              e.stopPropagation()
              if (readOnly) return
              if (onAnnotationPointerDown) {
                onAnnotationPointerDown(d.id, parsed.annotation, e)
              } else {
                onSelect(d.id)
              }
            }}
            onDoubleClick={e => {
              e.stopPropagation()
              if (!readOnly) onAnnotationDoubleClick?.(d.id, annotation)
            }}
          >
            <AnnotationGfx
              annotation={annotation}
              color={d.cor}
              strokeWidth={sw}
              selected={selected}
              ink={ink}
            />
          </g>
        )
      })}

      {draftStroke && (
        <path
          d={draftStroke}
          fill="none"
          stroke={draftColor}
          strokeWidth={draftStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.95}
        />
      )}

      {draftAnnotation && (
        <AnnotationGfx
          annotation={draftAnnotation}
          color={draftColor}
          strokeWidth={draftStrokeWidth}
          selected={false}
          ink={ink}
        />
      )}
    </g>
  )
}

/** Helpers usados pelo board principal para construir drafts. */
export function buildRect(a: Point, b: Point): WhiteboardAnnotation {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { kind: 'rect', x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), rotation: 0 }
}

export function buildEllipse(a: Point, b: Point): WhiteboardAnnotation {
  return {
    kind: 'ellipse',
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
    rx: Math.abs(b.x - a.x) / 2,
    ry: Math.abs(b.y - a.y) / 2,
    rotation: 0,
  }
}

export function buildLine(a: Point, b: Point): WhiteboardAnnotation {
  return { kind: 'line', a, b }
}

export function buildMeasure(a: Point, b: Point, via?: Point): WhiteboardAnnotation {
  const len = via ? distance(a, via) + distance(via, b) : distance(a, b)
  // assume ~1 px ≈ 0.1 cm se usuário não editar — label editável depois
  const cm = len / 10
  return {
    kind: 'measure',
    a,
    b,
    via,
    label: formatMeasureLabel(cm),
    bidirectional: true,
  }
}

export function buildText(at: Point, fontSize = 26, inkScale = 1): WhiteboardAnnotation {
  const ink = Math.max(1, inkScale)
  return {
    kind: 'text',
    x: at.x,
    y: at.y,
    w: Math.round(340 * ink),
    h: Math.round(96 * ink),
    rotation: 0,
    text: '',
    fontSize: Math.round(fontSize * ink),
  }
}

export function buildFurniture(
  moduleType: FurnitureModuleType,
  a: Point,
  b: Point,
  color: string,
): WhiteboardAnnotation {
  return {
    kind: 'furniture_module',
    moduleType,
    a,
    b,
    topDown: true,
    colorHex: color,
    locked: false,
  }
}

export { midPoint, distance }
