/**
 * Miniaturas permanentes da pasta (quote-projects/.../thumbs).
 * Separadas de pages/ (JPEG do pipeline / IA) para não sobrescrever qualidade fabril.
 */
import { supabase } from '@/lib/supabase'
import { getSignedPdfUrl } from '@/lib/orcamentos-ia/quote-tree'
import { ORCAMENTOS_IA_BUCKET } from '@/lib/orcamentos-ia/storage'
import {
  loadPdfDocument,
  loadPdfFromFile,
  renderPdfPageFromDocument,
} from '@/lib/pdf-render'

export const PROJECT_THUMB_WIDTH = 240

/** Path de miniatura leve (prévia da grade — não é a página do pipeline). */
export function buildQuoteProjectThumbPath(
  companyId: string,
  projectId: string,
  pageNumber: number,
): string {
  return `${companyId}/quote-projects/${projectId}/thumbs/page-${String(pageNumber).padStart(3, '0')}.jpg`
}

function dataUrlToJpegBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const header = comma >= 0 ? dataUrl.slice(0, comma) : ''
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const mime = /data:([^;]+)/.exec(header)?.[1] || 'image/jpeg'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

async function listPageNumbersInPrefix(
  prefix: string,
  pageCount: number,
): Promise<Map<number, string>> {
  const { data } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).list(prefix, {
    limit: 300,
    sortBy: { column: 'name', order: 'asc' },
  })
  const map = new Map<number, string>()
  for (const o of data || []) {
    const m = o.name.match(/page-(\d+)\.(?:png|jpe?g|webp)$/i)
    if (!m) continue
    const n = Number(m[1])
    if (n >= 1 && n <= pageCount) map.set(n, `${prefix}/${o.name}`)
  }
  return map
}

/** Carrega URLs assinadas: prioriza pages/ (pipeline), completa com thumbs/. */
export async function loadProjectPageThumbUrls(
  companyId: string,
  projectId: string,
  pageCount: number,
): Promise<Map<number, string>> {
  const pagesPrefix = `${companyId}/quote-projects/${projectId}/pages`
  const thumbsPrefix = `${companyId}/quote-projects/${projectId}/thumbs`
  const [fromPages, fromThumbs] = await Promise.all([
    listPageNumbersInPrefix(pagesPrefix, pageCount),
    listPageNumbersInPrefix(thumbsPrefix, pageCount),
  ])
  const pathByPage = new Map<number, string>()
  for (const [n, path] of fromPages) pathByPage.set(n, path)
  for (const [n, path] of fromThumbs) {
    if (!pathByPage.has(n)) pathByPage.set(n, path)
  }
  if (!pathByPage.size) return new Map()

  const entries = [...pathByPage.entries()].sort((a, b) => a[0] - b[0])
  const { data: signed } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .createSignedUrls(
      entries.map(([, path]) => path),
      60 * 60,
    )
  const urls = new Map<number, string>()
  for (let i = 0; i < entries.length; i++) {
    const url = signed?.[i]?.signedUrl
    if (url) urls.set(entries[i][0], url)
  }
  return urls
}

/**
 * URL assinada da página em alta (pages/ do pipeline) — para tela cheia nítida.
 * Retorna null se ainda não existir JPEG fabril nessa pasta.
 */
export async function loadProjectPageFullImageUrl(
  companyId: string,
  projectId: string,
  pageNumber: number,
): Promise<string | null> {
  if (!companyId || !projectId || pageNumber < 1) return null
  const pad = String(pageNumber).padStart(3, '0')
  const fileName = `page-${pad}.jpg`
  const folder = `${companyId}/quote-projects/${projectId}/pages`
  // Lista só o nome esperado — createSignedUrl sozinho não garante que o arquivo existe.
  const { data: listed } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).list(folder, {
    limit: 20,
    search: fileName,
  })
  const hit = listed?.some((f) => f.name === fileName)
  if (!hit) return null
  const { data, error } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .createSignedUrl(`${folder}/${fileName}`, 60 * 60)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/** Grava (ou atualiza) uma miniatura em thumbs/. Não toca em pages/. */
