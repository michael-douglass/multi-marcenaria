import pg from 'pg'

const { Client } = pg

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()

  const { rows: leadRows } = await client.query(
    `
      select id::text as id, nome
      from emp_garbo.leads
      where lower(nome) = lower('teste12')
      order by criado_em desc
      limit 1
    `,
  )

  if (leadRows.length === 0) {
    console.log('Lead teste12 não encontrado.')
    process.exit(0)
  }

  const leadId = leadRows[0].id

  await client.query(
    `
      delete from movelaria_contas_receber
      where origem_tipo = 'orcamento_fechado'
        and origem_lead_id = $1
    `,
    [leadId],
  )

  await client.query(
    `
      delete from movelaria_orcamentos_fechados
      where lead_id = $1
    `,
    [leadId],
  )

  console.log(`Reaberto com sucesso: teste12 (${leadId})`)
} catch (err) {
  console.error('Erro ao reabrir teste12:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
