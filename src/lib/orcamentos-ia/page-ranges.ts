/**
 * Parse e formatação de intervalos de páginas ("1-5, 8, 12-20").
 * Usado pelo seletor de cotação incremental antes do pipeline.
 */

export interface ParsePageRangeResult {
  ok: true
  pages: number[]
  label: string
}

export interface ParsePageRangeError {
  ok: false
  error: string
}

export type ParsePageRangeOutcome = ParsePageRangeResult | ParsePageRangeError

/** Lista 1..N inclusive. */
export function allPages(totalPages: number): number[] {
  const n = Math.floor(totalPages)
  if (!Number.isFinite(n) || n < 1) return []
  return Array.from({ length: n }, (_, i) => i + 1)
}

/**
 * Interpreta texto de intervalos contra o total de páginas do PDF.
 * Aceita: "1-5, 8, 12-20". Normaliza overlaps e ordena.
 */
export function parsePageRangeInput(
  text: string,
  totalPages: number,
): ParsePageRangeOutcome {
  const total = Math.floor(totalPages)
  if (!Number.isFinite(total) || total < 1) {
    return { ok: false, error: 'Número total de páginas inválido.' }
  }

  const raw = String(text || '').trim()
  if (!raw) {
    return { ok: false, error: 'Digite pelo menos uma página ou intervalo (ex.: 1-5, 8).' }
  }

  const selected = new Set<number>()
  const parts = raw.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean)

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/)
    if (rangeMatch) {
      let from = Number(rangeMatch[1])
      let to = Number(rangeMatch[2])
      if (!Number.isInteger(from) || !Number.isInteger(to)) {
        return { ok: false, error: `Intervalo inválido: “${part}”.` }
      }
      if (from > to) [from, to] = [to, from]
      if (from < 1 || to > total) {
        return {
          ok: false,
          error: `Intervalo “${part}” fora do PDF (páginas 1 a ${total}).`,
        }
      }
      for (let p = from; p <= to; p++) selected.add(p)
      continue
    }

    if (!/^\d+$/.test(part)) {
      return {
        ok: false,
        error: `Não entendi “${part}”. Use números e intervalos como 1-5, 8, 12-20.`,
      }
    }
    const page = Number(part)
    if (page < 1 || page > total) {
      return {
        ok: false,
        error: `Página ${page} não existe neste PDF (1 a ${total}).`,
      }
    }
    selected.add(page)
  }

  if (selected.size === 0) {
    return { ok: false, error: 'Nenhuma página válida selecionada.' }
  }

  const pages = [...selected].sort((a, b) => a - b)
  return { ok: true, pages, label: formatPageRanges(pages) }
}

/** União ordenada de páginas já orçadas com um novo lote. */
export function mergeBudgetedPages(
  current: number[] | null | undefined,
  pageRanges: number[] | null | undefined,
): number[] {
  const set = new Set<number>()
  for (const n of current || []) {
    if (Number.isInteger(n) && n > 0) set.add(n)
  }
  for (const n of pageRanges || []) {
    if (Number.isInteger(n) && n > 0) set.add(n)
  }
  return [...set].sort((a, b) => a - b)
}

/** Compacta [1,2,3,5,8,9] → "1-3, 5, 8-9". */
export function formatPageRanges(pages: number[]): string {
  if (!pages.length) return ''
  const sorted = [...new Set(pages.filter((p) => Number.isInteger(p) && p > 0))].sort(
    (a, b) => a - b,
  )
  const chunks: string[] = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i]
    if (cur === prev + 1) {
      prev = cur
      continue
    }
    chunks.push(start === prev ? String(start) : `${start}-${prev}`)
    if (cur != null) {
      start = cur
      prev = cur
    }
  }
  return chunks.join(', ')
}