export async function uploadQuoteProjectThumb(params: {
  companyId: string
  projectId: string
  pageNumber: number
  dataUrl: string
}): Promise<{ path?: string; error?: string }> {
  const path = buildQuoteProjectThumbPath(
    params.companyId,
    params.projectId,
    params.pageNumber,
  )
  try {
    const blob = dataUrlToJpegBlob(params.dataUrl)
    const { error } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '86400',
    })
    if (error) return { error: error.message }
    return { path }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Falha ao salvar miniatura.' }
  }
}

/**
 * Gera e grava miniaturas faltantes da pasta (após upload do PDF).
 * Idempotente: pula páginas que já têm pages/ ou thumbs/.
 */
export async function cacheMissingProjectPageThumbs(params: {
  companyId: string
  projectId: string
  pageCount: number
  localFile?: File | null
  pdfUrl?: string | null
  /** Largura da miniatura. Default 240. */
  thumbWidth?: number
  concurrency?: number
  onProgress?: (done: number, total: number) => void
  signal?: { cancelled: boolean }
}): Promise<{ saved: number; skipped: number; error?: string }> {
  const {
    companyId,
    projectId,
    pageCount,
    localFile = null,
    pdfUrl = null,
    thumbWidth = PROJECT_THUMB_WIDTH,
    concurrency = 2,
    onProgress,
    signal,
  } = params

  if (!companyId || !projectId || pageCount < 1) {
    return { saved: 0, skipped: 0, error: 'Pasta ou pageCount inválidos.' }
  }

  const pagesPrefix = `${companyId}/quote-projects/${projectId}/pages`
  const thumbsPrefix = `${companyId}/quote-projects/${projectId}/thumbs`
  const [fromPages, fromThumbs] = await Promise.all([
    listPageNumbersInPrefix(pagesPrefix, pageCount),
    listPageNumbersInPrefix(thumbsPrefix, pageCount),
  ])
  const have = new Set<number>([...fromPages.keys(), ...fromThumbs.keys()])
  const missing = Array.from({ length: pageCount }, (_, i) => i + 1).filter((n) => !have.has(n))
  if (!missing.length) {
    onProgress?.(pageCount, pageCount)
    return { saved: 0, skipped: pageCount }
  }

  let pdf
  try {
    if (localFile) {
      pdf = await loadPdfFromFile(localFile)
    } else if (pdfUrl) {
      const signed = await getSignedPdfUrl(pdfUrl)
      if (!signed.url) return { saved: 0, skipped: have.size, error: signed.error || 'PDF indisponível.' }
      pdf = await loadPdfDocument(signed.url)
    } else {
      return { saved: 0, skipped: have.size, error: 'Sem PDF para gerar miniaturas.' }
    }
  } catch (err) {
    return {
      saved: 0,
      skipped: have.size,
      error: err instanceof Error ? err.message : 'Falha ao abrir o PDF.',
    }
  }

  let saved = 0
  let processed = 0
  let cursor = 0
  const totalWork = missing.length
  const worker = async () => {
    while (cursor < missing.length) {
      if (signal?.cancelled) return
      const pageNumber = missing[cursor++]
      try {
        const img = await renderPdfPageFromDocument(pdf, pageNumber, thumbWidth)
        if (signal?.cancelled) return
        const up = await uploadQuoteProjectThumb({
          companyId,
          projectId,
          pageNumber,
          dataUrl: img.src,
        })
        if (!up.error) saved += 1
      } catch {
        /* página individual — segue */
      }
      processed += 1
      onProgress?.(processed, totalWork)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, missing.length) }, () => worker()),
  )

  return { saved, skipped: have.size }
}
