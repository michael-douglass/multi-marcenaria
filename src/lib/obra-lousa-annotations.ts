/**
 * Contrato de anotações da Lousa (PRD):
 * - Traço livre: path SVG puro
 * - Anotação: WB_JSON:{...}
 * - Vínculo à foto: WB_IMG:{imageId}:{conteúdo}
 */

export type Point = { x: number; y: number }

export type AnnotationKind =
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'measure'
  | 'furniture_module'

export type FurnitureModuleType =
  | 'nicho_simples'
  | 'armario_2_portas'
  | 'armario_4_portas'
  | 'guarda_roupa'
  | 'cozinha_armario'
  | 'gaveta_3'
  | 'aereo_2_portas'
  | 'painel_tv'
  | 'bancada'
  | 'rack'

export interface TextAnnotation {
  kind: 'text'
  x: number
  y: number
  w: number
  h: number
  rotation: number
  text: string
  fontSize: number
}

export interface RectAnnotation {
  kind: 'rect'
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

export interface EllipseAnnotation {
  kind: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
  rotation: number
}

export interface LineAnnotation {
  kind: 'line'
  a: Point
  b: Point
}

export interface PolylineAnnotation {
  kind: 'polyline'
  points: Point[]
}

export interface MeasureAnnotation {
  kind: 'measure'
  a: Point
  b: Point
  via?: Point
  label: string
  colorHex?: string
  bidirectional?: boolean
}

export interface FurnitureAnnotation {
  kind: 'furniture_module'
  moduleType: FurnitureModuleType
  a: Point
  b: Point
  topDown?: true
  widthOverride?: number
  heightOverride?: number
  colorHex?: string
  locked?: boolean
}

export type WhiteboardAnnotation =
  | TextAnnotation
  | RectAnnotation
  | EllipseAnnotation
  | LineAnnotation
  | PolylineAnnotation
  | MeasureAnnotation
  | FurnitureAnnotation

export type ParsedPathData =
  | { type: 'stroke'; path: string; imageId: string | null }
  | { type: 'annotation'; annotation: WhiteboardAnnotation; imageId: string | null }

const WB_IMG_RE = /^WB_IMG:([0-9a-f-]{36}):([\s\S]+)$/i
const WB_JSON_PREFIX = 'WB_JSON:'

const TEXT_MIN_W = 80
const TEXT_MIN_H = 32
const TEXT_MAX_W = 2400
const TEXT_MAX_H = 1600

/** Lado de referência: grossura “6” deve ler bem com a foto encaixada no quadro. */
const INK_REF_PX = 400

/**
 * Escala de tinta da Lousa.
 * Fotos de celular (3000–4000 px) encolhem no quadro; sem esta escala o risco some.
 * Retorna ≥ 1 para fotos grandes.
 */
export function lousaInkScale(worldWidth: number, worldHeight: number): number {
  const major = Math.max(Number(worldWidth) || INK_REF_PX, Number(worldHeight) || INK_REF_PX)
  return Math.max(1, Math.min(14, major / INK_REF_PX))
}

/** Converte grossura da barra (1–16) para pixels no “mundo” da foto. */
export function lousaWorldStroke(logicalWidth: number, inkScale: number): number {
  const logical = Number.isFinite(logicalWidth) ? Math.max(1, logicalWidth) : 3
  return Math.max(2, logical * inkScale)
}

/**
 * Textos antigos (fontSize ~18) ficam miúdos em foto grande.
 * Se já parecerem dimensionados, não multiplica de novo.
 */
export function lousaTextVisualScale(fontSize: number, inkScale: number): number {
  if (inkScale <= 1.05) return 1
  const fs = Number(fontSize) || 18
  if (fs >= 16 * inkScale * 0.8) return 1
  return inkScale
}

export function clampTextBox(w: number, h: number): { w: number; h: number } {
  return {
    w: Math.min(TEXT_MAX_W, Math.max(TEXT_MIN_W, w)),
    h: Math.min(TEXT_MAX_H, Math.max(TEXT_MIN_H, h)),
  }
}

export function formatMeasureLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return String(rounded).replace('.', ',')
}

export function encodeStroke(path: string, imageId: string | null): string {
  if (!imageId) return path
  return `WB_IMG:${imageId}:${path}`
}

export function encodeAnnotation(
  annotation: WhiteboardAnnotation,
  imageId: string | null,
): string {
  const json = `${WB_JSON_PREFIX}${JSON.stringify(annotation)}`
  if (!imageId) return json
  return `WB_IMG:${imageId}:${json}`
}

function isPoint(v: unknown): v is Point {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as Point).x === 'number' &&
    typeof (v as Point).y === 'number' &&
    Number.isFinite((v as Point).x) &&
    Number.isFinite((v as Point).y)
  )
}

