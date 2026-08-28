import type { EventoDesenho } from '@/lib/evento-types'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível ler a foto'))
    img.src = src
  })
}

/** Achata foto + traços SVG (viewBox 1000) num JPEG. */
export async function compositeEventoPhoto(
  src: string,
  anotacoes: EventoDesenho[],
): Promise<string> {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const sx = canvas.width / 1000
  const sy = canvas.height / 1000
  for (const traço of anotacoes) {
    const path = new Path2D(traço.path_data)
    ctx.save()
    ctx.scale(sx, sy)
    ctx.strokeStyle = traço.cor
    ctx.lineWidth = traço.stroke_width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(path)
    ctx.restore()
  }
  return canvas.toDataURL('image/jpeg', 0.88)
}
