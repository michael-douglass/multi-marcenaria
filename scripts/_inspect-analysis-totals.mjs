import fs from 'node:fs'

const path = process.argv[2]
const raw = fs.readFileSync(path, 'utf8')
let parsed
try {
  parsed = JSON.parse(raw)
} catch {
  // MCP sometimes wraps as text — extract first JSON array/object
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  parsed = JSON.parse(raw.slice(start, end + 1))
}

const row = Array.isArray(parsed) ? parsed[0] : parsed
const totals = typeof row.totals === 'string' ? JSON.parse(row.totals) : row.totals

const summary = {
  id: row.id,
  status: row.status,
  mode: row.mode,
  pricing_modality: row.pricing_modality,
  pricing_params: row.pricing_params,
  created_at: row.created_at,
  updated_at: row.updated_at,
  totalsKeys: Object.keys(totals || {}),
  sale_price: totals?.sale_price,
  materials_cost: totals?.materials_cost,
  bom_items_count: totals?.bom_items_count,
  materials_count: totals?.materials_count,
  modules: totals?.modules,
  environments: totals?.environments,
  pricing_note: totals?.pricing_note,
  pricing_formula: totals?.pricing_formula,
  using_facade_sqm: totals?.using_facade_sqm,
  sheet_area_m2_ref: totals?.sheet_area_m2_ref,
  pages_processed: totals?.pages_processed,
  warnings: totals?.warnings,
  auditor_notes: totals?.auditor_notes,
  inventory: totals?.inventory,
  company_standards: totals?.company_standards || totals?.standards || null,
  prefs_applied: totals?.prefs_applied || totals?.system_preferences || null,
  engineering_cot_preview: String(totals?.engineering_cot || '').slice(0, 1200),
}

console.log(JSON.stringify(summary, null, 2))

// Also dump preference / thickness mentions from engineering_cot
const cot = String(totals?.engineering_cot || '')
const thicknessHits = [...cot.matchAll(/(15|18)\s*mm/gi)].map((m) => m[0])
const unique = [...new Set(thicknessHits)]
console.log('\n--- thickness mentions ---')
console.log(unique)
console.log('count 15mm:', (cot.match(/15\s*mm/gi) || []).length)
console.log('count 18mm:', (cot.match(/18\s*mm/gi) || []).length)
console.log('DEFAULT/SOBRESC:', /DEFAULT|SOBRESC|branco|Noite|caixa/i.test(cot))
