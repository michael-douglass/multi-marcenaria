import pg from 'pg'

const { Client } = pg

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()

  const { rows } = await client.query(
    `
      with alvo as (
        select id
        from movelaria_contas_receber
        where status = 'recebido'
          and data_recebimento = current_date
          and data_vencimento > current_date
        order by atualizado_em desc nulls last, criado_em desc
        limit 1
      )
      update movelaria_contas_receber c
      set
        data_vencimento = current_date,
        atualizado_em = now()
      from alvo
      where c.id = alvo.id
      returning c.id, c.cliente_nome, c.valor_parcela, c.data_recebimento, c.data_vencimento
    `,
  )

  if (rows.length === 0) {
    console.log('Nenhuma entrada recebida hoje em mês futuro encontrada para ajuste.')
  } else {
    console.log('Entrada ajustada para o mês atual:')
    console.log(rows[0])
  }
} catch (err) {
  console.error('Erro ao ajustar entrada:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
