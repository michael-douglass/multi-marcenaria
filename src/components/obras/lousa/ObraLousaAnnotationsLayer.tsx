import {
  distance,
  formatMeasureLabel,
  midPoint,
  parsePathData,
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
  draftStrokeWidth: number
  readOnly?: boolean
  onSelect: (id: string | null) => void
  onUpdateSelected?: (id: string, annotation: WhiteboardAnnotation) => void
}

function MeasureGfx({
  a, b, via, label, color, strokeWidth,
}: {
  a: Point
  b: Point
  via?: Point
  label: string
  color: string
  strokeWidth: number
}) {
  const labelPt = via ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 16 }
  const d = via
    ? `M ${a.x} ${a.y} Q ${via.x} ${via.y} ${b.x} ${b.y}`
    : `M ${a.x} ${a.y} L ${b.x} ${b.y}`

  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} />
      <circle cx={a.x} cy={a.y} r={4} fill={color} />
      <circle cx={b.x} cy={b.y} r={4} fill={color} />
      {via && <circle cx={via.x} cy={via.y} r={3} fill={color} opacity={0.7} />}
      <rect
        x={labelPt.x - Math.max(18, label.length * 5)}
        y={labelPt.y - 11}
        width={Math.max(36, label.length * 10)}
        height={22}
        rx={4}
        fill="rgba(0,0,0,0.55)"
      />
      <text
        x={labelPt.x}
        y={labelPt.y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={14}
        fontWeight={700}
        fontFamily="Inter, system-ui, sans-serif"
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
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={strokeWidth} />
      ))}
    </g>
  )
}

function AnnotationGfx({
  annotation,
  color,
  strokeWidth,
  selected,
}: {
  annotation: WhiteboardAnnotation
  color: string
  strokeWidth: number
  selected: boolean
}) {
  const sel = selected ? { strokeDasharray: '6 4', opacity: 1 } : {}

  switch (annotation.kind) {
    case 'line':
      return (
        <line
          x1={annotation.a.x} y1={annotation.a.y}
          x2={annotation.b.x} y2={annotation.b.y}
          stroke={color} strokeWidth={strokeWidth} {...sel}
        />
      )
    case 'polyline':
      return (
        <polyline
          points={annotation.points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke={color} strokeWidth={strokeWidth} {...sel}
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
    case 'text':
      return (
        <g transform={`rotate(${annotation.rotation} ${annotation.x + annotation.w / 2} ${annotation.y + annotation.h / 2})`}>
          <rect
            x={annotation.x} y={annotation.y}
            width={annotation.w} height={annotation.h}
            fill="rgba(0,0,0,0.25)" stroke={color} strokeWidth={1.5}
            {...sel}
          />
          <foreignObject x={annotation.x} y={annotation.y} width={annotation.w} height={annotation.h}>
            <div
              style={{
                color,
                fontSize: annotation.fontSize,
                padding: 4,
                overflow: 'hidden',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'Inter, system-ui, sans-serif',
                lineHeight: 1.2,
              }}
            >
              {annotation.text || 'Texto'}
            </div>
          </foreignObject>
        </g>
      )
    case 'measure':
      return (
        <MeasureGfx
          a={annotation.a}
          b={annotation.b}
          via={annotation.via}
          label={annotation.label}
          color={annotation.colorHex ?? color}
          strokeWidth={strokeWidth}
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

export function ObraLousaAnnotationsLayer({
  drawings,
  selectedId,
  draftAnnotation,
  draftStroke,
  draftColor,
  draftStrokeWidth,
  readOnly,
  onSelect,
}: Props) {
  return (
    <g>
      {drawings.map(d => {
        const parsed = parsePathData(d.path_data)
        if (!parsed) return null
        const selected = selectedId === d.id
        if (parsed.type === 'stroke') {
          return (
            <g key={d.id}>
              {/* área de clique mais larga (borracha / selecionar) */}
              <path
                d={parsed.path}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(18, (Number(d.stroke_width) || 3) + 14)}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
                onClick={e => {
                  e.stopPropagation()
                  if (!readOnly) onSelect(d.id)
                }}
              />
              <path
                d={parsed.path}
                fill="none"
                stroke={d.cor}
                strokeWidth={Number(d.stroke_width) || 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
                opacity={selected ? 0.85 : 1}
              />
            </g>
          )
        }
        return (
          <g
            key={d.id}
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
            onClick={e => {
              e.stopPropagation()
              if (!readOnly) onSelect(d.id)
            }}
          >
            <AnnotationGfx
              annotation={parsed.annotation}
              color={d.cor}
              strokeWidth={Number(d.stroke_width) || 3}
              selected={selected}
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
          opacity={0.9}
        />
      )}

      {draftAnnotation && (
        <AnnotationGfx
          annotation={draftAnnotation}
          color={draftColor}
          strokeWidth={draftStrokeWidth}
          selected={false}
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

export function buildText(at: Point, fontSize = 18): WhiteboardAnnotation {
  return {
    kind: 'text',
    x: at.x,
    y: at.y,
    w: 160,
    h: 48,
    rotation: 0,
    text: '',
    fontSize,
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
