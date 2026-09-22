import { supabase } from '@/lib/supabase'

export type InventoryCategory =
  | 'chapa'
  | 'fita_borda'
  | 'ferragem'
  | 'puxador'
  | 'consumivel'
  | 'servico'
  | 'mao_obra'
  | 'outro'

export const INVENTORY_CATEGORY_LABEL: Record<InventoryCategory, string> = {
  chapa: 'Chapas de MDF',
  fita_borda: 'Fitas de Borda',
  ferragem: 'Ferragens & Acessórios',
  puxador: 'Puxadores Perfil',
  consumivel: 'Consumíveis',
  servico: 'Serviços Avulsos',
  mao_obra: 'Mão de Obra',
  outro: 'Outros',
}

export interface InventoryItem {
  id: string
  company_id: string | null
  category: InventoryCategory
  name: string
  sku: string | null
  unit: string
  unit_price: number | null
  price_per_m2: number | null
  price_per_sheet: number | null
  sheet_area_m2: number | null
  thickness_mm: number | null
  width_mm: number | null
  length_mm: number | null
  loss_pct: number | null
  active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

const SELECT_COLS =
  'id, company_id, category, name, sku, unit, unit_price, price_per_m2, price_per_sheet, sheet_area_m2, thickness_mm, width_mm, length_mm, loss_pct, active, metadata, created_at, updated_at'

export interface GetInventoryItemsParams {
  companyId?: string | null
  category?: InventoryCategory | 'all'
  includeInactive?: boolean
}

/** Lista insumos globais (company_id null) + da empresa. */
export async function getInventoryItems(
  params: GetInventoryItemsParams = {},
): Promise<{ data: InventoryItem[]; error?: string }> {
  let query = supabase.from('inventory_items').select(SELECT_COLS).order('name', { ascending: true })

  if (!params.includeInactive) {
    query = query.eq('active', true)
  }

  if (params.category && params.category !== 'all') {
    query = query.eq('category', params.category)
  }

  if (params.companyId) {
    query = query.or(`company_id.eq.${params.companyId},company_id.is.null`)
  } else {
    query = query.is('company_id', null)
  }

  const { data, error } = await query.limit(500)
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as InventoryItem[] }
}

export type InventoryItemPatch = Partial<{
  name: string
  sku: string | null
  unit: string
  unit_price: number | null
  price_per_m2: number | null
  price_per_sheet: number | null
  sheet_area_m2: number | null
  thickness_mm: number | null
  width_mm: number | null
  length_mm: number | null
  loss_pct: number | null
  active: boolean
  metadata: Record<string, unknown>
  category: InventoryCategory
}>

export async function updateInventoryItem(
  id: string,
  patch: InventoryItemPatch,
): Promise<{ data: InventoryItem | null; error?: string }> {
  const { data, error } = await supabase
    .from('inventory_items')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(SELECT_COLS)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as InventoryItem }
}

/** Salva várias alterações (edição em lote). */
export async function updateInventoryItemsBatch(
  updates: Array<{ id: string; patch: InventoryItemPatch }>,
): Promise<{ error?: string; saved: number }> {
  let saved = 0
  for (const u of updates) {
    const { error } = await updateInventoryItem(u.id, u.patch)
    if (error) return { error, saved }
    saved += 1
  }
  return { saved }
}

export interface CreateInventoryItemParams {
  companyId?: string | null
  category: InventoryCategory
  name: string
  sku?: string | null
  unit?: string
  unit_price?: number | null
  price_per_m2?: number | null
  price_per_sheet?: number | null
  sheet_area_m2?: number | null
  loss_pct?: number | null
  metadata?: Record<string, unknown>
}

export async function createInventoryItem(
  params: CreateInventoryItemParams,
): Promise<{ data: InventoryItem | null; error?: string }> {
  const unitDefault =
    params.unit ??
    (params.category === 'chapa'
      ? 'chapa'
      : params.category === 'fita_borda'
        ? 'm'
        : params.category === 'puxador'
          ? 'barra'
          : 'un')

  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      company_id: params.companyId ?? null,
      category: params.category,
      name: params.name.trim(),
      sku: params.sku?.trim() || null,
      unit: unitDefault,
      unit_price: params.unit_price ?? null,
      price_per_m2: params.price_per_m2 ?? null,
      price_per_sheet: params.price_per_sheet ?? null,
      sheet_area_m2: params.sheet_area_m2 ?? (params.category === 'chapa' ? 5.06 : null),
      loss_pct: params.loss_pct ?? (params.category === 'chapa' ? 15 : 0),
      metadata: params.metadata ?? {},
      active: true,
    })
    .select(SELECT_COLS)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as InventoryItem }
}

export function getRollMeters(item: InventoryItem): number | null {
  const raw = item.metadata?.roll_meters
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Normaliza apelido para match De-Para (mesmo critério do pricing). */
export function normalizeAlias(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\bchapa[-_]?\w*\b/g, ' ')
    .replace(/\b(cod|sku|ref)[-.]?\w*\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface InventoryAlias {
  id: string
  company_id: string
  alias_raw: string
  alias_normalized: string
  inventory_item_id: string
  created_at: string
  updated_at: string
  inventory_items?: Pick<InventoryItem, 'id' | 'name' | 'category' | 'unit'> | null
}

const ALIAS_SELECT =
  'id, company_id, alias_raw, alias_normalized, inventory_item_id, created_at, updated_at, inventory_items(id, name, category, unit)'

export async function getInventoryAliases(
  companyId: string,
): Promise<{ data: InventoryAlias[]; error?: string }> {
  if (!companyId) return { data: [], error: 'Empresa não identificada.' }
  const { data, error } = await supabase
    .from('inventory_aliases')
    .select(ALIAS_SELECT)
    .eq('company_id', companyId)
    .order('alias_raw', { ascending: true })
    .limit(500)
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as InventoryAlias[] }
}

export async function createInventoryAlias(params: {
  companyId: string
  aliasRaw: string
  inventoryItemId: string
}): Promise<{ data: InventoryAlias | null; error?: string }> {
  const aliasRaw = params.aliasRaw.trim()
  const aliasNormalized = normalizeAlias(aliasRaw)
  if (!aliasRaw || !aliasNormalized) return { data: null, error: 'Informe o apelido.' }
  if (!params.inventoryItemId) return { data: null, error: 'Selecione o item do estoque.' }

  const { data, error } = await supabase
    .from('inventory_aliases')
    .insert({
      company_id: params.companyId,
      alias_raw: aliasRaw,
      alias_normalized: aliasNormalized,
      inventory_item_id: params.inventoryItemId,
    })
    .select(ALIAS_SELECT)
    .single()

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: 'Já existe um apelido igual para esta empresa.' }
    }
    return { data: null, error: error.message }
  }
  return { data: data as InventoryAlias }
}

export async function deleteInventoryAlias(
  id: string,
): Promise<{ error?: string }> {
  const { error } = await supabase.from('inventory_aliases').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}
