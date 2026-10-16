/**
 * Gate Épico 4 — De-Para ferragens expandido + preço único (fonte).
 * Uso: node scripts/smoke-hardware-alias.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
let failed = 0

function ok(cond, msg) {
  if (cond) console.log('OK', msg)
  else {
    console.error('FAIL', msg)
    failed++
  }
}

function normalizeHardwareText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const RULES = [
  {
    key: 'puxador_alca',
    canonicalName: 'PUXADOR ALÇA',
    patterns: [/puxador.*alc/, /\balca\b.*puxador/, /puxador perfil/, /puxador.*concha/],
  },
  {
    key: 'dobradica_soft_close',
    canonicalName: 'DOBRADIÇA RETA SOFT-CLOSE',
    patterns: [/dobradic.*soft/, /soft.?close.*dobrad/, /dobradic.*amortec/],
  },
  {
    key: 'dobradica_reta',
    canonicalName: 'DOBRADIÇA RETA',
    patterns: [/dobradic/, /hinge/],
  },
  {
    key: 'corredica_teles_25',
    canonicalName: 'CORREDIÇA TELES 25',
    patterns: [/corredic.*teles/, /corredic.*25/, /telescop/, /corredic.*light/],
  },
  {
    key: 'corredica_oculta_45',
    canonicalName: 'CORREDIÇA OCULTA 45',
    patterns: [/corredic.*ocult/, /corredic.*45/, /corredic.*soft/, /\bcorredic/],
  },
  {
    key: 'articulador_uno',
    canonicalName: 'Articulador uno Tavares Forte',
    patterns: [/articulador.*uno/, /uno tavares/, /articulador/, /pistao/],
  },
  {
    key: 'perfil_led_rm331',
    canonicalName: 'RM-331 PERFIL DE LED EMB',
    patterns: [/rm\s*331/, /perfil.*led/],
  },
  {
    key: 'fita_led',
    canonicalName: 'FITA LED',
    patterns: [/fita\s*led/, /led\s*12v/],
  },
]

function mapHardwareAlias(rawName) {
  const normalized = normalizeHardwareText(rawName)
  for (const rule of RULES) {
    if (rule.patterns.some((re) => re.test(normalized))) {
      return { key: rule.key, canonicalName: rule.canonicalName, matched: true }
    }
  }
  return { key: 'unknown', canonicalName: rawName, matched: false }
}

const cases = [
  ['Puxador Alça 160mm', 'puxador_alca'],
  ['puxador concha', 'puxador_alca'],
  ['Dobradiça Soft-Close 35mm', 'dobradica_soft_close'],
  ['dobradiça amortecida', 'dobradica_soft_close'],
  ['Dobradiça reta 35', 'dobradica_reta'],
  ['Corrediça telescópica 450mm', 'corredica_teles_25'],
  ['corrediça', 'corredica_oculta_45'],
  ['CORREDIÇA OCULTA 45', 'corredica_oculta_45'],
  ['Articulador Uno Tavares', 'articulador_uno'],
  ['pistão a gás', 'articulador_uno'],
  ['Perfil LED RM-331', 'perfil_led_rm331'],
  ['Fita LED 12V', 'fita_led'],
]

for (const [input, expectedKey] of cases) {
  const got = mapHardwareAlias(input)
  ok(got.key === expectedKey, `${JSON.stringify(input)} → ${got.key}`)
}

const src = readFileSync(join(root, 'src/lib/orcamentos-ia/hardware-alias.ts'), 'utf8')
ok(src.includes('dobradica_soft_close'), 'fonte: dobradica_soft_close')
ok(src.includes('fita_led'), 'fonte: fita_led')
ok(src.includes('DOBRADIÇA RETA SOFT-CLOSE'), 'fonte: canônico Soft-Close')

const pipe = readFileSync(join(root, 'src/lib/orcamentos-ia/pipeline.ts'), 'utf8')
const fetchCount = (pipe.match(/FETCHING_MARKET_PRICES/g) || []).length
ok(fetchCount === 1, `FETCHING_MARKET_PRICES aparece 1× no pipeline (got ${fetchCount})`)
ok(pipe.includes('ready_for_pricing'), 'pipeline espera ready_for_pricing')
ok(pipe.includes('passagem única'), 'mensagem passagem única')
ok(pipe.includes('calculateQuotePricing'), 'calculateQuotePricing presente')

const seed = readFileSync(join(root, 'scripts/seed-hardware-aliases.mjs'), 'utf8')
ok(seed.includes('soft-close') || seed.includes('SOFT-CLOSE'), 'seed SQL/script Soft-Close')
ok(seed.includes('fita led') || seed.includes('FITA LED'), 'seed FITA LED')

if (failed) {
  console.error(`FAILED ${failed}`)
  process.exit(1)
}
console.log('OK all hardware-alias / single-pricing epic4 cases')
