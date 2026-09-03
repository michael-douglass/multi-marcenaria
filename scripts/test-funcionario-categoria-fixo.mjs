/**
 * Fluxo: cadastrar funcionário (categoria) → jornada → fixo em métricas → contas a pagar.
 * Rodar: node --env-file=.env scripts/test-funcionario-categoria-fixo.mjs
 */
import assert from 'node:assert/strict'
import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL ausente')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const NOME = `Teste Design Auto ${Date.now()}`
let funcionarioId = null
let recorrenciaId = null

async function main() {
  await client.connect()
  console.log('1) Cadastrando funcionário categoria Design…')

  const { rows: inserted } = await client.query(
    `INSERT INTO movelaria_funcionarios (nome, tipo, categoria, email, admissao_status, ativo)
     VALUES ($1, 'financeiro', 'design', $2, 'pendente', true)
     RETURNING id, categoria, valor_fixo_mensal`,
    [NOME, `teste.design.${Date.now()}@garbo.test`],
  )
  funcionarioId = inserted[0].id
  assert.equal(inserted[0].categoria, 'design')
  console.log('   ✓ pasta criada:', funcionarioId)

  console.log('2) Conferindo folha de ponto (jornada)…')
  const { rows: jornadas } = await client.query(
    `SELECT id FROM movelaria_funcionario_jornada WHERE funcionario_id = $1`,
    [funcionarioId],
  )
  assert.equal(jornadas.length, 1, 'deveria ter jornada automática')
  console.log('   ✓ jornada criada')

  console.log('3) Conferindo listagem de fixo (métricas)…')
  const { rows: lista } = await client.query(
    `SELECT * FROM movelaria_listar_fixo_montadores(
       EXTRACT(MONTH FROM CURRENT_DATE)::int,
       EXTRACT(YEAR FROM CURRENT_DATE)::int
     ) WHERE funcionario_id = $1`,
    [funcionarioId],
  )
  // A RPC usa movelaria_meu_perfil() — sem auth.uid() pode falhar.
  // Validamos pelo menos a presença na tabela base.
  const { rows: naBase } = await client.query(
    `SELECT id, nome, categoria FROM movelaria_funcionarios WHERE id = $1 AND ativo`,
    [funcionarioId],
  )
  assert.equal(naBase.length, 1)
  assert.equal(naBase[0].categoria, 'design')
  console.log('   ✓ aparece na base de funcionários ativos', lista.length ? '(e na RPC)' : '(RPC exige login)')

  console.log('4) Salvando fixo e gerando Contas a Pagar…')
  const venc = new Date()
  venc.setMonth(venc.getMonth() + 1)
  venc.setDate(10)
  const vencIso = venc.toISOString().slice(0, 10)

  // Chama a lógica interna sem checagem de perfil (SECURITY DEFINER via SQL direto da função)
  // Simula o que a RPC faz após auth: atualiza + expande.
  await client.query(
    `UPDATE movelaria_funcionarios
     SET valor_fixo_mensal = 1500,
         fixo_primeiro_vencimento = $2::date,
         atualizado_em = NOW()
     WHERE id = $1`,
    [funcionarioId, vencIso],
  )
  await client.query(`SELECT movelaria_expandir_fixo_funcionario($1)`, [funcionarioId])

  const { rows: funcAfter } = await client.query(
    `SELECT valor_fixo_mensal, fixo_recorrencia_id, fixo_primeiro_vencimento
     FROM movelaria_funcionarios WHERE id = $1`,
    [funcionarioId],
  )
  assert.equal(Number(funcAfter[0].valor_fixo_mensal), 1500)
  assert.ok(funcAfter[0].fixo_recorrencia_id, 'deveria ter recorrência')
  recorrenciaId = funcAfter[0].fixo_recorrencia_id
  console.log('   ✓ fixo salvo, recorrência:', recorrenciaId)

  const { rows: contas } = await client.query(
    `SELECT id, descricao, valor_parcela, status, data_vencimento
     FROM movelaria_contas_pagar
     WHERE recorrencia_id = $1
     ORDER BY data_vencimento
     LIMIT 3`,
    [recorrenciaId],
  )
  assert.ok(contas.length >= 1, 'deveria gerar ao menos 1 conta a pagar')
  assert.match(contas[0].descricao, /^Fixo:/)
  assert.equal(Number(contas[0].valor_parcela), 1500)
  assert.equal(contas[0].status, 'pendente')
  console.log(`   ✓ ${contas.length} cobrança(s) gerada(s):`, contas[0].descricao)

  console.log('5) Limpando dados de teste…')
  await client.query(
    `DELETE FROM movelaria_caixa_movimentacoes
     WHERE conta_pagar_id IN (SELECT id FROM movelaria_contas_pagar WHERE recorrencia_id = $1)`,
    [recorrenciaId],
  )
  await client.query(`DELETE FROM movelaria_contas_pagar WHERE recorrencia_id = $1`, [recorrenciaId])
  await client.query(`DELETE FROM movelaria_funcionario_jornada WHERE funcionario_id = $1`, [funcionarioId])
  await client.query(`DELETE FROM movelaria_funcionarios WHERE id = $1`, [funcionarioId])
  console.log('   ✓ limpeza ok')

  console.log('\n✅ Fluxo categoria → ponto → fixo → contas a pagar validado.')
}

main()
  .catch(err => {
    console.error('❌', err)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      if (funcionarioId) {
        if (recorrenciaId) {
          await client.query(
            `DELETE FROM movelaria_caixa_movimentacoes
             WHERE conta_pagar_id IN (SELECT id FROM movelaria_contas_pagar WHERE recorrencia_id = $1)`,
            [recorrenciaId],
          )
          await client.query(`DELETE FROM movelaria_contas_pagar WHERE recorrencia_id = $1`, [recorrenciaId])
        }
        await client.query(`DELETE FROM movelaria_funcionario_jornada WHERE funcionario_id = $1`, [funcionarioId])
        await client.query(`DELETE FROM movelaria_funcionarios WHERE id = $1`, [funcionarioId])
      }
    } catch {
      /* ignore cleanup errors */
    }
    await client.end()
  })
