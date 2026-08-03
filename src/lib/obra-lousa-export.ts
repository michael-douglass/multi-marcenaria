import {
  parsePathData,
  type MeasureAnnotation,
  type Point,
  type WhiteboardAnnotation,
} from '@/lib/obra-lousa-annotations'
import { furnitureModulePaths } from '@/lib/obra-lousa-furniture'
import type { ObraLousaDrawing } from '@/lib/obra-lousa'

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: WhiteboardAnnotation,
  color: string,
  strokeWidth: number,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = strokeWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  switch (annotation.kind) {
    case 'line': {
      ctx.beginPath()
      ctx.moveTo(annotation.a.x, annotation.a.y)
      ctx.lineTo(annotation.b.x, annotation.b.y)
      ctx.stroke()
      break
    }
    case 'polyline': {
      if (annotation.points.length < 2) break
      ctx.beginPath()
      ctx.moveTo(annotation.points[0].x, annotation.points[0].y)
      for (let i = 1; i < annotation.points.length; i++) {
        ctx.lineTo(annotation.points[i].x, annotation.points[i].y)
      }
      ctx.stroke()
      break
    }
    case 'rect': {
      ctx.translate(annotation.x + annotation.w / 2, annotation.y + annotation.h / 2)
      ctx.rotate((annotation.rotation * Math.PI) / 180)
      ctx.strokeRect(-annotation.w / 2, -annotation.h / 2, annotation.w, annotation.h)
      break
    }
    case 'ellipse': {
      ctx.translate(annotation.cx, annotation.cy)
      ctx.rotate((annotation.rotation * Math.PI) / 180)
      ctx.beginPath()
      ctx.ellipse(0, 0, Math.abs(annotation.rx), Math.abs(annotation.ry), 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'text': {
      ctx.translate(annotation.x + annotation.w / 2, annotation.y + annotation.h / 2)
      ctx.rotate((annotation.rotation * Math.PI) / 180)
      ctx.font = `${annotation.fontSize}px Inter, system-ui, sans-serif`
      ctx.textBaseline = 'top'
      ctx.fillText(annotation.text || 'Texto', -annotation.w / 2 + 4, -annotation.h / 2 + 4, annotation.w - 8)
      ctx.strokeRect(-annotation.w / 2, -annotation.h / 2, annotation.w, annotation.h)
      break
    }
    case 'measure': {
      drawMeasure(ctx, annotation, color, strokeWidth)
      break
    }
    case 'furniture_module': {
      const paths = furnitureModulePaths(
        annotation.moduleType,
        annotation.a.x,
        annotation.a.y,
        annotation.b.x,
        annotation.b.y,
        annotation.widthOverride,
      )
      ctx.strokeStyle = annotation.colorHex ?? color
      for (const p of paths) {
        const path = new Path2D(p)
        ctx.stroke(path)
      }
      break
    }
  }

  ctx.restore()
}

function drawMeasure(
  ctx: CanvasRenderingContext2D,
  m: MeasureAnnotation,
  color: string,
  strokeWidth: number,
): void {
  const c = m.colorHex ?? color
  ctx.strokeStyle = c
  ctx.fillStyle = c
  ctx.lineWidth = strokeWidth

  ctx.beginPath()
  ctx.moveTo(m.a.x, m.a.y)
  if (m.via) {
    ctx.quadraticCurveTo(m.via.x, m.via.y, m.b.x, m.b.y)
  } else {
    ctx.lineTo(m.b.x, m.b.y)
  }
  ctx.stroke()

  // setas simples
  drawArrowHead(ctx, m.b, m.via ?? m.a, 10)
  drawArrowHead(ctx, m.a, m.via ?? m.b, 10)

  const labelPoint: Point = m.via
    ? m.via
    : { x: (m.a.x + m.b.x) / 2, y: (m.a.y + m.b.y) / 2 - 14 }

  ctx.font = 'bold 16px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const pad = 6
  const metrics = ctx.measureText(m.label)
  const tw = metrics.width + pad * 2
  const th = 22
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(labelPoint.x - tw / 2, labelPoint.y - th / 2, tw, th)
  ctx.fillStyle = c
  ctx.fillText(m.label, labelPoint.x, labelPoint.y)
}

function drawArrowHead(ctx: CanvasRenderingContext2D, tip: Point, from: Point, size: number): void {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(
    tip.x - size * Math.cos(angle - Math.PI / 6),
    tip.y - size * Math.sin(angle - Math.PI / 6),
  )
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(
    tip.x - size * Math.cos(angle + Math.PI / 6),
    tip.y - size * Math.sin(angle + Math.PI / 6),
  )
  ctx.stroke()
}

/**
 * Gera JPEG com a foto + todos os riscos/anotações.
 */
export async function exportObraLousaJpeg(input: {
  imageUrl: string
  width: number
  height: number
  drawings: ObraLousaDrawing[]
  quality?: number
}): Promise<Blob> {
  const { imageUrl, width, height, drawings, quality = 0.92 } = input

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Falha ao carregar a foto para exportar.'))
    el.src = imageUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width || img.naturalWidth || 1280))
  canvas.height = Math.max(1, Math.round(height || img.naturalHeight || 720))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível.')

  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  for (const drawing of drawings) {
    const parsed = parsePathData(drawing.path_data)
    if (!parsed) continue
    if (parsed.type === 'stroke') {
      ctx.save()
      ctx.strokeStyle = drawing.cor
      ctx.lineWidth = Number(drawing.stroke_width) || 3
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke(new Path2D(parsed.path))
      ctx.restore()
    } else {
      drawAnnotation(ctx, parsed.annotation, drawing.cor, Number(drawing.stroke_width) || 3)
    }
  }

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(b => resolve(b), 'image/jpeg', quality),
  )
  if (!blob) throw new Error('Não foi possível gerar o JPEG.')
  return blob
}
