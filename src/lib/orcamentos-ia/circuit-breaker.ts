/**
 * Circuit Breaker v12 — impede COMPLETED se o orçamento não estiver saudável.
 *
 * Itens cobráveis (chapa agregada, fita, ferragem, puxador) não podem ficar R$ 0.
 * Linhas `corte-peca` são lista de corte (preço na chapa agregada) e não bloqueiam.
 */
import { z } from 'zod'
import { isCuttingListNote } from '@/lib/orcamentos-ia/pricing'
import {
  countModuleDrawers,
  sumCorredicaPairs,
} from '@/lib/orcamentos-ia/drawer-slides'
import {
  type CoverageReport,
  type DuplicateViewFlag,
  normalizeExtractionKey,
  validatePlausibleQuantities,
} from '@/lib/orcamentos-ia/merge-extraction'
import type { SystemPreferences } from '@/lib/orcamentos-ia/system-preferences'

export const circuitBreakerReportSchema = z.object({
  ok: z.boolean(),
  blockers: z.array(z.string()),
  checked_at: z.string(),
  billable_zero_count: z.number().int().nonnegative(),
  duplicate_view_flags: z.number().int().nonnegative(),
  coverage_missing: z.number().int().nonnegative(),
  sale_price: z.number().nullable(),
  mpc_margin_pct: z.number().nullable(),
  multiplier_n: z.number().nullable(),
})

export type CircuitBreakerReport = z.infer<typeof circuitBreakerReportSchema>

export interface BillableMaterialRow {
  raw_name?: string | null
  category?: string | null
  unit_price?: number | null
  notes?: string | null
  material_name?: string | null
  function?: string | null
  exact_quantity?: number | null
  full_units_quantity?: number | null
}

export interface CircuitBreakerPricingTotals {
  sale_price?: number | null
  materials_cost?: number | null
  cost_price?: number | null
  mpc_margin_pct?: number | null
  multiplier_n?: number | null
  pricing_modality?: string | null
}

const BOX_FUNCTIONS = new Set([
  'lateral',
  'base',
  'fundo',
  'prateleira',
  'divisoria',
  'travessa',
  'sarrafo',
])

const BILLABLE_CATEGORIES = new Set([
  'chapa',
  'fita_borda',
  'ferragem',
  'puxador',
  'consumivel',
])

export function isBoxFunction(fn: string | null | undefined): boolean {
  const key = normalizeExtractionKey(fn || '')
  if (!key) return false
  for (const b of BOX_FUNCTIONS) {
    if (key.includes(b)) return true
  }
  return /lateral|base|fundo|prateleira|divisor|travessa|sarrafo/.test(key)
}

export function isBrancoTxMaterial(name: string | null | undefined): boolean {
  const key = normalizeExtractionKey(name || '')
  return /branco/.test(key) && (/tx/.test(key) || /mdf/.test(key) || key.includes('branco'))
}

export function countBillableZeros(materials: BillableMaterialRow[]): BillableMaterialRow[] {
  return materials.filter((m) => {
    if (isCuttingListNote(m.notes)) return false
    const cat = String(m.category || '')
    if (!BILLABLE_CATEGORIES.has(cat)) return false
    return !(Number(m.unit_price) > 0)
  })
}

/** Caixas internas devem ser MDF Branco TX (default Cortecloud), salvo override explícito. */
export function findNonBrancoBoxPieces(
  extraction: unknown,
  prefs: Pick<SystemPreferences, 'box_thickness_mm'> | null | undefined,
  opts?: { enforceBrancoTx?: boolean },
): string[] {
  if (opts?.enforceBrancoTx === false) return []
  const issues: string[] = []
  if (!extraction || typeof extraction !== 'object') return issues
  const root = extraction as { environments?: unknown[] }
  const envs = Array.isArray(root.environments) ? root.environments : []
  for (const env of envs) {
    if (!env || typeof env !== 'object') continue
    const e = env as { name?: string; modules?: unknown[] }
    for (const mod of e.modules || []) {
      if (!mod || typeof mod !== 'object') continue
      const m = mod as {
        name?: string
        out_of_scope?: boolean
        caixaria?: unknown[]
      }
      if (m.out_of_scope) continue
      for (const piece of m.caixaria || []) {
        if (!piece || typeof piece !== 'object') continue
        const p = piece as {
          name?: string
          function?: string
          material_name?: string
          thickness_mm?: number
        }
        const fn = String(p.function || '')
        if (!isBoxFunction(fn)) continue
        // Fundo fino (3/6) pode ser Branco TX — ainda exige branco
        if (!isBrancoTxMaterial(p.material_name)) {
          issues.push(
            `${e.name || 'Ambiente'} / ${m.name || 'Módulo'} / ${p.name || fn}: material "${p.material_name || '?'}" (esperado MDF Branco TX ${prefs?.box_thickness_mm ?? 15}mm)`,
          )
        }
      }
    }
  }
  return issues
}

