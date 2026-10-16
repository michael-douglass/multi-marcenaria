import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import {
  explodeFromExtractionModule,
  type BomLine,
  type ExplodeResult,
} from '@/lib/orcamentos-ia/bom-engine'
import type { SystemPreferences } from '@/lib/orcamentos-ia/system-preferences'

export const bomItemRowSchema = z.object({
  item_category: z.enum(['board', 'edgeband', 'hardware', 'fastener', 'labor', 'other']),
  item_description: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit_of_measure: z.enum(['m2', 'm', 'unit', 'pair', 'bar', 'sheet', 'roll']),
  unit_cost: z.number().nonnegative(),
})

export function bomLinesToRows(
  analysisId: string,
  moduleId: string,
  bom: BomLine[],
): Array<Record<string, unknown>> {
  return bom.map((line) => ({
    // FK → quote_analyses.id (coluna historicamente nomeada project_id)
    project_id: analysisId,
    module_id: moduleId,
    item_category: line.item_category,
    item_description: line.item_description.slice(0, 255),
    quantity: line.quantity,
    unit_of_measure: line.unit_of_measure,
    unit_cost: line.unit_cost,
    metadata: line.metadata ?? {},
  }))
}

export function validateBomLines(bom: BomLine[]): { ok: boolean; issues: string[] } {
  const issues: string[] = []
  for (const [i, line] of bom.entries()) {
    const parsed = bomItemRowSchema.safeParse(line)
    if (!parsed.success) {
      issues.push(`bom[${i}]: ${parsed.error.issues.map((x) => x.message).join('; ')}`)
    }
  }
  return { ok: issues.length === 0, issues }
}

/**
 * Limpa BOM da análise.
 * Nota: a coluna no Postgres chama-se `project_id`, mas o FK aponta para
 * `quote_analyses.id` (nome herdado da migration v11 — não é quote_projects).
 */
export async function clearBomItemsForProject(analysisId: string): Promise<void> {
  await supabase.from('bom_items').delete().eq('project_id', analysisId)
}

export async function insertBomItems(
  analysisId: string,
  moduleId: string,
  bom: BomLine[],
): Promise<{ error: string | null; count: number }> {
  const rows = bomLinesToRows(analysisId, moduleId, bom)
  if (!rows.length) return { error: null, count: 0 }
  const { error } = await supabase.from('bom_items').insert(rows)
  return { error: error?.message ?? null, count: rows.length }
}

export async function listBomItemsForProject(analysisId: string): Promise<{
  data: BomLine[]
  byModule: Map<string, BomLine[]>
  error: string | null
}> {
  const { data, error } = await supabase
    .from('bom_items')
    .select('module_id, item_category, item_description, quantity, unit_of_measure, unit_cost, metadata')
    .eq('project_id', analysisId)

  if (error) return { data: [], byModule: new Map(), error: error.message }

  const byModule = new Map<string, BomLine[]>()
  const lines: BomLine[] = []
  for (const row of data ?? []) {
    const line: BomLine = {
      item_category: row.item_category as BomLine['item_category'],
      item_description: row.item_description,
      quantity: Number(row.quantity) || 0,
      unit_of_measure: row.unit_of_measure as BomLine['unit_of_measure'],
      unit_cost: Number(row.unit_cost) || 0,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    }
    lines.push(line)
    const mid = String(row.module_id)
    const list = byModule.get(mid) ?? []
    list.push(line)
    byModule.set(mid, list)
  }
  return { data: lines, byModule, error: null }
}

/** Espelha linhas BOM → quote_materials (categorias legadas). */
export function bomLineToQuoteMaterial(
  moduleId: string,
  line: BomLine,
): Record<string, unknown> {
  const category =
    line.item_category === 'board'
      ? 'chapa'
      : line.item_category === 'edgeband'
        ? 'fita_borda'
        : line.item_category === 'hardware' || line.item_category === 'fastener'
          ? line.item_description.toLowerCase().includes('puxador')
            ? 'puxador'
            : 'ferragem'
          : 'outro'

  const unit =
    line.unit_of_measure === 'm2'
      ? 'm2'
      : line.unit_of_measure === 'm'
        ? 'm'
        : line.unit_of_measure === 'bar'
          ? 'barra'
          : line.unit_of_measure === 'sheet'
            ? 'chapa'
            : 'un'

  return {
    module_id: moduleId,
    raw_name: line.item_description,
    category,
    system_material_id: null,
    using_market_price: false,
    market_price_confirmed: false,
    unit_price: line.unit_cost,
    exact_quantity: line.quantity,
    full_units_quantity: Math.ceil(line.quantity),
    unit_measure: unit,
    notes: 'bom-engine v11',
  }
}

export function explodeModuleForPersist(
  mod: {
    name: string
    typology?: string | null
    dimensions?: { width_mm?: number | null; height_mm?: number | null; depth_mm?: number | null }
    caixaria?: Array<{ function?: string | null }>
    frentes_portas?: Array<{ kind?: string | null }>
    door_count?: number | null
    drawer_count?: number | null
    shelf_count?: number | null
    sliding_doors?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | null
    column_widths_mm?: number[] | null
    doubled_top?: boolean | null
    top_shelf?: boolean | null
    handle_recess_mm?: 0 | 20 | 40 | null
    door_overhang_mm?: number | null
    sliding_envelope?: boolean | null
    room_tag?: string | null
  },
  prefs: Partial<SystemPreferences> | null,
  roomTag?: string,
): ExplodeResult {
  // Sempre propaga tipologias/campos v11 (não re-inferir só pelo nome)
  return explodeFromExtractionModule(
    {
      ...mod,
      room_tag: mod.room_tag ?? roomTag ?? undefined,
    },
    prefs,
  )
}
