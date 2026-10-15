/**
 * Smoke Épico 3 — contrato incremental sem re-upload.
 * Verifica que o código-fonte declara o fluxo:
 * projectId + pageNumbers + sourceFiles vazio → baixa PDF da pasta.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pipeline = readFileSync(join(root, 'src/lib/orcamentos-ia/pipeline.ts'), 'utf8')
const context = readFileSync(
  join(root, 'src/contexts/OrcamentosIaBackgroundContext.tsx'),
  'utf8',
)

const checks = [
  {
    name: 'downloadProjectPdfAsFile',
    ok: pipeline.includes('async function downloadProjectPdfAsFile'),
  },
  {
    name: 'contrato RunOrcamentosIaPipelineParams',
    ok:
      pipeline.includes('sourceFiles vazio') &&
      pipeline.includes('quote_projects.pdf_url'),
  },
  {
    name: 'startQuoteAnalysisFromProject',
    ok: context.includes('startQuoteAnalysisFromProject'),
  },
  {
    name: 'pipeline com sourceFiles vazios',
    ok: context.includes('sourceFiles: []') && context.includes('pageNumbers: fresh'),
  },
  {
    name: 'sem XHR de upload no from-project',
    ok:
      context.includes('startQuoteAnalysisFromProject') &&
      !/startQuoteAnalysisFromProject[\s\S]{0,2500}uploadQuoteProjectPdf/.test(context),
  },
]

const failed = checks.filter((c) => !c.ok)
if (failed.length) {
  console.error('FAIL', failed.map((f) => f.name))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, checks: checks.map((c) => c.name) }, null, 2))
console.log('OK smoke-incremental-from-project')
