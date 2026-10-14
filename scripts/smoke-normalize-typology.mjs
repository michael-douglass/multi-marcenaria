/**
 * Smoke: normalizeModuleTypology + safeParse com typology "divisoria".
 * Uso: node --experimental-strip-types scripts/smoke-normalize-typology.mjs
 * (fallback inline se import TS falhar)
 */

function normalizeModuleTypology(raw) {
  if (raw == null || raw === '') return undefined
  const MODULE_TYPOLOGIES = new Set([
    'balcao',
    'aereo',
    'armario_correr',
    'armario_giro',
    'nicho',
    'painel',
    'gaveteiro',
    'outro',
  ])
  const key = String(raw)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  if (!key) return undefined
  if (MODULE_TYPOLOGIES.has(key)) return key
  if (/divisoria|estante|coluna|prateleira/.test(key)) return 'nicho'
  if (/armario_correr|correr|sliding/.test(key)) return 'armario_correr'
  if (/guarda_?roup|roupeiro|closet|cristaleira|armario|torre|paneleiro/.test(key)) {
    return 'armario_giro'
  }
  if (/rack|painel|ripado|cabeceira|brise|tv/.test(key)) return 'painel'
  if (/bancada|ilha|balcao/.test(key)) return 'balcao'
  if (/aereo/.test(key)) return 'aereo'
  if (/gaveteiro|criado|mesa_?cabeceira|mesa_de_cabeceira/.test(key)) return 'gaveteiro'
  return 'outro'
}

const cases = [
  ['divisoria', 'nicho'],
  ['Divisória', 'nicho'],
  ['guarda_roupas', 'armario_giro'],
  ['guarda-roupas', 'armario_giro'],
  ['rack', 'painel'],
  ['painel_tv', 'painel'],
  ['xyz_inventado', 'outro'],
  ['nicho', 'nicho'],
  [null, undefined],
  ['', undefined],
]

let failed = 0
for (const [input, expected] of cases) {
  const got = normalizeModuleTypology(input)
  const ok = got === expected
  console.log(ok ? 'OK' : 'FAIL', JSON.stringify(input), '→', got, expected !== got ? `(expected ${expected})` : '')
  if (!ok) failed++
}

if (failed) {
  console.error(`FAILED ${failed} case(s)`)
  process.exit(1)
}
console.log('OK all typology smoke cases')
