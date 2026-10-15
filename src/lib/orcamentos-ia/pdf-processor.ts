/**
 * Recorte estrito de PDF → JPEG para lotes de Orçamentos IA.
 * Garante consumo zero de tokens em páginas fora da seleção.
 */
import {
  convertPdfPagesToJpegFromUrl,
  convertPdfPagesToJpegSequential,
  type PdfPageJpegResult,
} from '@/lib/pdf-to-image'

export type ConvertSelectedPdfPagesParams = {
  /** Bytes locais (upload do usuário) OU url assinada (PDF grande da pasta). */
  data?: ArrayBuffer
  url?: string
  /** Páginas absolutas 1-based — obrigatório e não vazio. */
  pageNumbers: number[]
  maxPages?: number
  maxEdge?: number
  quality?: number
  pageTimeoutMs?: number
  openTimeoutMs?: number
  onPage: (page: PdfPageJpegResult) => void | Promise<void>
}

/** Normaliza e valida seleção de páginas (1-based). */
export function normalizeSelectedPages(pageNumbers: unknown): number[] {
  if (!Array.isArray(pageNumbers)) return []
  return [
    ...new Set(
      pageNumbers.filter(
        (p): p is number => typeof p === 'number' && Number.isInteger(p) && p > 0,
      ),
    ),
  ].sort((a, b) => a - b)
}

/** Extrai nº da página de `page-009.jpg` ou path completo. */
export function pageNumberFromPagePath(pathOrName: string): number | null {
  const base = pathOrName.split('/').pop() || pathOrName
  const m = base.match(/page-(\d+)\.(?:png|jpe?g|webp)$/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 1 ? n : null
}

/**
 * Converte APENAS as páginas selecionadas.
 * Proibido array vazio — evita fallback silencioso para o PDF inteiro.
 */
export async function convertSelectedPdfPagesToJpeg(
  params: ConvertSelectedPdfPagesParams,
): Promise<{ totalPages: number; converted: number; pageNumbers: number[] }> {
  const pageNumbers = normalizeSelectedPages(params.pageNumbers)
  if (!pageNumbers.length) {
    throw new Error(
      'Seleção de páginas vazia: informe ao menos uma página para converter (evita gastar tokens no PDF inteiro).',
    )
  }

  const common = {
    maxPages: params.maxPages,
    maxEdge: params.maxEdge,
    quality: params.quality,
    pageTimeoutMs: params.pageTimeoutMs,
    openTimeoutMs: params.openTimeoutMs,
    pageNumbers,
    onPage: params.onPage,
  }

  const url = typeof params.url === 'string' ? params.url.trim() : ''
  const result = url
    ? await convertPdfPagesToJpegFromUrl(url, common)
    : await convertPdfPagesToJpegSequential(
        params.data ?? new ArrayBuffer(0),
        common,
      )

  return { ...result, pageNumbers }
}

/**
 * Defesa em profundidade: pagePaths enviados à LLM devem bater com a seleção.
 * Remove extras e exige TODAS as páginas do lote (não segue com subconjunto).
 */
export function assertBatchPagePaths(
  pagePaths: string[],
  pageNumbers: number[] | null | undefined,
): string[] {
  const wanted = normalizeSelectedPages(pageNumbers)
  if (!wanted.length) {
    return [...pagePaths]
  }
  const set = new Set(wanted)
  const filtered = pagePaths.filter((p) => {
    const n = pageNumberFromPagePath(p)
    return n != null && set.has(n)
  })
  if (!filtered.length) {
    throw new Error(
      `Nenhum pagePath corresponde às páginas do lote (${wanted.join(', ')}). Abortado para não enviar páginas erradas à IA.`,
    )
  }
  const byPage = new Map<number, string>()
  for (const p of filtered) {
    const n = pageNumberFromPagePath(p)
    if (n != null) byPage.set(n, p)
  }
  const missing = wanted.filter((n) => !byPage.has(n))
  if (missing.length) {
    throw new Error(
      `Faltam ${missing.length} página(s) convertida(s) do lote (${missing.slice(0, 12).join(', ')}${
        missing.length > 12 ? '…' : ''
      }). Use Retomar — o sistema baixa o PDF da pasta e completa só o que falta.`,
    )
  }
  return wanted.map((n) => byPage.get(n)!)
}

/** Lê page_ranges / selected_pages de totals do lote. */
export function pageNumbersFromTotals(totals: Record<string, unknown> | null | undefined): number[] {
  if (!totals || typeof totals !== 'object') return []
  const raw = totals.page_ranges ?? totals.selected_pages
  return normalizeSelectedPages(raw)
}
