/**
 * Semear inventory_aliases a partir dos SKUs canônicos de obra (hardware-alias.ts).
 * Casa o nome canônico com inventory_items existentes da empresa.
 *
 * Uso:
 *   node --env-file=.env scripts/seed-hardware-aliases.mjs <companyId>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const p = path.join(ROOT, '.env')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}

loadEnv()

const companyId = process.argv[2]
if (!companyId) {
  console.error('Uso: node --env-file=.env scripts/seed-hardware-aliases.mjs <companyId>')
  process.exit(1)
}

const SEEDS = [
  { aliases: ['puxador alca', 'puxador alça', 'puxador perfil', 'PUXADOR ALÇA'], itemLike: '%puxador%al%' },
  { aliases: ['dobradica', 'dobradiça', 'dobradiça reta', 'DOBRADIÇA RETA'], itemLike: '%dobrad%' },
  { aliases: ['corredica oculta', 'corrediça oculta', 'CORREDIÇA OCULTA 45'], itemLike: '%corred%ocult%' },
  { aliases: ['corredica teles', 'corrediça teles', 'CORREDIÇA TELES 25'], itemLike: '%teles%' },
  { aliases: ['cabideiro', 'cabideiro oval', 'CABIDEIRO OVAL'], itemLike: '%cabide%' },
  { aliases: ['articulador', 'articulador uno', 'pistao'], itemLike: '%articul%' },
  { aliases: ['ro82', 'RO82'], itemLike: '%ro%82%' },
  { aliases: ['trilho superior', 'TRILHO SUPERIOR/B'], itemLike: '%trilho%' },
  { aliases: ['rm-331', 'perfil led', 'RM-331 PERFIL DE LED EMB'], itemLike: '%led%' },
]

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL / chave no .env')
  process.exit(1)
}

const sb = createClient(url, key)

function normalizeAlias(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const { data: items, error } = await sb
  .from('inventory_items')
  .select('id, name, category')
  .eq('active', true)
  .or(`company_id.eq.${companyId},company_id.is.null`)
  .limit(2000)

if (error) {
  console.error(error.message)
  process.exit(1)
}

let created = 0
let skipped = 0
for (const seed of SEEDS) {
  const item = (items || []).find((i) =>
    seed.itemLike
      .replace(/%/g, '.*')
      .split('.*')
      .every((part) => !part || new RegExp(part, 'i').test(i.name)),
  )
  if (!item) {
    console.warn('Sem item de estoque para', seed.aliases[0])
    skipped += 1
    continue
  }
  for (const aliasRaw of seed.aliases) {
    const alias_normalized = normalizeAlias(aliasRaw)
    const { error: upErr } = await sb.from('inventory_aliases').upsert(
      {
        company_id: companyId,
        alias_raw: aliasRaw,
        alias_normalized,
        inventory_item_id: item.id,
      },
      { onConflict: 'company_id,alias_normalized' },
    )
    if (upErr) {
      // fallback insert ignore
      const { error: insErr } = await sb.from('inventory_aliases').insert({
        company_id: companyId,
        alias_raw: aliasRaw,
        alias_normalized,
        inventory_item_id: item.id,
      })
      if (insErr && !/duplicate|unique/i.test(insErr.message)) {
        console.warn(insErr.message, aliasRaw)
      } else if (!insErr) created += 1
      else skipped += 1
    } else created += 1
  }
  console.log('OK', seed.aliases[0], '→', item.name)
}

console.log(JSON.stringify({ created, skipped, companyId }))
