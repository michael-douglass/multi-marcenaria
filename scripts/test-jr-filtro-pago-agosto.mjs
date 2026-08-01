import pg from 'pg'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]
    }),
)

const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const contas = await client.query(`
  SELECT
    cp.descricao,
    cp.valor_parcela::float8 AS valor_parcela,
    cp.valor_pago::float8 AS valor_pago,
    cp.data_vencimento::text AS venc,
    (
      SELECT COALESCE(SUM(m.valor), 0)::float8
      FROM movelaria_caixa_movimentacoes m
      WHERE m.conta_pagar_id = cp.id
        AND m.tipo_movimentacao = 'reserva'
    ) AS reservado
  FROM movelaria_contas_pagar cp
  WHERE cp.fornecedor_nome ILIKE '%FERRAGENS%'
    AND cp.status = 'pago'
    AND cp.data_vencimento >= '2026-08-01'
    AND cp.data_vencimento <= '2026-08-31'
  ORDER BY cp.data_vencimento
`)

const caixa = await client.query(`
  SELECT s.total_reservado::float8 AS reservado, s.total_pago::float8 AS pago
  FROM movelaria_caixa_saldo_acumulado s
  JOIN movelaria_caixa_destinatarios d ON d.id = s.destinatario_id
  WHERE d.nome ILIKE '%FERRAGENS%'
    AND s.mes_referencia = 8
    AND s.ano_referencia = 2026
`)

await client.end()

const somaPago = contas.rows.reduce((a, r) => a + r.valor_pago, 0)
const reservadoCaixa = caixa.rows[0]?.reservado ?? 0

console.log('=== Filtro Pago + Este Mês + J. R. FERRAGENS ===')
console.log(`Contas: ${contas.rows.length}`)
for (const r of contas.rows) {
  console.log(
    `  ${r.descricao} | pago ${r.valor_pago} | reservado ${r.reservado} | ${r.venc}`,
  )
}
console.log(`Soma pago nas contas: R$ ${somaPago.toFixed(2)}`)
console.log(`Reservado no Caixa:   R$ ${reservadoCaixa.toFixed(2)}`)

const ok =
  contas.rows.length === 5 &&
  Math.abs(somaPago - reservadoCaixa) < 0.02 &&
  contas.rows.every(r => Math.abs(r.valor_pago - r.reservado) < 0.02)

console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
