/**
 * Repara caixa Michael Douglas jun/2026 após reversão indevida:
 * - Restaura reserva R$ 10.000 (conta ainda paga)
 * - Ajusta pagamento consolidado de 10.480 → 10.000
 */
import pkg from 'pg'

const c = new pkg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

const dest = await c.query(
  `SELECT id FROM movelaria_caixa_destinatarios WHERE LOWER(TRIM(nome)) = 'michael douglas' AND ativo = true LIMIT 1`,
)
const destinatarioId = dest.rows[0]?.id
if (!destinatarioId) {
  console.error('Destinatário Michael Douglas não encontrado.')
  process.exit(1)
}

const contaPagoId = 'b65cd348-e31c-48bc-a2d0-24a15c4e9fc0'
const pagamentoId = '8a9e5c92-302b-4890-a768-0b1032f45224'

const existeReserva = await c.query(
  `SELECT id FROM movelaria_caixa_movimentacoes
   WHERE conta_pagar_id = $1 AND tipo_movimentacao = 'reserva' LIMIT 1`,
  [contaPagoId],
)

if (!existeReserva.rows.length) {
  await c.query(
    `INSERT INTO movelaria_caixa_movimentacoes (
      destinatario_id, tipo_movimentacao, valor, data_movimentacao,
      mes_referencia, ano_referencia, descricao, conta_pagar_id
    ) VALUES ($1, 'reserva', 10000, '2026-06-02', 6, 2026, $2, $3)`,
    [
      destinatarioId,
      'Reserva automática via pagamento: Michael Douglas',
      contaPagoId,
    ],
  )
  console.log('✅ Reserva R$ 10.000 restaurada.')
} else {
  console.log('ℹ️ Reserva de R$ 10.000 já existe.')
}

const upd = await c.query(
  `UPDATE movelaria_caixa_movimentacoes SET valor = 10000 WHERE id = $1 AND valor = 10480`,
  [pagamentoId],
)
console.log(upd.rowCount ? '✅ Pagamento ajustado para R$ 10.000.' : 'ℹ️ Pagamento não alterado (já corrigido?).')

const saldo = await c.query(
  `SELECT total_reservado, total_pago, saldo FROM movelaria_caixa_saldo_acumulado
   WHERE destinatario_id = $1 AND mes_referencia = 6 AND ano_referencia = 2026`,
  [destinatarioId],
)
console.log('Saldo jun/2026:', saldo.rows[0])

await c.end()
