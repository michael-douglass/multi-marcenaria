/** Leitura de CSV/TSV e planilhas Excel (.xls, .xlsx, .xlsm). */

import * as XLSX from 'xlsx'

const PARSE_TIMEOUT_MS = 45_000

type SpreadsheetKind = 'csv' | 'excel' | 'unknown'

export async function parseSpreadsheetFile(file: File): Promise<string[][]> {
  return withTimeout(
    parseSpreadsheetFileInternal(file),
    PARSE_TIMEOUT_MS,
    'A leitura da planilha demorou demais. Tente salvar como CSV no Excel.',
  )
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function parseSpreadsheetFileInternal(file: File): Promise<string[][]> {
  const kind = detectSpreadsheetKind(file.name, await readFileHead(file, 8))

  if (kind === 'csv') {
    const text = await file.text()
    return parseDelimitedText(text)
  }

  if (kind === 'excel') {
    const buffer = await file.arrayBuffer()
    return parseExcelBuffer(buffer)
  }

  throw new Error(
    'Formato de arquivo não reconhecido. Use .xls, .xlsx ou .csv exportado do Excel.',
  )
}

async function readFileHead(file: File, size: number): Promise<Uint8Array> {
  const slice = file.slice(0, size)
  return new Uint8Array(await slice.arrayBuffer())
}

function detectSpreadsheetKind(fileName: string, head: Uint8Array): SpreadsheetKind {
  const lower = fileName.toLowerCase()

  if (lower.endsWith('.csv') || lower.endsWith('.txt')) return 'csv'

  if (
    lower.endsWith('.xls')
    || lower.endsWith('.xlsx')
    || lower.endsWith('.xlsm')
    || isOleSpreadsheet(head)
    || isZipSpreadsheet(head)
  ) {
    return 'excel'
  }

  if (looksLikeDelimitedText(head)) return 'csv'

  return 'unknown'
}

/** Excel 97-2003 (.xls binário) */
function isOleSpreadsheet(head: Uint8Array): boolean {
  return (
    head.length >= 8
    && head[0] === 0xd0
    && head[1] === 0xcf
    && head[2] === 0x11
    && head[3] === 0xe0
  )
}

/** Excel 2007+ (.xlsx) */
function isZipSpreadsheet(head: Uint8Array): boolean {
  return head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b
}

function looksLikeDelimitedText(head: Uint8Array): boolean {
  const sample = new TextDecoder().decode(head).trimStart()
  return sample.startsWith('FORNECEDOR')
    || sample.includes(';')
    || sample.includes(',')
    || sample.includes('\t')
}

function parseExcelBuffer(buffer: ArrayBuffer): string[][] {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      dense: true,
    })
  } catch {
    throw new Error(
      'Não foi possível abrir esta planilha Excel. Salve novamente como .xlsx ou .csv.',
    )
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('A planilha está vazia.')
  }

  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
    dateNF: 'dd/mm/yyyy',
  })

  const matrix = rawRows
    .map(row => normalizeRow(row))
    .filter(row => row.some(cell => cell.length > 0))

  if (matrix.length === 0) {
    throw new Error('A planilha não possui linhas com dados.')
  }

  return matrix
}

function normalizeRow(row: unknown): string[] {
  if (!Array.isArray(row)) return []
  return row.map(cell => stringifyCell(cell))
}

function stringifyCell(cell: unknown): string {
  if (cell == null) return ''
  if (cell instanceof Date) {
    const day = String(cell.getDate()).padStart(2, '0')
    const month = String(cell.getMonth() + 1).padStart(2, '0')
    const year = cell.getFullYear()
    return `${day}/${month}/${year}`
  }
  return String(cell).trim()
}

export function parseDelimitedText(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(normalized)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    const next = normalized[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }

    if (ch === delimiter) {
      row.push(cell.trim())
      cell = ''
      continue
    }

    if (ch === '\n' || (ch === '\r' && next !== '\n')) {
      row.push(cell.trim())
      if (row.some(v => v.length > 0)) rows.push(row)
      row = []
      cell = ''
      if (ch === '\r' && next === '\n') i++
      continue
    }

    if (ch === '\r') continue
    cell += ch
  }

  row.push(cell.trim())
  if (row.some(v => v.length > 0)) rows.push(row)
  return rows
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const counts = {
    ';': (firstLine.match(/;/g) ?? []).length,
    ',': (firstLine.match(/,/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
  }
  if (counts['\t'] >= counts[';'] && counts['\t'] >= counts[',']) return '\t'
  if (counts[';'] >= counts[',']) return ';'
  return ','
}
