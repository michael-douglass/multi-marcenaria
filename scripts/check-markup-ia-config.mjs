/**
 * Diagnóstico da Epic 0 (prd-markup-ia-composicao-visual.md): confirma se as
 * 3 pré-condições do botão "Compor com IA" estão ligadas. Só leitura.
 *
 * Uso: node --env-file=.env scripts/check-markup-ia-config.mjs
 */
import pkg from 'pg'
const { Client } = pkg
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

console.log('🔎 Verificando pré-condições de "Compor com IA"...\n')

try {
  const { rows } = await client.query(`
    SELECT markup_ia_ativo, markup_ia_model, markup_ia_auditor_model,
           (markup_ia_prompt IS NOT NULL AND length(markup_ia_prompt) > 0) AS tem_prompt_principal,
           (markup_ia_agent_prompts IS NOT NULL) AS tem_prompts_por_agente
    FROM emp_garbo.markup_config
    ORDER BY atualizado_em DESC NULLS LAST
    LIMIT 1
  `)
  console.log('markup_config (emp_garbo):', rows[0] ?? '⚠️  nenhuma linha encontrada')
} catch (err) {
  console.log('❌ Falha lendo emp_garbo.markup_config:', err.message)
}

for (const table of ['pipeline_lead_ai_config', 'pipeline_ia_config', 'pipeline_lead_ai']) {
  try {
    const { rows } = await client.query(`
      SELECT singleton_key, ativo,
             (openai_api_key IS NOT NULL AND length(openai_api_key) > 0) AS chave_openai_configurada,
             model
      FROM emp_garbo.${table}
      WHERE singleton_key = 'default'
    `)
    console.log(`\nemp_garbo.${table}:`, rows[0] ?? '⚠️  nenhuma linha encontrada')
    break
  } catch (err) {
    console.log(`\n(tentativa emp_garbo.${table} falhou: ${err.message})`)
  }
}

await client.end()
