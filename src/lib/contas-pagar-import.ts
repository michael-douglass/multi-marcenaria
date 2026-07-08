import { brDateToIso, buildIsoDate, normalizeObraDate } from '@/lib/date-br'
import { parseMoneyBr } from '@/lib/utils'
import type { ContaPagar, Fornecedor } from '@/types'

export interface ContaPagarImportRow {
  linha: number
  fornecedor: string
  descricao: string
  observacao: string
  vencimento: string
  valor: number
  fornecedorId?: string
}

export type ContaPagarImportStatus = 'ok' | 'duplicada' | 'erro'

export interface ContaPagarImportPreviewRow extends ContaPagarImportRow {
  status: ContaPagarImportStatus
  mensagem?: string
}

export interface ContaPagarImportPreview {
  headers: string[]
  rows: ContaPagarImportPreviewRow[]
  prontas: ContaPagarImportPreviewRow[]
  duplicadas: ContaPagarImportPreviewRow[]
  erros: ContaPagarImportPreviewRow[]
}

const REQUIRED_FIELDS = ['fornecedor', 'descricao', 'vencimento', 'valor'] as const

type ImportField = typeof REQUIRED_FIELDS[number] | 'observacao'

/** Ignora espaços, acentos e símbolos para comparar textos. */
export function normalizeImportText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function normalizeHeader(value: string): string {
  return normalizeImportText(value)
}

function mapHeaders(headers: string[]): Partial<Record<ImportField, number>> {
  const normalized = headers.map(normalizeHeader)
  const mapping: Partial<Record<ImportField, number>> = {}

  const rules: { field: ImportField; test: (header: string) => boolean }[] = [
    { field: 'fornecedor', test: h => h === 'fornecedor' || h.startsWith('fornecedor') },
    { field: 'descricao', test: h => h.includes('descricao') || h.includes('referencia') },
    { field: 'observacao', test: h => h.includes('observacao') },
    { field: 'vencimento', test: h => h.includes('vencimento') },
    { field: 'valor', test: h => h.includes('valortotal') || h === 'valor' },
  ]

  for (const rule of rules) {
    const index = normalized.findIndex(rule.test)
    if (index >= 0) mapping[rule.field] = index
  }

  return mapping
}

function parseVencimento(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const br = brDateToIso(trimmed)
  if (br) return br

  const iso = normalizeObraDate(trimmed)
  if (iso) return iso

  const serial = Number(trimmed.replace(',', '.'))
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const date = excelSerialToDate(serial)
    if (date) return date
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 8) {
    return brDateToIso(`${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`)
  }

  return null
}

function excelSerialToDate(serial: number): string | null {
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400000)
  return buildIsoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function buildCobrancaImportKey(
  fornecedor: string,
  descricao: string,
  vencimento: string,
  valor: number,
): string {
  return [
    normalizeImportText(fornecedor),
    normalizeImportText(descricao),
    vencimento,
    valor.toFixed(2),
  ].join('|')
}

function resolveFornecedor(
  nome: string,
  fornecedores: Fornecedor[],
): { id?: string; nome: string } {
  const alvo = normalizeImportText(nome)
  if (!alvo) return { nome: nome.trim() }

  const encontrado = fornecedores.find(f => normalizeImportText(f.nome) === alvo)
    ?? fornecedores.find(f => normalizeImportText(f.nome).includes(alvo))
    ?? fornecedores.find(f => alvo.includes(normalizeImportText(f.nome)))

  if (encontrado) {
    return { id: encontrado.id, nome: encontrado.nome }
  }

  return { nome: nome.trim() }
}

function buildExistingKeys(
  contas: ContaPagar[],
  fornecedores: Fornecedor[],
): Set<string> {
  const keys = new Set<string>()
  for (const conta of contas) {
    const nome =
      conta.fornecedor_nome
      ?? fornecedores.find(f => f.id === conta.fornecedor_id)?.nome
      ?? ''
    keys.add(buildCobrancaImportKey(
      nome,
      conta.descricao ?? '',
      conta.data_vencimento,
      conta.valor_parcela,
    ))
  }
  return keys
}