export interface EvaluateCircuitBreakerInput {
  extraction: unknown
  materials: BillableMaterialRow[]
  coverage: CoverageReport | null | undefined
  pricing: CircuitBreakerPricingTotals
  prefs?: Pick<SystemPreferences, 'box_thickness_mm'> | null
  duplicateFlags?: DuplicateViewFlag[]
  /** Se false, não exige Branco TX na caixa (override explícito do usuário). */
  enforceBrancoTx?: boolean
  /** Total de páginas do PDF — usado para freio de subcotação. */
  pagesTotal?: number | null
  /** Módulos cobráveis persistidos/extraídos. */
  billableModuleCount?: number | null
  /**
   * Escopo da cobertura: em `batch`, pagesTotal = tamanho do lote
   * e a regra de subcotação por PDF global é ignorada.
   */
  coverageScope?: 'batch' | 'project' | null
}

/** PDF grande com custo/módulos baixos demais → revisão (não “COMPLETED” enganoso). */
const UNDERPRICE_MIN_PAGES = 25
const UNDERPRICE_MIN_BILLABLE_MODULES = 8
const UNDERPRICE_MIN_MATERIALS_COST = 8000

function countBillableModulesInExtraction(extraction: unknown): number {
  if (!extraction || typeof extraction !== 'object') return 0
  const root = extraction as { environments?: unknown[] }
  let n = 0
  for (const env of root.environments || []) {
    if (!env || typeof env !== 'object') continue
    const modules = Array.isArray((env as { modules?: unknown }).modules)
      ? ((env as { modules: unknown[] }).modules)
      : []
    for (const mod of modules) {
      if (!mod || typeof mod !== 'object') continue
      if ((mod as { out_of_scope?: boolean }).out_of_scope === true) continue
      n += 1
    }
  }
  return n
}

