/**
 * Teste E2E do Orçamentos IA contra o Supabase real (edge `orcamentos-ia-pipeline` + OpenAI).
 * Cria uma análise nova com as páginas já convertidas em JPEG e roda o pipeline do app
 * (`reprocessOrcamentosIaPipeline` → sanitização → Zod → preços → persistência).
 *
 * ATENÇÃO: grava no banco/Storage de produção (análise nova, PDF salvo como e2e-projeto.pdf).
 *
 * Rodar:
 *   node --env-file=.env scripts/test-orcamentos-ia-e2e.mjs <pasta-com-page-001.jpg…> [source.pdf]
 *   (ou E2E_ANALYSIS_ID=<uuid> para só validar uma análise existente;
 *    + E2E_REPROCESS=1 para reprocessá-la antes, como o botão "Reprocessar PDF")
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const COMPANY_ID = process.env.E2E_COMPANY_ID || '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'
const pagesDir = process.argv[2]
const sourcePdf = process.argv[3]

if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env).')
  process.exit(1)
}

// Módulos virtuais: cliente service role no lugar do client do browser; PDF→imagem não usado
const stubs = {
  '@/lib/supabase': `
    import { createClient } from '@supabase/supabase-js'
    export const supabase = createClient(${JSON.stringify(process.env.VITE_SUPABASE_URL)},
      ${JSON.stringify(process.env.SUPABASE_SERVICE_ROLE_KEY)}, { auth: { persistSession: false } })`,
  '@/lib/pdf-to-image': `
    export async function convertPdfPagesToJpegSequential() {
      throw new Error('stub: páginas devem estar no Storage')
    }`,
}

const vite = await createServer({
  configFile: false,
  plugins: [
    {
      name: 'e2e-stubs',
      enforce: 'pre',
      // O alias @ roda antes: compara pelo caminho já resolvido (…/src/lib/supabase[.ts])
      resolveId: (id) => {
        const key = Object.keys(stubs).find(
          (k) => id === k || id.replace(/\.ts$/, '').endsWith(k.replace('@', '/src')),
        )
        return key ? `\0${key}` : null
      },
      load: (id) => (id.startsWith('\0') && id.slice(1) in stubs ? stubs[id.slice(1)] : null),
    },
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

const load = (p) => vite.ssrLoadModule(p)
const { supabase } = await load('@/lib/supabase')
const { ORCAMENTOS_IA_BUCKET } = await load('/src/lib/orcamentos-ia/storage.ts')
const { reprocessOrcamentosIaPipeline } = await load('/src/lib/orcamentos-ia/pipeline.ts')
const { loadQuoteAnalysisTree } = await load('/src/lib/orcamentos-ia/quote-tree.ts')
const { calculateQuotePricing, buildShoppingList, formatBRL } = await load(
  '/src/lib/orcamentos-ia/pricing.ts',
)

let analysisId = process.env.E2E_ANALYSIS_ID

if (!analysisId) {
  if (!pagesDir) {
    console.error('Informe a pasta com page-001.jpg… ou E2E_ANALYSIS_ID.')
    await vite.close()
    process.exit(1)
  }
  const { data: row, error } = await supabase
    .from('quote_analyses')
    .insert({ company_id: COMPANY_ID, mode: 'max', status: 'PENDING' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  analysisId = row.id
  console.log('Análise criada:', analysisId)

  const prefix = `${COMPANY_ID}/${analysisId}`
  if (sourcePdf) {
    const path = `${prefix}/e2e-projeto.pdf`
    const up = await supabase.storage
      .from(ORCAMENTOS_IA_BUCKET)
      .upload(path, readFileSync(sourcePdf), { contentType: 'application/pdf', upsert: true })
    if (up.error) throw new Error(up.error.message)
    await supabase.from('quote_analyses').update({ source_pdf_path: path }).eq('id', analysisId)
  }
  const pages = readdirSync(pagesDir).filter((f) => /^page-\d{3}\.jpg$/.test(f)).sort()
  for (const f of pages) {
    const up = await supabase.storage
      .from(ORCAMENTOS_IA_BUCKET)
      .upload(`${prefix}/pages/${f}`, readFileSync(join(pagesDir, f)), {
        contentType: 'image/jpeg',
        upsert: true,
      })
    if (up.error) throw new Error(`${f}: ${up.error.message}`)
  }
  console.log(`${pages.length} página(s) enviadas.`)

  const t0 = Date.now()
  console.log('Rodando pipeline (edge + OpenAI) — pode levar minutos…')
  const result = await reprocessOrcamentosIaPipeline({ analysisId, companyId: COMPANY_ID })
  console.log(`Pipeline: ${JSON.stringify(result)} em ${Math.round((Date.now() - t0) / 1000)}s`)
}

if (process.env.E2E_ANALYSIS_ID && process.env.E2E_REPROCESS === '1') {
  const t0 = Date.now()
  console.log('Reprocessando análise existente (edge + OpenAI)…')
  const result = await reprocessOrcamentosIaPipeline({ analysisId, companyId: COMPANY_ID })
  console.log(`Pipeline: ${JSON.stringify(result)} em ${Math.round((Date.now() - t0) / 1000)}s`)
}

// ---------------------------------------------------------------- validações
const { data: tree, error: treeErr } = await loadQuoteAnalysisTree(analysisId)
if (treeErr || !tree) throw new Error(treeErr || 'árvore vazia')

let ok = true
const check = (label, cond, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!cond) ok = false
}

const mods = tree.environments.flatMap((e) => e.modules.map((m) => ({ env: e.name, ...m })))
const scoped = mods.filter((m) => !m.out_of_scope)
const outOfScope = mods.filter((m) => m.out_of_scope)
const mats = scoped.flatMap((m) => m.materials)
const chapas = mats.filter((m) => m.category === 'chapa')

console.log('\n== Árvore ==')
for (const m of mods) {
  const cost = m.materials.reduce(
    (a, x) => a + Number(x.exact_quantity) * Number(x.unit_price),
    0,
  )
  console.log(
    `${m.out_of_scope ? '[FORA] ' : ''}${m.env} → ${m.name}: ${m.materials.length} itens, ~${formatBRL(cost)}${m.dimensions?.estimated ? ' (dims estimadas)' : ''}`,
  )
}

console.log('\n== Checagens ==')
check('status COMPLETED', tree.status === 'COMPLETED', tree.status)
check('há módulos de marcenaria', scoped.length > 0, `${scoped.length} módulos`)
check(
  'nenhum insumo com unit_price ≤ 0',
  mats.every((m) => Number(m.unit_price) > 0),
  `${mats.filter((m) => !(Number(m.unit_price) > 0)).length} zerado(s)`,
)
check('todo módulo de marcenaria tem insumos', scoped.every((m) => m.materials.length > 0))
const warnings = (tree.totals?.warnings ?? []).join(' ')
const oversizedRows = chapas.filter((m) => {
  const dims = (m.notes || '').match(/(\d+)x(\d+)x/)
  if (!dims) return false
  const [a, b] = [Number(dims[1]), Number(dims[2])].sort((x, y) => y - x)
  return a > 2750 || b > 1850
})
check(
  'chapas em m² com área > 0',
  chapas.length > 0 && chapas.every((m) => m.unit_measure !== 'm2' || Number(m.exact_quantity) > 0),
  `${chapas.filter((m) => m.unit_measure === 'm2').length}/${chapas.length} em m²`,
)
check(
  'peças maiores que a chapa são sinalizadas em warnings',
  !oversizedRows.length || /maiores que a chapa/.test(warnings),
  `${oversizedRows.length} peça(s)`,
)
const tapeKeys = scoped.flatMap((m) =>
  m.materials
    .filter((x) => x.category === 'fita_borda')
    .map((x) => `${m.id}|${x.raw_name.toLowerCase().replace(/fita|de|borda|arauco|\s+/g, '')}`),
)
check('sem fita duplicada no mesmo módulo', new Set(tapeKeys).size === tapeKeys.length)
check(
  'nenhuma peça 15×15 mm',
  !chapas.some((m) => /\b15x15x/.test(m.notes || '')),
)
check(
  'sem placeholder "Fora de escopo — …" precificado',
  !mats.some((m) => /fora de escopo/i.test(m.raw_name)),
)
check(
  'fora do escopo sem insumos',
  outOfScope.every((m) => m.materials.length === 0),
  `${outOfScope.length} módulo(s): ${outOfScope.map((m) => m.name).join(', ') || '—'}`,
)

const pricing = calculateQuotePricing(tree)
const shopping = buildShoppingList(tree)
const sheets = shopping.filter((i) => i.category === 'chapa')
console.log(
  `\nCusto materiais ${formatBRL(pricing.materialsCost)} · venda ${formatBRL(pricing.salePrice)} · ` +
    `${sheets.reduce((a, i) => a + i.purchaseQuantity, 0)} chapa(s) em ${sheets.length} material(is)`,
)
const unitPrices = mats.map((m) => Number(m.unit_price))
const topRepeat = Object.entries(
  unitPrices.reduce((acc, p) => ((acc[p] = (acc[p] || 0) + 1), acc), {}),
).sort((a, b) => b[1] - a[1])[0]
console.log(`Preço unitário mais repetido: R$ ${topRepeat?.[0]} × ${topRepeat?.[1]} de ${mats.length}`)
console.log('warnings:', JSON.stringify(tree.totals?.warnings ?? []))
console.log(`\nAnálise: ${analysisId}`)

await vite.close()
process.exit(ok ? 0 : 1)