function missingColumns(mapping: Partial<Record<ImportField, number>>): string[] {
  const labels: Record<ImportField, string> = {
    fornecedor: 'FORNECEDOR',
    descricao: 'Descrição / Referência',
    observacao: 'Observação',
    vencimento: '1º vencimento',
    valor: 'Valor Total (R$)',
  }

  return REQUIRED_FIELDS.filter(field => mapping[field] == null).map(field => labels[field])
}

export function buildContasPagarImportPreview(
  matrix: string[][],
  fornecedores: Fornecedor[],
  contasExistentes: ContaPagar[],
): ContaPagarImportPreview {
  if (matrix.length === 0) {
    throw new Error('A planilha está vazia.')
  }

  const headers = matrix[0].map(cell => cell.trim())
  const mapping = mapHeaders(headers)
  const faltando = missingColumns(mapping)

  if (faltando.length > 0) {
    const encontradas = headers.filter(Boolean).join(' · ') || '(nenhuma)'
    throw new Error(
      `Colunas obrigatórias não encontradas: ${faltando.join(', ')}. ` +
      `Cabeçalhos lidos na planilha: ${encontradas}. ` +
      'Use FORNECEDOR, Descrição / Referência, Observação, 1º vencimento e Valor Total (R$).',
    )
  }

  const existentes = buildExistingKeys(contasExistentes, fornecedores)
  const vistosNoArquivo = new Set<string>()
  const rows: ContaPagarImportPreviewRow[] = []

  for (let index = 1; index < matrix.length; index++) {
    const cells = matrix[index]
    const linha = index + 1
    const fornecedor = (cells[mapping.fornecedor!] ?? '').trim()
    const descricao = (cells[mapping.descricao!] ?? '').trim()
    const observacao = mapping.observacao != null
      ? (cells[mapping.observacao] ?? '').trim()
      : ''
    const vencimentoRaw = (cells[mapping.vencimento!] ?? '').trim()
    const valorRaw = (cells[mapping.valor!] ?? '').trim()

    if (!fornecedor && !descricao && !vencimentoRaw && !valorRaw) continue

    const valor = parseMoneyBr(valorRaw)
    const vencimento = parseVencimento(vencimentoRaw)
    const fornecedorResolvido = resolveFornecedor(fornecedor, fornecedores)

    const base: ContaPagarImportRow = {
      linha,
      fornecedor: fornecedorResolvido.nome || fornecedor,
      descricao,
      observacao,
      vencimento: vencimento ?? '',
      valor,
      fornecedorId: fornecedorResolvido.id,
    }

    if (!fornecedor.trim()) {
      rows.push({ ...base, status: 'erro', mensagem: 'Fornecedor em branco.' })
      continue
    }

    if (!descricao.trim()) {
      rows.push({ ...base, status: 'erro', mensagem: 'Descrição / referência em branco.' })
      continue
    }

    if (!vencimento) {
      rows.push({
        ...base,
        status: 'erro',
        mensagem: `Vencimento inválido (${vencimentoRaw || 'vazio'}). Use DD/MM/AAAA.`,
      })
      continue
    }

    if (!valor || valor <= 0) {
      rows.push({
        ...base,
        status: 'erro',
        mensagem: `Valor inválido (${valorRaw || 'vazio'}).`,
      })
      continue
    }

    const chave = buildCobrancaImportKey(base.fornecedor, descricao, vencimento, valor)
    if (vistosNoArquivo.has(chave) || existentes.has(chave)) {
      rows.push({
        ...base,
        status: 'duplicada',
        mensagem: vistosNoArquivo.has(chave)
          ? 'Linha repetida na planilha.'
          : 'Cobrança já existe no sistema.',
      })
      vistosNoArquivo.add(chave)
      continue
    }

    vistosNoArquivo.add(chave)
    rows.push({ ...base, status: 'ok' })
  }

  const prontas = rows.filter(row => row.status === 'ok')
  const duplicadas = rows.filter(row => row.status === 'duplicada')
  const erros = rows.filter(row => row.status === 'erro')

  if (rows.length === 0) {
    throw new Error('Nenhuma linha de dados encontrada na planilha.')
  }

  return { headers, rows, prontas, duplicadas, erros }
}