/** Conta módulos com gaveta vs pares de corrediça (extração + materiais persistidos). */
export function findDrawerSlideGaps(
  extraction: unknown,
  materials: BillableMaterialRow[],
): { drawerModules: number; drawerCount: number; corredicaPairs: number } {
  let drawerModules = 0
  let drawerCount = 0
  const ferragens: Array<{ raw_name?: string; exact_quantity?: number }> = []

  if (extraction && typeof extraction === 'object') {
    const root = extraction as { environments?: unknown[] }
    for (const env of root.environments || []) {
      if (!env || typeof env !== 'object') continue
      const modules = Array.isArray((env as { modules?: unknown }).modules)
        ? ((env as { modules: unknown[] }).modules)
        : []
      for (const mod of modules) {
        if (!mod || typeof mod !== 'object') continue
        const m = mod as {
          out_of_scope?: boolean
          name?: string
          typology?: string
          drawer_count?: number
          frentes_portas?: unknown[]
          caixaria?: unknown[]
          ferragens?: Array<{ raw_name?: string; exact_quantity?: number }>
        }
        if (m.out_of_scope) continue
        const n = countModuleDrawers({
          name: m.name,
          typology: m.typology,
          drawer_count: m.drawer_count,
          frentes_portas: m.frentes_portas as never,
          caixaria: m.caixaria as never,
        })
        if (n > 0) {
          drawerModules += 1
          drawerCount += n
        }
        for (const f of m.ferragens || []) ferragens.push(f)
      }
    }
  }

  let corredicaPairs = sumCorredicaPairs(ferragens)
  if (corredicaPairs <= 0 && materials?.length) {
    let matPairs = 0
    for (const m of materials) {
      const raw = String(m.raw_name || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
      if (!/corredic|telescop/.test(raw)) continue
      matPairs +=
        Number(m.exact_quantity) ||
        Number(m.full_units_quantity) ||
        1
    }
    corredicaPairs = matPairs
  }

  return { drawerModules, drawerCount, corredicaPairs }
}

const DEFAULT_BOX_MATERIAL = 'MDF Branco TX'

/**
 * Força material de caixote interno para MDF Branco TX + espessura da fábrica.
 * Frentes/portas/gavetas não são alteradas.
 */
export function applyDualMaterialBoxDefaults(
  extraction: unknown,
  boxThicknessMm: number,
): unknown {
  if (!extraction || typeof extraction !== 'object') return extraction
  const root = extraction as Record<string, unknown>
  const envs = Array.isArray(root.environments) ? root.environments : []
  const boxLabel = `${DEFAULT_BOX_MATERIAL} ${boxThicknessMm}mm`

  const nextEnvs = envs.map((env) => {
    if (!env || typeof env !== 'object') return env
    const e = env as Record<string, unknown>
    const modules = Array.isArray(e.modules) ? e.modules : []
    return {
      ...e,
      modules: modules.map((mod) => {
        if (!mod || typeof mod !== 'object') return mod
        const m = mod as Record<string, unknown>
        const caixaria = Array.isArray(m.caixaria) ? m.caixaria : []
        return {
          ...m,
          caixaria: caixaria.map((piece) => {
            if (!piece || typeof piece !== 'object') return piece
            const p = piece as Record<string, unknown>
            const fn = String(p.function || '')
            if (!isBoxFunction(fn)) return p
            // Tampo externo de bancada/mesa pode ser material do projeto — só força laterais/base/fundo/prateleira/divisória/travessa
            const fnKey = normalizeExtractionKey(fn)
            if (fnKey === 'tampo') return p
            return {
              ...p,
              material_name: boxLabel,
              thickness_mm:
                fnKey === 'fundo' && Number(p.thickness_mm) > 0 && Number(p.thickness_mm) <= 6
                  ? Number(p.thickness_mm)
                  : boxThicknessMm,
            }
          }),
        }
      }),
    }
  })

  return { ...root, environments: nextEnvs }
}

export function evaluateCircuitBreaker(
  input: EvaluateCircuitBreakerInput,
): CircuitBreakerReport {
  const blockers: string[] = []
  const zeros = countBillableZeros(input.materials)
  if (zeros.length) {
    blockers.push(
      `${zeros.length} item(ns) cobrável(is) com R$ 0,00 — use alias ou tabela de contingência (using_market_price).`,
    )
  }

  const dupFlags =
    input.duplicateFlags ?? validatePlausibleQuantities(input.extraction)
  if (dupFlags.length) {
    blockers.push(
      `Quantidades implausíveis / fusão de vistas: ${dupFlags
        .slice(0, 3)
        .map((f) => `${f.module} (${f.reason})`)
        .join('; ')}`,
    )
  }

  const sale = Number(input.pricing.sale_price)
  if (!(sale > 0)) {
    blockers.push('sale_price ausente ou zero — margem MPC / multiplicador não gravados.')
  }

  const modality = String(input.pricing.pricing_modality || 'mpc_margin')
  if (modality === 'material_multiplier') {
    const n = Number(input.pricing.multiplier_n)
    if (!(n > 0)) blockers.push('multiplier_n ausente para modalidade ×N.')
  } else {
    const mpc = Number(input.pricing.mpc_margin_pct)
    if (!(mpc >= 0) || Number.isNaN(mpc)) {
      blockers.push('mpc_margin_pct ausente para modalidade MPC%.')
    }
  }

  const cost =
    Number(input.pricing.materials_cost) || Number(input.pricing.cost_price) || 0
  if (!(cost > 0) && sale > 0) {
    blockers.push('cost_price / materials_cost ausente.')
  }

  const boxIssues = findNonBrancoBoxPieces(input.extraction, input.prefs, {
    enforceBrancoTx: input.enforceBrancoTx !== false,
  })
  if (boxIssues.length) {
    blockers.push(
      `Caixote interno fora do padrão Branco TX (${boxIssues.length}): ${boxIssues[0]}`,
    )
  }

  const missing = input.coverage?.missing?.length ?? 0
  if (missing > 0) {
    const sample = (input.coverage?.missing || [])
      .slice(0, 4)
      .map((m) => m.module)
      .join(', ')
    blockers.push(
      `Cobertura incompleta: ${missing} módulo(s) do inventário faltando (${sample}).`,
    )
  }

  // E6: gavetas no BOM sem corrediças → NEEDS_REVIEW
  const drawerSlideGap = findDrawerSlideGaps(input.extraction, input.materials)
  if (drawerSlideGap.drawerModules > 0 && drawerSlideGap.corredicaPairs <= 0) {
    blockers.push(
      `Gavetas sem corrediças: ${drawerSlideGap.drawerModules} módulo(s) com gaveta e 0 corrediças (E4/E6).`,
    )
  }

  // Lote parcial: não comparar módulos/custo com o PDF inteiro da casa.
  const skipGlobalUnderprice = input.coverageScope === 'batch'
  const pages = Number(input.pagesTotal)
  if (
    !skipGlobalUnderprice &&
    Number.isFinite(pages) &&
    pages >= UNDERPRICE_MIN_PAGES
  ) {
    const billable =
      input.billableModuleCount != null
        ? Number(input.billableModuleCount)
        : countBillableModulesInExtraction(input.extraction)
    if (Number.isFinite(billable) && billable < UNDERPRICE_MIN_BILLABLE_MODULES) {
      blockers.push(
        `Subcotação suspeita: só ${billable} módulo(s) cobráveis em PDF de ${pages} páginas (mín. ${UNDERPRICE_MIN_BILLABLE_MODULES}).`,
      )
    }
    if (cost > 0 && cost < UNDERPRICE_MIN_MATERIALS_COST) {
      blockers.push(
        `Custo de materiais R$ ${cost.toFixed(2)} baixo demais para PDF de ${pages} páginas (mín. referência R$ ${UNDERPRICE_MIN_MATERIALS_COST.toLocaleString('pt-BR')}).`,
      )
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
    checked_at: new Date().toISOString(),
    billable_zero_count: zeros.length,
    duplicate_view_flags: dupFlags.length,
    coverage_missing: missing,
    sale_price: Number.isFinite(sale) && sale > 0 ? sale : null,
    mpc_margin_pct:
      input.pricing.mpc_margin_pct != null
        ? Number(input.pricing.mpc_margin_pct)
        : null,
    multiplier_n:
      input.pricing.multiplier_n != null
        ? Number(input.pricing.multiplier_n)
        : null,
  }
}
