/**
 * Teste: montador admin consegue ler o controle de ponto do dia.
 * Rodar: node --env-file=.env --test scripts/test-visualizacao-ponto-montador-admin.mjs
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

const DATABASE_URL = process.env.DATABASE_URL
const runSql = Boolean(DATABASE_URL)

describe('controle de ponto diário — montador admin', { skip: !runSql }, () => {
  it('retorna presentes, atrasados e faltas sem negar acesso', async () => {
    const pg = await import('pg')
    const client = new pg.default.Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    try {
      const { rows: adminRows } = await client.query(`
        SELECT id::text AS id
        FROM movelaria_usuarios
        WHERE ativo = true AND perfil = 'montador_admin'
        ORDER BY criado_em
        LIMIT 1
      `)
      assert.ok(adminRows.length > 0, 'precisa de um montador admin no banco')
      const adminId = adminRows[0].id

      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [adminId])
      await client.query(
        `SELECT set_config('request.jwt.claims', $1, false)`,
        [JSON.stringify({ sub: adminId, role: 'authenticated' })],
      )

      const { rows } = await client.query(`
        SELECT movelaria_ponto_controle_diario(movelaria_ponto_data_local()) AS payload
      `)
      const payload = rows[0].payload
      assert.ok(Array.isArray(payload), 'o painel deve devolver uma lista')
      assert.ok(payload.length > 0, 'a equipe de campo precisa aparecer')

      const status = new Set(payload.map(r => r.status_dia))
      for (const item of payload) {
        assert.ok(item.nome, 'cada linha precisa do nome')
        assert.ok(
          ['pendente', 'em_dia', 'atraso', 'completo', 'folga', 'falta'].includes(item.status_dia),
          `status inválido: ${item.status_dia}`,
        )
      }
      assert.ok(status.size >= 1)
    } finally {
      await client.end()
    }
  })
})
