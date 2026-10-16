/**
 * FromScratch DET_CLÍNICA via service role + Edge async (anti-504).
 * 1) limpa envs/BOM/checkpoint (exceto --resume)
 * 2) phase=start_async (cadeia 1 página/request)
 * 3) poll até ready_for_pricing (auto-retoma se stall)
 * 4) rebalance + consolidate E3–E6 → COMPLETED/NEEDS_REVIEW
 *
 * Uso:
 *   node --env-file=.env scripts/e7-fromscratch-det-clinica.mjs
 *   node --env-file=.env scripts/e7-fromscratch-det-clinica.mjs --resume
 *   node --env-file=.env scripts/e7-fromscratch-det-clinica.mjs --resume 34
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'vite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resumeFlag = process.argv.includes('--resume')
const resumePageArg = (() => {
  const idx = process.argv.indexOf('--resume')
  if (idx < 0) return null
  const next = process.argv[idx + 1]
  if (next && /^\d+$/.test(next)) return Number(next)
  return null
})()
const ANALYSIS_ID =
  process.argv.slice(2).find((a, i, arr) => {
    if (a.startsWith('--')) return false
    if (arr[i - 1] === '--resume' && /^\d+$/.test(a)) return false
    return true
  }) || '8f507c97-dd86-44ad-858b-090ad4ce8ef2'
const LOG = path.join(ROOT, 'docs/evidence/e7-fromscratch-run.log')
const POLL_MS = 8_000
const STALL_MS = 10 * 60_000
const MAX_WAIT_MS = 90 * 60_000
const MAX_STALL_RESUMES = 8

function log(...args) {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
  console.log(line)
  fs.appendFileSync(LOG, line + '\n', 'utf8')
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

if (!resumeFlag) fs.writeFileSync(LOG, '', 'utf8')
else fs.appendFileSync(LOG, '\n', 'utf8')
const startedAt = new Date().toISOString()
log('=== FROM SCRATCH', ANALYSIS_ID, startedAt, resumeFlag ? '(RESUME)' : '', '===')

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !serviceKey) {
  log('Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: analysis, error: aErr } = await admin
  .from('quote_analyses')
  .select('id, company_id, mode, project_id, status, totals, extraction_model')
  .eq('id', ANALYSIS_ID)
  .single()
if (aErr || !analysis) throw new Error(aErr?.message || 'Análise não encontrada')

const companyId = analysis.company_id
const prevTotals =
  analysis.totals && typeof analysis.totals === 'object' ? { ...analysis.totals } : {}
const pageNumbers = Array.isArray(prevTotals.page_ranges)
  ? prevTotals.page_ranges.filter((n) => typeof n === 'number' && n > 0)
  : Array.isArray(prevTotals.selected_pages)
    ? prevTotals.selected_pages.filter((n) => typeof n === 'number' && n > 0)
    : []

async function listPages(prefix) {
  const { data, error } = await admin.storage.from('orcamentos-ia').list(prefix, {
    limit: 200,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) throw new Error(error.message)
  return (data || [])
    .filter((o) => /\.(png|jpe?g|webp)$/i.test(o.name || ''))
    .map((o) => `${prefix}/${o.name}`)
    .sort()
}

let pagePaths = Array.isArray(prevTotals.page_paths)
  ? prevTotals.page_paths.filter((p) => typeof p === 'string')
  : []
if (!pagePaths.length) {
  pagePaths = await listPages(`${companyId}/${ANALYSIS_ID}/pages`)
  if (!pagePaths.length && analysis.project_id) {
    pagePaths = await listPages(`${companyId}/quote-projects/${analysis.project_id}/pages`)
  }
}
if (!pagePaths.length) throw new Error('Nenhuma página no Storage')
log(`Páginas: ${pagePaths.length}`)

async function kickStartAsync(resumeFromPage) {
  log(`Chamando Edge start_async (resumeFromPage=${resumeFromPage})…`)
  const edgeRes = await fetch(`${url}/functions/v1/orcamentos-ia-pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: anonKey || serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      analysisId: ANALYSIS_ID,
      companyId,
      mode: analysis.mode === 'pro' ? 'pro' : 'max',
      extraction_model: analysis.extraction_model || undefined,
      pagePaths,
      phase: 'start_async',
      resumeFromPage,
    }),
  })
  const startPayload = await edgeRes.json().catch(() => ({}))
  if (!edgeRes.ok || !startPayload?.ok) {
    const err = startPayload?.error || `Edge HTTP ${edgeRes.status}`
    log('FALHA start_async:', err)
    return { ok: false, error: err }
  }
  log('start_async OK', {
    status: startPayload.status,
    total_pages: startPayload.total_pages,
    skipped_restart: startPayload.skipped_restart || false,
    resumeFromPage,
  })
  return { ok: true, payload: startPayload }
}

if (!resumeFlag) {
  // Limpa árvore + BOM (fromScratch)
  const { data: oldEnvs } = await admin
    .from('quote_environments')
    .select('id')
    .eq('analysis_id', ANALYSIS_ID)
  if (oldEnvs?.length) {
    await admin.from('quote_environments').delete().in(
      'id',
      oldEnvs.map((e) => e.id),
    )
    log(`Ambientes antigos apagados: ${oldEnvs.length}`)
  } else {
    log('Nenhum ambiente residual')
  }
  await admin.from('bom_items').delete().eq('project_id', ANALYSIS_ID)
  log('bom_items limpos')

  await admin
    .from('quote_analyses')
    .update({
      status: 'READING_LAYOUT',
      error_message: null,
      updated_at: new Date().toISOString(),
      totals: {
        ...prevTotals,
        current_page: 0,
        partial_extraction: null,
        last_extraction: null,
        consolidated_bom: null,
        project_sheet_palette: null,
        inventory: null,
        coverage: null,
        bom_gaps: null,
        self_heal: null,
        circuit_breaker: null,
        audited_environments: null,
        async_chain_status: null,
        modules_found_count: 0,
        modules: 0,
        environments: 0,
        pipeline_stage: 'reading_inventory',
        pipeline_detail: 'E7 fromScratch async — iniciando cadeia…',
        from_scratch_started_at: startedAt,
        from_scratch_finished_at: null,
        e7_gates: null,
        page_paths: pagePaths,
        ...(pageNumbers.length
          ? { page_ranges: pageNumbers, selected_pages: pageNumbers }
          : {}),
      },
    })
    .eq('id', ANALYSIS_ID)

  const kicked = await kickStartAsync(0)
  if (!kicked.ok) {
    await admin
      .from('quote_analyses')
      .update({
        status: 'NEEDS_REVIEW',
        error_message: String(kicked.error).slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ANALYSIS_ID)
    process.exit(1)
  }
} else {
  const resumePage =
    resumePageArg != null
      ? resumePageArg
      : Number.isFinite(Number(prevTotals.current_page))
        ? Math.max(0, Math.floor(Number(prevTotals.current_page)))
        : 0
  log(`Modo resume — retomando na página índice ${resumePage} (${resumePage + 1}/${pagePaths.length})`)
  // Libera skip idempotente: marca failed temporariamente se ainda "running" sem tick
  await admin
    .from('quote_analyses')
    .update({
      status: 'EXTRACTING_MODULES',
      error_message: null,
      updated_at: new Date().toISOString(),
      totals: {
        ...prevTotals,
        page_paths: pagePaths,
        async_chain_status: 'running',
        pipeline_stage: 'extracting_batch',
        pipeline_detail: `E7 resume — página ${resumePage + 1} de ${pagePaths.length}…`,
        from_scratch_started_at: prevTotals.from_scratch_started_at || startedAt,
      },
    })
    .eq('id', ANALYSIS_ID)
  const kicked = await kickStartAsync(resumePage)
  if (!kicked.ok) process.exit(1)
}

log('Aguardando cadeia async (ready_for_pricing)…')
const pollStarted = Date.now()
let lastProgressAt = Date.now()
let lastFingerprint = ''
let readyStreak = 0
let stallResumes = 0

while (true) {
  if (Date.now() - pollStarted > MAX_WAIT_MS) {
    log('TIMEOUT: cadeia async ultrapassou 90 min')
    process.exit(1)
  }

  const { data: row, error: pollErr } = await admin
    .from('quote_analyses')
    .select('status, error_message, totals')
    .eq('id', ANALYSIS_ID)
    .single()
  if (pollErr) {
    log('poll erro (retry):', pollErr.message)
    await sleep(POLL_MS)
    continue
  }

  const tot = row?.totals && typeof row.totals === 'object' ? row.totals : {}
  const chain = typeof tot.async_chain_status === 'string' ? tot.async_chain_status : ''
  const stage = typeof tot.pipeline_stage === 'string' ? tot.pipeline_stage : ''
  const detail = typeof tot.pipeline_detail === 'string' ? tot.pipeline_detail : ''
  const page = Number(tot.current_page) || 0
  const mods = Number(tot.modules_found_count) || 0
  const fp = `${chain}|${stage}|${page}|${mods}|${row?.status}`
  if (fp !== lastFingerprint) {
    lastFingerprint = fp
    lastProgressAt = Date.now()
    log('progresso', {
      status: row?.status,
      chain,
      stage,
      page: `${page + 1}/${pagePaths.length}`,
      mods,
      detail: detail.slice(0, 120),
    })
  }

  if (chain === 'cancelled' || /interrompid/i.test(String(row?.error_message || ''))) {
    log('Cadeia cancelada pelo usuário')
    process.exit(1)
  }

  if (chain === 'ready_for_pricing' || stage === 'pricing_pending') {
    readyStreak += 1
    if (readyStreak >= 2) {
      log('Cadeia pronta para consolidate')
      break
    }
  } else {
    readyStreak = 0
  }

  const stalled = Date.now() - lastProgressAt > STALL_MS
  const failed = chain === 'failed' || (row?.status === 'FAILED' && chain !== 'running')
  if (stalled || failed) {
    if (stallResumes >= MAX_STALL_RESUMES) {
      log(stalled ? 'STALL: esgotadas retomas automáticas' : 'FALHA cadeia:', detail || row?.error_message)
      process.exit(1)
    }
    stallResumes += 1
    const resumePage = Math.max(0, Math.min(page, pagePaths.length - 1))
    log(
      stalled
        ? `STALL: sem progresso há ${Math.round(STALL_MS / 60000)} min — retoma #${stallResumes} na pág. ${resumePage + 1}`
        : `FALHA recuperável — retoma #${stallResumes} na pág. ${resumePage + 1}: ${detail || row?.error_message}`,
    )
    // Quebra skip idempotente do start_async
    await admin
      .from('quote_analyses')
      .update({
        status: 'EXTRACTING_MODULES',
        error_message: null,
        updated_at: new Date().toISOString(),
        totals: {
          ...tot,
          async_chain_status: null,
          pipeline_stage: 'extracting_batch',
          pipeline_detail: `Retomando automaticamente na página ${resumePage + 1}…`,
        },
      })
      .eq('id', ANALYSIS_ID)
    const kicked = await kickStartAsync(resumePage)
    if (!kicked.ok) process.exit(1)
    lastProgressAt = Date.now()
    lastFingerprint = ''
  }

  await sleep(POLL_MS)
}

const { data: readyRow } = await admin
  .from('quote_analyses')
  .select('totals')
  .eq('id', ANALYSIS_ID)
  .single()
const readyTotals =
  readyRow?.totals && typeof readyRow.totals === 'object' ? readyRow.totals : {}
const extractionSrc =
  readyTotals.partial_extraction && typeof readyTotals.partial_extraction === 'object'
    ? readyTotals.partial_extraction
    : null
const inventory = Array.isArray(readyTotals.inventory) ? readyTotals.inventory : []
if (!extractionSrc || !Array.isArray(extractionSrc.environments)) {
  log('FALHA: partial_extraction ausente após ready_for_pricing')
  process.exit(1)
}
log('Partial pronto', {
  envs: extractionSrc.environments.length,
  inventory: inventory.length,
})

log('Aplicando rebalance + consolidate E3–E6…')

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis
if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
  })
  globalThis.window.matchMedia = globalThis.matchMedia
}

const vite = await createServer({
  configFile: false,
  resolve: { alias: { '@': path.join(ROOT, 'src') } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
})

const { rebalanceEnvironments } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/rebalance.ts')
const { consolidateExtractionForPricing } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/bom-consolidate.ts',
)
const { countDistinctCommercialSheetSkus } = await vite.ssrLoadModule(
  '/src/lib/orcamentos-ia/project-sheet-palette.ts',
)
const { sumCorredicaPairs } = await vite.ssrLoadModule('/src/lib/orcamentos-ia/drawer-slides.ts')

const rebalanced = rebalanceEnvironments(extractionSrc, inventory)
const { extraction, consolidatedBom, projectSheetPalette } =
  consolidateExtractionForPricing(rebalanced)

const envs = extraction.environments || []
const modCount = envs.reduce((n, e) => n + (e.modules || []).filter((m) => !m.out_of_scope).length, 0)
let corredica = 0
for (const env of envs) {
  for (const mod of env.modules || []) {
    if (mod.out_of_scope) continue
    corredica += sumCorredicaPairs(mod.ferragens || [])
  }
}
const skus = countDistinctCommercialSheetSkus(consolidatedBom.sheets || [])
const phantoms = envs.filter((e) => /quarto|banheiro/i.test(e.name || '')).map((e) => e.name)

const finishedAt = new Date().toISOString()
await admin
  .from('quote_analyses')
  .update({
    status: modCount > 0 ? 'COMPLETED' : 'NEEDS_REVIEW',
    error_message: null,
    updated_at: finishedAt,
    totals: {
      ...readyTotals,
      inventory,
      coverage: readyTotals.coverage || null,
      last_extraction: extraction,
      partial_extraction: extraction,
      consolidated_bom: consolidatedBom,
      project_sheet_palette: projectSheetPalette.map((s) => ({
        label: s.label,
        thickness_mm: s.thickness_mm,
        role: s.role,
      })),
      modules: modCount,
      environments: envs.length,
      pages_processed: pagePaths.length,
      pages_total: pagePaths.length,
      async_chain_status: 'completed',
      pipeline_stage: 'completed',
      pipeline_detail: 'E7 fromScratch async + consolidate E3–E6',
      from_scratch_started_at: startedAt,
      from_scratch_finished_at: finishedAt,
      e7_gates: {
        e3_skus_ge_5: skus >= 5,
        e4_corredica_gt_0: corredica > 0,
        e5_modules_ge_70: modCount >= 70,
        e6_no_phantom_bedroom: phantoms.length === 0,
      },
      auditor_notes: extraction.auditor_notes || [],
      warnings: extraction.warnings || [],
      reprocessed_at: finishedAt,
    },
  })
  .eq('id', ANALYSIS_ID)

log('Gates pós-fromScratch:', {
  modules: modCount,
  skus,
  corredica,
  phantoms,
  envs: envs.map((e) => e.name),
})
log('finished_at', finishedAt)
await vite.close()
log('=== FROM SCRATCH OK ===')
