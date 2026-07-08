/** Leitura de CSV/TSV e planilhas Excel (.xls, .xlsx, .xlsm). */

import * as XLSX from 'xlsx'
import { buildIsoDate } from '@/lib/date-br'

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
    return padMatrix(parseDelimitedText(text))
  }

  if (kind === 'excel') {
    const buffer = await file.arrayBuffer()
    return padMatrix(parseExcelBuffer(buffer))
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

function isOleSpreadsheet(head: Uint8Array): boolean {
  return (
    head.length >= 8
    && head[0] === 0xd0
    && head[1] === 0xcf
    && head[2] === 0x11
    && head[3] === 0xe0
  )
}

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

/** Garante que todas as linhas tenham o mesmo número de colunas. */
export function padMatrix(matrix: string[][]): string[][] {
  const maxCols = Math.max(0, ...matrix.map(row => row.length))
  return matrix.map(row => {
    const padded = Array.from({ length: maxCols }, (_, index) => String(row[index] ?? '').trim())
    return padded
  })
}

function parseExcelBuffer(buffer: ArrayBuffer): string[][] {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      cellNF: true,
      cellText: true,
      raw: false,
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
  const ref = sheet['!ref']
  if (!ref) {
    throw new Error('A planilha não possui dados.')
  }

  const range = XLSX.utils.decode_range(ref)
  const matrix: string[][] = []

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
    const row: string[] = []
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex++) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
      row.push(formatExcelCell(sheet[address]))
    }
    if (row.some(cell => cell.length > 0)) {
      matrix.push(row)
    }
  }

  if (matrix.length === 0) {
    throw new Error('A planilha não possui linhas com dados.')
  }

  return matrix
}

function formatExcelCell(cell?: XLSX.CellObject): string {
  if (!cell) return ''

  const formatted = typeof cell.w === 'string' ? cell.w.trim() : ''
  if (formatted) return formatted

  if (cell.v instanceof Date) {
    return formatDateBr(cell.v)
  }

  if (typeof cell.v === 'number') {
    if (typeof cell.v === 'number' && looksLikeExcelDateSerial(cell.v)) {
      const iso = excelSerialToIso(cell.v)
      if (iso) {
        const [year, month, day] = iso.split('-')
        return `${day}/${month}/${year}`
      }
    }

    if (Number.isInteger(cell.v) && Math.abs(cell.v) >= 1000) {
      return String(cell.v)
    }

    return formatBrNumber(cell.v)
  }

  return String(cell.v ?? '').trim()
}

function looksLikeExcelDateSerial(value: number): boolean {
  return value > 20_000 && value < 80_000
}

function excelSerialToIso(serial: number): string | null {
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400000)
  return buildIsoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function formatDateBr(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

function formatBrNumber(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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