function parseAnnotation(raw: unknown): WhiteboardAnnotation | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const kind = obj.kind

  switch (kind) {
    case 'text': {
      if (
        typeof obj.x !== 'number' ||
        typeof obj.y !== 'number' ||
        typeof obj.w !== 'number' ||
        typeof obj.h !== 'number' ||
        typeof obj.text !== 'string'
      ) return null
      const box = clampTextBox(obj.w, obj.h)
      return {
        kind: 'text',
        x: obj.x,
        y: obj.y,
        w: box.w,
        h: box.h,
        rotation: typeof obj.rotation === 'number' ? obj.rotation : 0,
        text: obj.text,
        fontSize: typeof obj.fontSize === 'number' ? obj.fontSize : 18,
      }
    }
    case 'rect': {
      if (
        typeof obj.x !== 'number' ||
        typeof obj.y !== 'number' ||
        typeof obj.w !== 'number' ||
        typeof obj.h !== 'number'
      ) return null
      return {
        kind: 'rect',
        x: obj.x,
        y: obj.y,
        w: obj.w,
        h: obj.h,
        rotation: typeof obj.rotation === 'number' ? obj.rotation : 0,
      }
    }
    case 'ellipse': {
      if (
        typeof obj.cx !== 'number' ||
        typeof obj.cy !== 'number' ||
        typeof obj.rx !== 'number' ||
        typeof obj.ry !== 'number'
      ) return null
      return {
        kind: 'ellipse',
        cx: obj.cx,
        cy: obj.cy,
        rx: obj.rx,
        ry: obj.ry,
        rotation: typeof obj.rotation === 'number' ? obj.rotation : 0,
      }
    }
    case 'line': {
      if (!isPoint(obj.a) || !isPoint(obj.b)) return null
      return { kind: 'line', a: obj.a, b: obj.b }
    }
    case 'polyline': {
      if (!Array.isArray(obj.points) || obj.points.length < 2) return null
      const points = obj.points.filter(isPoint)
      if (points.length < 2) return null
      return { kind: 'polyline', points }
    }
    case 'measure': {
      if (!isPoint(obj.a) || !isPoint(obj.b)) return null
      return {
        kind: 'measure',
        a: obj.a,
        b: obj.b,
        via: isPoint(obj.via) ? obj.via : undefined,
        label: typeof obj.label === 'string' ? obj.label : '0',
        colorHex: typeof obj.colorHex === 'string' ? obj.colorHex : undefined,
        bidirectional: obj.bidirectional !== false,
      }
    }
    case 'furniture_module': {
      if (!isPoint(obj.a) || !isPoint(obj.b) || typeof obj.moduleType !== 'string') return null
      return {
        kind: 'furniture_module',
        moduleType: obj.moduleType as FurnitureModuleType,
        a: obj.a,
        b: obj.b,
        topDown: true,
        widthOverride: typeof obj.widthOverride === 'number' ? obj.widthOverride : undefined,
        heightOverride: typeof obj.heightOverride === 'number' ? obj.heightOverride : undefined,
        colorHex: typeof obj.colorHex === 'string' ? obj.colorHex : undefined,
        locked: obj.locked === true,
      }
    }
    default:
      return null
  }
}

export function parsePathData(pathData: string): ParsedPathData | null {
  let imageId: string | null = null
  let content = pathData

  const imgMatch = content.match(WB_IMG_RE)
  if (imgMatch) {
    imageId = imgMatch[1]
    content = imgMatch[2]
  }

  if (content.startsWith(WB_JSON_PREFIX)) {
    try {
      const parsed = JSON.parse(content.slice(WB_JSON_PREFIX.length)) as unknown
      const annotation = parseAnnotation(parsed)
      if (!annotation) return null
      return { type: 'annotation', annotation, imageId }
    } catch {
      return null
    }
  }

  if (!content.trim().startsWith('M')) return null
  return { type: 'stroke', path: content, imageId }
}

export function stripImagePrefix(pathData: string): string {
  const m = pathData.match(WB_IMG_RE)
  return m ? m[2] : pathData
}

export function extractImageId(pathData: string): string | null {
  const m = pathData.match(WB_IMG_RE)
  return m ? m[1] : null
}

export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}

export function midPoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Move qualquer anotação em dx/dy (coordenadas da foto). */
export function offsetAnnotation(
  annotation: WhiteboardAnnotation,
  dx: number,
  dy: number,
): WhiteboardAnnotation {
  if (dx === 0 && dy === 0) return annotation
  const shift = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy })

  switch (annotation.kind) {
    case 'text':
    case 'rect':
      return { ...annotation, x: annotation.x + dx, y: annotation.y + dy }
    case 'ellipse':
      return { ...annotation, cx: annotation.cx + dx, cy: annotation.cy + dy }
    case 'line':
      return { ...annotation, a: shift(annotation.a), b: shift(annotation.b) }
    case 'polyline':
      return { ...annotation, points: annotation.points.map(shift) }
    case 'measure':
      return {
        ...annotation,
        a: shift(annotation.a),
        b: shift(annotation.b),
        via: annotation.via ? shift(annotation.via) : undefined,
      }
    case 'furniture_module':
      return { ...annotation, a: shift(annotation.a), b: shift(annotation.b) }
    default:
      return annotation
  }
}
