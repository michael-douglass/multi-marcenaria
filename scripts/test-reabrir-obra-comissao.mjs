/**
 * Teste: reabrir obra concluída devolve a comissão à previsão.
 *
 * Rodar: node --env-file=.env --test scripts/test-reabrir-obra-comissao.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('reabrir obra — código da agenda', () => {
  it('permissionamento libera montador admin e bloqueia montador comum', () => {
    const src = readSrc('src/lib/obra-permissions.ts')
    assert.match(src, /export function podeExibirBotaoReabrirObra/)
    assert.match(src, /podeComandarEquipeObra\(opts\.roles\)/)
    assert.match(src, /status_kanban !== 'concluida'/)
  })

  it('card da agenda e detalhe chamam reabrir', () => {
    const agenda = readSrc('src/pages/AgendaObras.tsx')
    assert.match(agenda, /onReabrir=\{handleReabrir\}/)
    assert.match(agenda, /obrasHook\.reabrirObra/)

    const barra = readSrc('src/components/obras/ObraEquipeActionBar.tsx')
    assert.match(barra, /mostrarReabrir/)
    assert.match(barra, />Reabrir</)
    assert.match(barra, /devolve a comissão/)
  })

  it('hook chama a função do banco e zera comissão gerada', () => {
    const hook = readSrc('src/hooks/useObrasState.ts')
    assert.match(hook, /movelaria_reabrir_obra/)
    assert.match(hook, /p_status_destino/)

    const sql = readSrc('supabase/migrations/170_reabrir_obra_reverte_comissao.sql')
    assert.match(sql, /comissao_gerada\s+= false/)
    assert.match(sql, /fornecedor_nome ILIKE 'Comissão:%'/)
    assert.match(sql, /montador_admin/)
    assert.doesNotMatch(sql, /DELETE FROM movelaria_obra_comissao_itens/)
  })
})

const DATABASE_URL = process.env.DATABASE_URL
const runSql = Boolean(DATABASE_URL)

describe('reabrir obra — banco', { skip: !runSql }, () => {
  it('remove o pagamento gerado e mantém o valor definido na obra', async () => {
    const pg = await import('pg')
    const client = new pg.default.Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })

    const marker = `__TESTE_REABRIR_OBRA_${Date.now()}__`
    let obraId = null
    let contaId = null

    await client.connect()
    try {
      const { rows: fnRows } = await client.query(`
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'movelaria_reabrir_obra'
      `)
      assert.ok(fnRows.length > 0, 'função movelaria_reabrir_obra precisa existir')

      const { rows: adminRows } = await client.query(`
        SELECT id::text AS id
        FROM movelaria_usuarios
        WHERE ativo = true
          AND perfil IN ('administrador', 'administrador_obras', 'montador_admin')
        ORDER BY CASE perfil
          WHEN 'administrador' THEN 0
          WHEN 'administrador_obras' THEN 1
          ELSE 2
        END
        LIMIT 1
      `)
      assert.ok(adminRows.length > 0, 'precisa de um usuário admin para o teste')
      const adminId = adminRows[0].id

      const { rows: prestadorRows } = await client.query(`
        SELECT id::text AS id, COALESCE(NULLIF(TRIM(nome), ''), split_part(email, '@', 1)) AS nome
        FROM movelaria_usuarios
        WHERE ativo = true
          AND perfil IN ('montador', 'montador_admin')
        ORDER BY criado_em
        LIMIT 1
      `)
      assert.ok(prestadorRows.length > 0, 'precisa de um montador para o teste')
      const prestadorId = prestadorRows[0].id
      const prestadorNome = prestadorRows[0].nome

      const { rows: obraRows } = await client.query(
        `
          INSERT INTO movelaria_obras (
            cliente_nome, status_kanban, iniciado_em, finalizado_em,
            comissao_habilitada, comissao_total, comissao_gerada
          )
          VALUES ($1, 'concluida', NOW() - INTERVAL '2 days', NOW(), true, 150, true)
          RETURNING id::text AS id
        `,
        [marker],
      )
      obraId = obraRows[0].id

      await client.query(
        `
          INSERT INTO movelaria_obra_comissao_itens (obra_id, prestador_id, valor)
          VALUES ($1, $2, 150)
        `,
        [obraId, prestadorId],
      )

      const { rows: cpRows } = await client.query(
        `
          INSERT INTO movelaria_contas_pagar (
            prestador_id, obra_id, fornecedor_nome, descricao,
            valor_total, numero_parcela, total_parcelas, valor_parcela,
            data_vencimento, status
          )
          VALUES ($1, $2, $3, $4, 150, 1, 1, 150, CURRENT_DATE, 'pendente')
          RETURNING id::text AS id
        `,
        [prestadorId, obraId, `Comissão: ${prestadorNome}`, marker],
      )
      contaId = cpRows[0].id

      await client.query(
        `SELECT set_config('request.jwt.claim.sub', $1, false)`,
        [adminId],
      )
      await client.query(
        `SELECT set_config('request.jwt.claims', $1, false)`,
        [JSON.stringify({ sub: adminId, role: 'authenticated' })],
      )

      await client.query(`SELECT movelaria_reabrir_obra($1::uuid, NULL)`, [obraId])

      const { rows: obraAfter } = await client.query(
        `
          SELECT status_kanban, finalizado_em, comissao_gerada, comissao_habilitada, comissao_total
          FROM movelaria_obras
          WHERE id = $1
        `,
        [obraId],
      )
      assert.equal(obraAfter[0].status_kanban, 'em_andamento')
      assert.equal(obraAfter[0].finalizado_em, null)
      assert.equal(obraAfter[0].comissao_gerada, false)
      assert.equal(obraAfter[0].comissao_habilitada, true)
      assert.equal(Number(obraAfter[0].comissao_total), 150)

      const { rows: itensAfter } = await client.query(
        `SELECT valor FROM movelaria_obra_comissao_itens WHERE obra_id = $1`,
        [obraId],
      )
      assert.equal(itensAfter.length, 1)
      assert.equal(Number(itensAfter[0].valor), 150)

      const { rows: cpAfter } = await client.query(
        `SELECT 1 FROM movelaria_contas_pagar WHERE id = $1`,
        [contaId],
      )
      assert.equal(cpAfter.length, 0)
    } finally {
      if (obraId) {
        await client.query(`DELETE FROM movelaria_contas_pagar WHERE obra_id = $1`, [obraId])
        await client.query(`DELETE FROM movelaria_obras WHERE id = $1`, [obraId])
      }
      await client.end()
    }
  })
})
