/**
 * Monta payload MCP para deploy da Edge orcamentos-ia-pipeline.
 * Uso: node scripts/build-deploy-pipeline-payload.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('supabase/functions')
const files = [
  'orcamentos-ia-pipeline/index.ts',
  '_shared/cors.ts',
  '_shared/engineering-modular-prompts.ts',
  '_shared/llm-json.ts',
  '_shared/rebalance-environments.ts',
]

const payload = {
  name: 'orcamentos-ia-pipeline',
  entrypoint_path: 'orcamentos-ia-pipeline/index.ts',
  verify_jwt: true,
  files: files.map((rel) => ({
    name: rel.replace(/\\/g, '/'),
    content: fs.readFileSync(path.join(root, rel), 'utf8'),
  })),
}

const out = path.resolve('.deploy-payloads/_deploy-orcamentos-ia-pipeline.mcp.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(payload))
console.log('OK', out, 'files', payload.files.length, 'bytes', Buffer.byteLength(JSON.stringify(payload)))
console.log(
  'prompt has Default-with-Override:',
  payload.files
    .find((f) => f.name.includes('engineering-modular'))
    ?.content.includes('DEFAULT COM SOBRESCRITA'),
)
