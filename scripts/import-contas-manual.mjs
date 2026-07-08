/**
 * Importa contas a pagar manualmente a partir de blocos de texto.
 * Uso: node --env-file=.env scripts/import-contas-manual.mjs [arquivo-dados.txt]
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg
const __dirname = dirname(fileURLToPath(import.meta.url))

const FORNECEDOR_IDS = {
  'j r ferragens': '7dfbd21b-9c7d-4286-91fd-0c16a2d76b23',
  jreferragens: '7dfbd21b-9c7d-4286-91fd-0c16a2d76b23',
}

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function isValidCalendarDate(day, month, year) {
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2100) return false
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function buildIsoDate(year, monthIndex, day) {
  const month = monthIndex + 1
  if (!isValidCalendarDate(day, month, year)) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseFlexibleDateInput(value) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const slash = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(trimmed)
  if (slash) {
    const partA = slash[1]
    const partB = slash[2]
    const a = Number(partA)
    const b = Number(partB)
    const year = Number(slash[3])

    let day
    let month

    if (a > 12 && b <= 12) {
      day = a
      month = b
    } else if (b > 12 && a <= 12) {
      month = a
      day = b
    } else if (partA.length === 1 || partB.length === 1) {
      month = a
      day = b
    } else {
      day = a
      month = b
    }

    return buildIsoDate(year, month - 1, day)
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 8) {
    const day = Number(digits.slice(0, 2))
    const month = Number(digits.slice(2, 4))
    const year = Number(digits.slice(4, 8))
    return buildIsoDate(year, month - 1, day)
  }

  return null
}

function parseMoneyBr(value) {
  const raw = value.trim().replace(/\s/g, '')
  if (!raw) return 0
  if (raw.includes(',') && raw.includes('.')) {
    return Number.parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  }
  if (raw.includes(',')) {
    return Number.parseFloat(raw.replace(',', '.'))
  }
  return Number.parseFloat(raw)
}

function parseRecords(text) {
  const blocks = text.trim().split(/\n\s*\n/)
  const records = []

  for (const block of blocks) {
    const lines = block.trim().split('\n').map(line => line.trim()).filter(Boolean)
    if (lines.length < 5) continue

    const fornecedor = lines[0].replace(/^FORNECEDOR\s+/i, '').trim()
    const descricao = lines[1].replace(/^Descrição\s*\/\s*Referência\s+/i, '').trim()
    const observacao = lines[2].replace(/^Observação\s+/i, '').trim()
    const vencimentoRaw = lines[3].replace(/^1º vencimento\s*[—-]\s*dia\s*\/\s*mês\s*\/\s*ano\s*:\s*/i, '').trim()
    const valorRaw = lines[4].replace(/^Valor Total\s*\(R\$\)\s+/i, '').trim()

    records.push({ fornecedor, descricao, observacao, vencimentoRaw, valorRaw })
  }

  return records
}

function resolveFornecedorId(nome) {
  const override = process.env.IMPORT_FORNECEDOR_OVERRIDE?.trim()
  const alvo = normalizeText(override || nome)
  return FORNECEDOR_IDS[alvo] ?? null
}

function resolveFornecedorNome(nome) {
  return process.env.IMPORT_FORNECEDOR_OVERRIDE?.trim() || nome
}

async function main() {
  const dataPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(__dirname, 'data/import-contas-manual.txt')

  const raw = readFileSync(dataPath, 'utf8')
  const parsed = parseRecords(raw)

  if (parsed.length === 0) {
    console.error('Nenhum registro encontrado em', dataPath)
    process.exit(1)
  }

  const items = []
  const erros = []

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i]
    const vencimento = parseFlexibleDateInput(row.vencimentoRaw)
    const valor = parseMoneyBr(row.valorRaw)

    if (!row.fornecedor || !row.descricao || !vencimento || !valor || valor <= 0) {
      erros.push({
        linha: i + 1,
        ...row,
        motivo: !vencimento
          ? `Vencimento inválido: ${row.vencimentoRaw}`
          : !valor || valor <= 0
            ? `Valor inválido: ${row.valorRaw}`
            : 'Dados incompletos',
      })
      continue
    }

    items.push({
      fornecedor_nome: resolveFornecedorNome(row.fornecedor),
      fornecedor_id: resolveFornecedorId(row.fornecedor),
      descricao: row.descricao,
      observacao: row.observacao || null,
      vencimento,
      valor,
    })
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  let inseridas = 0
  let ignoradas = 0

  for (const item of items) {
    const chave = [
      normalizeText(item.fornecedor_nome),
      normalizeText(item.descricao),
      item.vencimento,
      item.valor.toFixed(2),
    ].join('|')

    const existente = await client.query(
      `
        SELECT 1
        FROM movelaria_contas_pagar cp
        WHERE movelaria_normalizar_import_texto(COALESCE(cp.fornecedor_nome, '')) = $1
          AND movelaria_normalizar_import_texto(COALESCE(cp.descricao, '')) = $2
          AND cp.data_vencimento = $3::date
          AND cp.valor_parcela = $4::numeric
        LIMIT 1
      `,
      [
        normalizeText(item.fornecedor_nome),
        normalizeText(item.descricao),
        item.vencimento,
        item.valor,
      ],
    )

    if (existente.rowCount > 0) {
      await client.query(
        `
          UPDATE movelaria_contas_pagar
          SET
            fornecedor_id = $1::uuid,
            fornecedor_nome = $2,
            atualizado_em = NOW()
          WHERE movelaria_normalizar_import_texto(COALESCE(fornecedor_nome, '')) = $3
            AND movelaria_normalizar_import_texto(COALESCE(descricao, '')) = $4
            AND data_vencimento = $5::date
            AND valor_parcela = $6::numeric
        `,
        [
          item.fornecedor_id,
          item.fornecedor_nome,
          normalizeText(item.fornecedor_nome),
          normalizeText(item.descricao),
          item.vencimento,
          item.valor,
        ],
      )
      ignoradas++
      continue
    }

    await client.query(
      `
        INSERT INTO movelaria_contas_pagar (
          fornecedor_id,
          fornecedor_nome,
          descricao,
          observacao,
          valor_total,
          numero_parcela,
          total_parcelas,
          valor_parcela,
          data_vencimento,
          status,
          valor_pago,
          grupo_lancamento_id
        ) VALUES (
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          1,
          1,
          $5,
          $6::date,
          'pendente',
          0,
          gen_random_uuid()
        )
      `,
      [
        item.fornecedor_id,
        item.fornecedor_nome,
        item.descricao,
        item.observacao,
        item.valor,
        item.vencimento,
      ],
    )

    inseridas++
  }

  await client.end()

  console.log(`Arquivo: ${dataPath}`)
  console.log(`Registros lidos: ${parsed.length}`)
  console.log(`Prontos para importar: ${items.length}`)
  console.log(`Inseridas: ${inseridas}`)
  console.log(`Ignoradas (já existiam): ${ignoradas}`)
  console.log(`Erros de validação: ${erros.length}`)

  if (erros.length > 0) {
    console.log('\nErros:')
    for (const erro of erros) {
      console.log(`- Linha ${erro.linha}: ${erro.motivo} (${erro.descricao})`)
    }
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Falha na importação:', err.message)
  process.exit(1)
})
