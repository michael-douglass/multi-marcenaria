/**
 * Smoke — derivePipelineTelemetry (espelha a lógica tipada do TS).
 */
function derive(params) {
  const totals = params.totals && typeof params.totals === 'object' ? params.totals : {}
  const status = params.status ?? null
  const stage = String(params.pipelineStage || totals.pipeline_stage || '').toLowerCase()
  let phase = 'other'
  if (stage === 'self_heal') phase = 'self_heal'
  else if (stage === 'auditing' || status === 'AUDITING_REVISION') phase = 'audit'
  else if (stage === 'extracting_batch' || status === 'EXTRACTING_MODULES') phase = 'extract'

  const currentPage = Number(totals.current_page)
  const totalPages = Number(totals.total_pages)
  const modulesFound = Number(totals.modules_found_count) || 0
  const audited = Array.isArray(totals.audited_environments)
    ? totals.audited_environments.filter((x) => typeof x === 'string')
    : []
  const inventory = Array.isArray(totals.inventory) ? totals.inventory : []

  let progress01 = 0.55
  if (phase === 'extract' && totalPages > 0) {
    progress01 = Math.min(1, Math.max(0, currentPage || 0) / totalPages)
  } else if ((phase === 'audit' || phase === 'self_heal') && inventory.length > 0) {
    progress01 = Math.min(1, audited.length / inventory.length)
  }

  return {
    phase,
    shaderMode: phase === 'extract' ? 'extract' : phase === 'audit' || phase === 'self_heal' ? 'audit' : 'idle',
    progressPercent: Math.round(progress01 * 100),
    modulesFound,
    auditedCount: audited.length,
  }
}

const extract = derive({
  status: 'EXTRACTING_MODULES',
  pipelineStage: 'extracting_batch',
  totals: { current_page: 6, total_pages: 19, modules_found_count: 12 },
})
if (extract.phase !== 'extract' || extract.progressPercent !== 32 || extract.modulesFound !== 12) {
  console.error('FAIL extract', extract)
  process.exit(1)
}

const audit = derive({
  status: 'AUDITING_REVISION',
  pipelineStage: 'auditing',
  totals: {
    audited_environments: ['Cozinha', 'Quarto'],
    inventory: [{ environment: 'Cozinha' }, { environment: 'Quarto' }, { environment: 'Sala' }],
  },
})
if (audit.phase !== 'audit' || audit.shaderMode !== 'audit' || audit.auditedCount !== 2) {
  console.error('FAIL audit', audit)
  process.exit(1)
}
// 2/3 ≈ 67%
if (audit.progressPercent !== 67) {
  console.error('FAIL audit progress', audit.progressPercent)
  process.exit(1)
}

console.log('OK smoke-pipeline-telemetry')
