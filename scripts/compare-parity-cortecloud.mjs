/**
 * Paridade BOM/chapas: Cortecloud #23125828 vs nosso resultado.
 *
 * Uso:
 *   node scripts/compare-parity-cortecloud.mjs
 *   node scripts/compare-parity-cortecloud.mjs --a docs/evidence/resultado_cortecloud_23125828.json --b docs/evidence/nosso_resultado.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return fallback
}

const pathA = path.resolve(
  ROOT,
  arg('--a', 'docs/evidence/resultado_cortecloud_23125828.json'),
)
const pathB = path.resolve(ROOT, arg('--b', 'docs/evidence/nosso_resultado.json'))
const outPath = path.resolve(ROOT, arg('--out', 'docs/evidence/parity-report-23125828.json'))

const a = JSON.parse(fs.readFileSync(pathA, 'utf8'))
const b = JSON.parse(fs.readFileSync(pathB, 'utf8'))

function colorKey(label) {
  const s = String(label || '').toUpperCase()
  if (/BEGE/.test(s)) return 'Bege'
  if (/LORD/.test(s)) return 'Lord'
  if (/BLUSH/.test(s)) return 'Blush'
  if (/AZUL/.test(s)) return 'Azul'
  if (/IMBUIA/.test(s)) return 'Imbuia'
  if (/AREIA/.test(s)) return 'Areia'
  if (/MINT/.test(s)) return 'Mint'
  if (/BRANCO/.test(s)) return 'Branco'
  if (/LOURO|FREIJ/.test(s)) return 'Louro Freijo'
  if (/VIDRO/.test(s)) return 'Vidro'
  return 'Outro'
}

const ccSheets = {}
for (const s of a.sheets || []) {
  const k = colorKey(s.label || s.color)
  ccSheets[k] = (ccSheets[k] || 0) + Number(s.consumption || 0)
}

const ourSheets = { ...(b.sheets_priced_ui || {}) }
delete ourSheets.total

const allColors = [...new Set([...Object.keys(ccSheets), ...Object.keys(ourSheets)])].sort()
const sheet_deltas = {}
for (const c of allColors) {
  const cc = ccSheets[c] || 0
  const ours = ourSheets[c] || 0
  sheet_deltas[c] = { cortecloud: cc, nosso: ours, delta: ours - cc }
}

const ccAmbients = Object.keys(a.ambients_piece_qty || {}).sort()
const ourEnvs = new Set((b.in_scope || []).map((m) => m.env))
const missing_ambients = ccAmbients.filter((amb) => {
  const key = amb.toLowerCase()
  for (const e of ourEnvs) {
    if (e.toLowerCase().includes(key) || key.includes(e.toLowerCase().slice(0, 8))) return false
  }
  // fuzzy pt
  if (/quarto 01|quarto su/i.test(amb) && [...ourEnvs].some((e) => /quarto/i.test(e))) return false
  if (/area de servi/i.test(amb) && [...ourEnvs].some((e) => /servi/i.test(e))) return false
  if (/home office/i.test(amb) && [...ourEnvs].some((e) => /home office/i.test(e))) return false
  if (/banheiro terre/i.test(amb) && [...ourEnvs].some((e) => /banheiro t/i.test(e))) return false
  if (/^cozinha$/i.test(amb) && [...ourEnvs].some((e) => /cozinha/i.test(e))) return false
  return true
})

const report = {
  compared_at: new Date().toISOString(),
  target_a: pathA,
  target_b: pathB,
  cortecloud: {
    plan_id: a.plan_id,
    sheets_total: a.sheets_total,
    parts_rows: a.parts_rows,
    pieces_quantity_sum: a.pieces_quantity_sum,
    materials_rs: a.pricing_ui_reference?.materials,
    ambients: ccAmbients,
  },
  nosso: {
    analysis_id: b.analysis_id,
    sheets_total: b.sheets_priced_ui?.total ?? Object.values(ourSheets).reduce((s, n) => s + Number(n || 0), 0),
    modules_in_scope: b.modules_in_scope,
    modules_out_of_scope: b.modules_out_of_scope,
    materials_rs: b.materials_cost,
    sale_price: b.sale_price,
  },
  sheet_deltas,
  sheets_gap: (a.sheets_total || 0) - (b.sheets_priced_ui?.total || 0),
  materials_delta_rs:
    b.materials_cost != null && a.pricing_ui_reference?.materials != null
      ? Number((b.materials_cost - a.pricing_ui_reference.materials).toFixed(2))
      : null,
  missing_ambients,
  wrongly_oos_candidates: b.wrongly_oos_candidates_for_new_rules || [],
  acceptance: {
    sheets_target: 74,
    sheets_min: 70,
    sheets_ok: (b.sheets_priced_ui?.total || 0) >= 70,
    materials_near: Math.abs((b.materials_cost || 0) - (a.pricing_ui_reference?.materials || 0)) < 2000,
    notes:
      'Travas anti-OOS no codigo prontas; cobertura 74 chapas exige reprocessamento LLM do PDF com prompts novos.',
  },
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log(`\nRelatório: ${outPath}`)
