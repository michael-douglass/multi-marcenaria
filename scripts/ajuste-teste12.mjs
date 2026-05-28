import pg from 'pg'

const { Client } = pg

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()

  const { rows: leads } = await client.query(
    `
      select id::text as id, nome, telefone
      from emp_garbo.leads
      where status = 'Orçamentos ganhos'
        and lower(nome) = lower('teste12')
      order by criado_em desc
      limit 1
    `,
  )

  if (leads.length === 0) {
    console.log('Lead teste12 não encontrado em Orçamentos ganhos.')
    process.exit(0)
  }

  const lead = leads[0]

  const { rows: exists } = await client.query(
    'select id from movelaria_orcamentos_fechados where lead_id = $1 limit 1',
    [lead.id],
  )

  if (exists.length === 0) {
    await client.query(
      `
        insert into movelaria_orcamentos_fechados (
          lead_id,
          cliente_nome,
          cliente_telefone,
          valor_total,
          descricao,
          tipo_recebimento,
          forma_pagamento,
          total_parcelas,
          valor_liquido
        )
        values ($1, $2, $3, 1.00, $4, 'a_vista', 'pix', 1, 1.00)
      `,
      [lead.id, lead.nome, lead.telefone ?? null, 'Ajuste manual solicitado'],
    )
    console.log('Criado lançamento bruto de R$ 1,00 para teste12.')
  } else {
    await client.query(
      `
        update movelaria_orcamentos_fechados
        set
          valor_total = 1.00,
          valor_liquido = 1.00,
          atualizado_em = now()
        where lead_id = $1
      `,
      [lead.id],
    )
    console.log('Atualizado lançamento bruto para R$ 1,00 para teste12.')
  }

  console.log(`Lead processado: ${lead.nome} (${lead.id})`)
} catch (err) {
  console.error('Erro no ajuste:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
