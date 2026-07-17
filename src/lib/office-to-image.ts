import mammoth from 'mammoth'

const PAGE_W = 794
const PAGE_H = 1123
const MAX_PAGES = 50
const JPG_QUALITY = 0.88
const READ_TIMEOUT_MS = 15_000
const FONT = "Georgia, 'Times New Roman', Times, serif"

/** Converte .docx / .dotx em páginas JPG para pré-visualização e leitura no card. */
export async function officeWordToJpgBlobs(file: File): Promise<Blob[]> {
  const arrayBuffer = await file.arrayBuffer()

  let text = ''
  try {
    text = await withTimeout(
      extractWordText(arrayBuffer),
      READ_TIMEOUT_MS,
      'A leitura do Word demorou demais. Tente novamente ou use um .docx.',
    )
  } catch (err) {
    // Prévia mínima para não travar o upload
    console.warn('[office-to-image]', err)
    text = `Arquivo: ${file.name}\n\n(Não foi possível extrair o texto deste Word para pré-visualização. O arquivo original será salvo normalmente.)`
  }

  const content = text.trim() || `(Documento: ${file.name})`
  return renderTextPagesToJpg(content)
}

async function extractWordText(arrayBuffer: ArrayBuffer): Promise<string> {
  // buffer + arrayBuffer: cobre build Node e browser do mammoth no Vite
  const result = await mammoth.extractRawText({
    arrayBuffer,
    buffer: arrayBuffer,
  } as { arrayBuffer: ArrayBuffer; buffer: ArrayBuffer })

  return (result.value || '').trim()
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      value => {
        window.clearTimeout(timer)
        resolve(value)
      },
      err => {
        window.clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      },
    )
  })
}

async function renderTextPagesToJpg(text: string): Promise<Blob[]> {
  const canvas = document.createElement('canvas')
  canvas.width = PAGE_W
  canvas.height = PAGE_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível renderizar o documento.')

  const pad = 48
  const lineH = 22
  const maxWidth = PAGE_W - pad * 2
  ctx.font = `15px ${FONT}`

  const paragraphs = text.split(/\r?\n/)
  const lines: string[] = []
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('')
      continue
    }
    const words = para.split(/\s+/)
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (ctx.measureText(next).width <= maxWidth) {
        current = next
      } else {
        if (current) lines.push(current)
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = ''
          for (const ch of word) {
            const tryChunk = chunk + ch
            if (ctx.measureText(tryChunk).width > maxWidth && chunk) {
              lines.push(chunk)
              chunk = ch
            } else {
              chunk = tryChunk
            }
          }
          current = chunk
        } else {
          current = word
        }
      }
    }
    if (current) lines.push(current)
  }

  const linesPerPage = Math.max(1, Math.floor((PAGE_H - pad * 2) / lineH))
  const pageCount = Math.min(Math.max(1, Math.ceil(lines.length / linesPerPage) || 1), MAX_PAGES)
  const blobs: Blob[] = []

  for (let page = 0; page < pageCount; page++) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `15px ${FONT}`
    ctx.textBaseline = 'top'

    const start = page * linesPerPage
    const slice = lines.slice(start, start + linesPerPage)
    slice.forEach((line, i) => {
      ctx.fillText(line, pad, pad + i * lineH)
    })

    blobs.push(await canvasToJpg(canvas))
  }

  return blobs
}

function canvasToJpg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Falha ao gerar JPG do documento.'))),
      'image/jpeg',
      JPG_QUALITY,
    )
  })
}
