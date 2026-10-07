/**
 * Sincroniza o catálogo Markup (JSON exportado) → Orçamentos IA:
 * inventory_items + market_reference_prices + inventory_aliases.
 *
 * Uso:
 *   node --env-file=.env scripts/sync-markup-catalog-to-orcamentos-ia.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CATALOG_PATH = join(__dirname, 'data', 'markup-catalog-garbo-2026-10-06.json')
const GARBO_EMPRESA_ID = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'
const SHEET_AREA_M2 = 5.0875
const ROLL_METERS_DEFAULT = 50

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\bchapa[-_]?\w*\b/g, ' ')
    .replace(/\b(cod|sku|ref)[-.]?\w*\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseThicknessMm(variation) {
  if (!variation) return null
  const m = String(variation).match(/(\d+(?:[.,]\d+)?)\s*mm/i)
  if (m) return Number(m[1].replace(',', '.'))
  const bare = String(variation).trim()
  if (/^(6|15|18|25)$/.test(bare)) return Number(bare)
  return null
}

function displayName(item) {
  const base = String(item.name || '').trim()
  const v = item.variation != null ? String(item.variation).trim() : ''
  if (!v) return base
  if (item.category === 'chapa') {
    const thick = parseThicknessMm(v)
    return thick != null ? `${base} · ${thick}mm` : `${base} · ${v}`
  }
  return `${base} · ${v}`
}

function resolveUnitPrice(item, rollMeters) {
  const price = Number(item.price)
  if (!Number.isFinite(price) || price <= 0) return null

  if (item.category === 'chapa') {
    return {
      unit: 'chapa',
      unit_price: price,
      price_per_sheet: price,
      price_per_m2: Math.round((price / SHEET_AREA_M2) * 100) / 100,
      thickness_mm: parseThicknessMm(item.variation),
      sheet_area_m2: SHEET_AREA_M2,
      loss_pct: 15,
      metadata: {
        source: 'markup_catalog_2026_10_06',
        markup_group: item.group,
        markup_unit: item.unit,
      },
    }
  }

  if (item.category === 'fita_borda') {
    const meters = rollMeters
    const perMeter = Math.round((price / meters) * 100) / 100
    return {
      unit: 'm',
      unit_price: perMeter,
      price_per_sheet: null,
      price_per_m2: null,
      thickness_mm: null,
      sheet_area_m2: null,
      loss_pct: 0,
      metadata: {
        source: 'markup_catalog_2026_10_06',
        markup_group: item.group,
        markup_unit: item.unit,
        roll_meters: meters,
        price_per_roll: price,
        edge_width_mm: Number(item.variation) || null,
      },
    }
  }

  // Ferragens / consumíveis: sempre preço unitário
  let unitPrice = price
  let packSize = item.packSize != null ? Number(item.packSize) : null
  if ((item.unit === 'pct' || item.unit === 'pcte') && Number.isFinite(packSize) && packSize > 0) {
    unitPrice = Math.round((price / packSize) * 100) / 100
  } else if (item.unit === 'pct' && !packSize) {
    // fallback pacote 100 un (Minifix / cavilha padrão)
    packSize = 100
    unitPrice = Math.round((price / packSize) * 100) / 100
  }

  return {
    unit: 'un',
    unit_price: unitPrice,
    price_per_sheet: null,
    price_per_m2: null,
    thickness_mm: parseThicknessMm(item.variation),
    sheet_area_m2: null,
    loss_pct: 0,
    metadata: {
      source: 'markup_catalog_2026_10_06',
      markup_group: item.group,
      markup_unit: item.unit,
      ...(packSize ? { pack_size: packSize, price_per_pack: price } : {}),
    },
  }
}

function findExisting(byNormName, name) {
  const key = normalizeName(name)
  return byNormName.get(key) || null
}

async function loadInventory() {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(
      'id, company_id, category, name, unit, unit_price, price_per_m2, price_per_sheet, thickness_mm, metadata, active',
    )
    .or(`company_id.eq.${GARBO_EMPRESA_ID},company_id.is.null`)
    .limit(2000)

  if (error) throw new Error(`inventory_items: ${error.message}`)
  return data || []
}

async function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
  const rollMeters = Number(catalog.rollMetersDefault) || ROLL_METERS_DEFAULT
  const items = (catalog.items || []).filter((i) => Number(i.price) > 0)
  const aliases = catalog.aliases || []

  console.log(`Catálogo: ${items.length} itens ativos com preço > 0`)
  console.log(`Apelidos De-Para: ${aliases.length}`)

  const existing = await loadInventory()
  const byNormName = new Map()
  for (const row of existing) {
    byNormName.set(normalizeName(row.name), row)
  }

  const summary = {
    inventoryCreated: 0,
    inventoryUpdated: 0,
    inventorySkipped: 0,
    marketUpserted: 0,
    marketErrors: 0,
    aliasesCreated: 0,
    aliasesUpdated: 0,
    aliasesSkipped: 0,
    errors: [],
  }

  /** @type {Map<string, string>} nome display → id */
  const nameToId = new Map()

  for (const item of items) {
    const name = displayName(item)
    const resolved = resolveUnitPrice(item, rollMeters)
    if (!resolved) {
      summary.inventorySkipped += 1
      continue
    }

    const payload = {
      company_id: null,
      category: item.category,
      name,
      unit: resolved.unit,
      unit_price: resolved.unit_price,
      price_per_m2: resolved.price_per_m2,
      price_per_sheet: resolved.price_per_sheet,
      thickness_mm: resolved.thickness_mm,
      sheet_area_m2: resolved.sheet_area_m2,
      loss_pct: resolved.loss_pct,
      active: true,
      metadata: resolved.metadata,
      updated_at: new Date().toISOString(),
    }

    const found = findExisting(byNormName, name)
    if (found) {
      const { error } = await supabase.from('inventory_items').update(payload).eq('id', found.id)
      if (error) {
        summary.errors.push(`update ${name}: ${error.message}`)
        continue
      }
      nameToId.set(name, found.id)
      byNormName.set(normalizeName(name), { ...found, ...payload, id: found.id })
      summary.inventoryUpdated += 1
    } else {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert(payload)
        .select('id, name')
        .single()
      if (error) {
        summary.errors.push(`insert ${name}: ${error.message}`)
        continue
      }
      nameToId.set(name, data.id)
      byNormName.set(normalizeName(name), { id: data.id, name, ...payload })
      summary.inventoryCreated += 1
    }

    // market_reference_prices — padrão = nome do item (match fuzzy no resolver)
    const marketPrice =
      item.category === 'chapa'
        ? resolved.price_per_sheet
        : resolved.unit_price

    const marketRow = {
      category: item.category,
      item_pattern: name,
      unit: resolved.unit,
      estimated_market_price: marketPrice,
      notes: `Sync Markup ${catalog.generatedAt || '2026-10-06'}`,
      updated_at: new Date().toISOString(),
    }

    const { error: marketErr } = await supabase
      .from('market_reference_prices')
      .upsert(marketRow, { onConflict: 'category,item_pattern' })

    if (marketErr) {
      // fallback: update by pattern if unique index name differs
      const { data: existingMarket } = await supabase
        .from('market_reference_prices')
        .select('id')
        .eq('category', item.category)
        .eq('item_pattern', name)
        .maybeSingle()

      if (existingMarket?.id) {
        const { error: upErr } = await supabase
          .from('market_reference_prices')
          .update({
            unit: marketRow.unit,
            estimated_market_price: marketRow.estimated_market_price,
            notes: marketRow.notes,
            updated_at: marketRow.updated_at,
          })
          .eq('id', existingMarket.id)
        if (upErr) {
          summary.marketErrors += 1
          summary.errors.push(`market ${name}: ${upErr.message}`)
        } else {
          summary.marketUpserted += 1
        }
      } else {
        const { error: insErr } = await supabase.from('market_reference_prices').insert(marketRow)
        if (insErr) {
          summary.marketErrors += 1
          summary.errors.push(`market ${name}: ${insErr.message}`)
        } else {
          summary.marketUpserted += 1
        }
      }
    } else {
      summary.marketUpserted += 1
    }
  }

  // Aliases De-Para
  for (const a of aliases) {
    const targetName = String(a.targetName || '').trim()
    const aliasRaw = String(a.alias || '').trim()
    if (!targetName || !aliasRaw) {
      summary.aliasesSkipped += 1
      continue
    }

    let itemId = nameToId.get(targetName)
    if (!itemId) {
      const found = findExisting(byNormName, targetName)
      itemId = found?.id
    }
    if (!itemId) {
      summary.aliasesSkipped += 1
      summary.errors.push(`alias sem alvo: "${aliasRaw}" → "${targetName}"`)
      continue
    }

    const aliasNormalized = normalizeName(aliasRaw)
    const row = {
      company_id: GARBO_EMPRESA_ID,
      alias_raw: aliasRaw,
      alias_normalized: aliasNormalized,
      inventory_item_id: itemId,
      updated_at: new Date().toISOString(),
    }

    const { data: existingAlias } = await supabase
      .from('inventory_aliases')
      .select('id')
      .eq('company_id', GARBO_EMPRESA_ID)
      .eq('alias_normalized', aliasNormalized)
      .maybeSingle()

    if (existingAlias?.id) {
      const { error } = await supabase
        .from('inventory_aliases')
        .update({
          alias_raw: row.alias_raw,
          inventory_item_id: row.inventory_item_id,
          updated_at: row.updated_at,
        })
        .eq('id', existingAlias.id)
      if (error) {
        summary.errors.push(`alias update ${aliasRaw}: ${error.message}`)
      } else {
        summary.aliasesUpdated += 1
      }
    } else {
      const { error } = await supabase.from('inventory_aliases').insert(row)
      if (error) {
        summary.errors.push(`alias insert ${aliasRaw}: ${error.message}`)
      } else {
        summary.aliasesCreated += 1
      }
    }
  }

  console.log('\n=== Resumo sync Markup → Orçamentos IA ===')
  console.log(`Estoque criado:     ${summary.inventoryCreated}`)
  console.log(`Estoque atualizado: ${summary.inventoryUpdated}`)
  console.log(`Estoque ignorado:   ${summary.inventorySkipped}`)
  console.log(`Mercado upsert:     ${summary.marketUpserted} (erros: ${summary.marketErrors})`)
  console.log(`Aliases criados:    ${summary.aliasesCreated}`)
  console.log(`Aliases atualizados:${summary.aliasesUpdated}`)
  console.log(`Aliases ignorados:  ${summary.aliasesSkipped}`)
  if (summary.errors.length) {
    console.log(`\nAvisos (${summary.errors.length}):`)
    for (const e of summary.errors.slice(0, 40)) console.log(`  - ${e}`)
    if (summary.errors.length > 40) console.log(`  … +${summary.errors.length - 40}`)
  }
  console.log('\nPronto. Abra Tabela de Preços & Estoque para validar.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
