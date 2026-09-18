/**
 * Adiciona a categoria "pedras_bancadas" ao checklist de verificação já
 * persistido em emp_garbo.markup_config.markup_ia_verificacao — o código
 * (MARKUP_IA_VERIFICACAO_PADRAO em src/lib e _shared/markup-ia-verificacao.ts)
 * só serve de default para configs NULAS; este tenant já tem checklist salvo
 * no banco (confirmado em 17/09/2026: 6 categorias, sem nenhuma de pedra/mármore/
 * granito — causa raiz confirmada da subcontagem de material de pedra no lead
 * Cortecloud testado nesta sessão). Update é aditivo/idempotente: só insere se
 * "pedras_bancadas" ainda não existir no array.
 *
 * Uso: node --env-file=.env scripts/apply-markup-checklist-pedras-bancadas.mjs
 */
import pkg from 'pg'
const { Client } = pkg

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env')
  process.exit(1)
}

const NOVA_CATEGORIA = {
  id: 'pedras_bancadas',
  nome: 'Pedras e Bancadas',
  ordem: 6,
  ativo: true,
  itens: [
    { id: 'granito', nome: 'GRANITO', variacoes: ['20mm', '30mm'], ativo: true, prioridade: 'normal' },
    { id: 'marmore', nome: 'MÁRMORE', variacoes: ['20mm', '30mm'], ativo: true, prioridade: 'normal' },
    { id: 'quartzo', nome: 'QUARTZO', variacoes: ['20mm', '30mm'], ativo: true, prioridade: 'normal' },
    { id: 'silestone', nome: 'SILESTONE', variacoes: ['20mm', '30mm'], ativo: true, prioridade: 'normal' },
    { id: 'porcelanato_bancada', nome: 'PORCELANATO BANCADA', variacoes: [], ativo: true, prioridade: 'normal' },
  ],
}

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()

  const { rows: antes } = await client.query(`
    SELECT id, jsonb_agg(cat->>'id') AS ids_categorias
    FROM emp_garbo.markup_config, jsonb_array_elements(coalesce(markup_ia_verificacao, '[]'::jsonb)) AS cat
    GROUP BY id
  `)
  console.log('Antes:', JSON.stringify(antes, null, 2))

  const { rowCount } = await client.query(
    `
    UPDATE emp_garbo.markup_config
    SET markup_ia_verificacao = coalesce(markup_ia_verificacao, '[]'::jsonb) || $1::jsonb,
        atualizado_em = now()
    WHERE NOT (coalesce(markup_ia_verificacao, '[]'::jsonb) @> $2::jsonb)
    `,
    [JSON.stringify([NOVA_CATEGORIA]), JSON.stringify([{ id: 'pedras_bancadas' }])],
  )
  console.log(`\n✅ ${rowCount} linha(s) atualizada(s).`)

  const { rows: depois } = await client.query(`
    SELECT id, jsonb_agg(cat->>'id') AS ids_categorias
    FROM emp_garbo.markup_config, jsonb_array_elements(coalesce(markup_ia_verificacao, '[]'::jsonb)) AS cat
    GROUP BY id
  `)
  console.log('\nDepois:', JSON.stringify(depois, null, 2))
} catch (err) {
  console.error('❌ Erro:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
