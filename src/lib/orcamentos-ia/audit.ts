/**
 * Auditoria com escopo de lote (páginas selecionadas).
 * Evita falso positivo de “móveis faltando” quando o inventário da capa
 * lista a casa inteira, mas o lote só cobre parte das pranchas.
 */
import {
  buildCoverageReport,
  modulesMatchCoverage,
  normalizeExtractionKey,
  type CoverageItem,
  type CoverageReport,
  type InventoryEnv,
} from '@/lib/orcamentos-ia/merge-extraction'
import { normalizeSelectedPages } from '@/lib/orcamentos-ia/pdf-processor'
import { formatPageRanges } from '@/lib/orcamentos-ia/page-ranges'

export type CoverageScope = 'batch' | 'project'

export interface ScopedInventoryResult {
  scopedInventory: InventoryEnv[]
  deferred: CoverageItem[]
  coverageScope: CoverageScope
  selectedPages: number[]
}

type AnyRec = Record<string, unknown>

function asArray(value: unknown): AnyRec[] {
  return Array.isArray(value) ? (value.filter((x) => x && typeof x === 'object') as AnyRec[]) : []
}

function pageOfModule(mod: AnyRec): number | null {
  const bb = mod.bounding_box
  if (bb && typeof bb === 'object' && typeof (bb as AnyRec).page === 'number') {
    const n = Number((bb as AnyRec).page)
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null
  }
  if (typeof mod.page_number === 'number' && mod.page_number >= 1) {
    return Math.floor(mod.page_number)
  }
  return null
}

/** Ambientes/módulos extraídos com evidência de página no lote. */
function extractedItemsOnPages(
  extraction: unknown,
  selected: Set<number>,
): CoverageItem[] {
  const out: CoverageItem[] = []
  if (!extraction || typeof extraction !== 'object') return out
  for (const env of asArray((extraction as AnyRec).environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    for (const mod of asArray(env.modules)) {
      if (mod.out_of_scope === true) continue
      const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const page = pageOfModule(mod)
      // Sem página: assume no lote (veio desta extração parcial).
      if (page == null || selected.has(page)) {
        out.push({ environment: envName, module: modName })
      }
    }
  }
  return out
}

/**
 * Filtra inventário-âncora ao lote.
 * Itens só citados na capa (fora das páginas selecionadas) → deferred (não missing).
 */
export function scopeInventoryToSelectedPages(
  inventory: InventoryEnv[],
  pageNumbers: number[] | null | undefined,
  extraction: unknown,
): ScopedInventoryResult {
  const selectedPages = normalizeSelectedPages(pageNumbers)
  if (!selectedPages.length) {
    return {
      scopedInventory: inventory.map((e) => ({
        environment: e.environment,
        modules: [...e.modules],
      })),
      deferred: [],
      coverageScope: 'project',
      selectedPages: [],
    }
  }

  const selected = new Set(selectedPages)
  const onBatch = extractedItemsOnPages(extraction, selected)
  const deferred: CoverageItem[] = []
  const scoped: InventoryEnv[] = []

  for (const env of inventory) {
    const keep: string[] = []
    for (const mod of env.modules) {
      const matchedOnBatch = onBatch.some(
        (ex) =>
          modulesMatchCoverage(mod, ex.module) &&
          (modulesMatchCoverage(env.environment, ex.environment) ||
            normalizeExtractionKey(env.environment) ===
              normalizeExtractionKey(ex.environment)),
      )
      if (matchedOnBatch) {
        keep.push(mod)
        continue
      }

      // Já extraído em página fora do lote → deferred explícito
      let outsideBatch = false
      if (extraction && typeof extraction === 'object') {
        for (const e of asArray((extraction as AnyRec).environments)) {
          const envName = typeof e.name === 'string' ? e.name : ''
          for (const m of asArray(e.modules)) {
            const modName = typeof m.name === 'string' ? m.name : ''
            const page = pageOfModule(m)
            if (
              page != null &&
              !selected.has(page) &&
              modulesMatchCoverage(mod, modName) &&
              (modulesMatchCoverage(env.environment, envName) ||
                normalizeExtractionKey(env.environment) ===
                  normalizeExtractionKey(envName))
            ) {
              outsideBatch = true
            }
          }
        }
      }

      if (outsideBatch) {
        deferred.push({ environment: env.environment, module: mod })
        continue
      }

      // Inventário da capa sem evidência neste lote → não exige self-heal
      deferred.push({ environment: env.environment, module: mod })
    }
    if (keep.length) {
      scoped.push({ environment: env.environment, modules: keep })
    }
  }

  // Garante que tudo já extraído no lote entre no esperado (mesmo se inventário omitiu)
  for (const item of onBatch) {
    const env = scoped.find(
      (e) =>
        modulesMatchCoverage(e.environment, item.environment) ||
        normalizeExtractionKey(e.environment) ===
          normalizeExtractionKey(item.environment),
    )
    if (env) {
      if (!env.modules.some((m) => modulesMatchCoverage(m, item.module))) {
        env.modules.push(item.module)
      }
    } else {
      scoped.push({ environment: item.environment, modules: [item.module] })
    }
  }

  return {
    scopedInventory: scoped,
    deferred,
    coverageScope: 'batch',
    selectedPages,
  }
}

export function buildScopedCoverageReport(
  inventory: InventoryEnv[],
  extraction: unknown,
  pageNumbers: number[] | null | undefined,
): CoverageReport & { deferred: CoverageItem[]; coverage_scope: CoverageScope } {
  const scoped = scopeInventoryToSelectedPages(inventory, pageNumbers, extraction)
  const report = buildCoverageReport(scoped.scopedInventory, extraction)
  return {
    ...report,
    deferred: scoped.deferred,
    coverage_scope: scoped.coverageScope,
  }
}

/** Addendum injetado no system do auditor (cliente + Edge). */
export function scopedAuditorPromptAddendum(
  selectedPages: number[] | null | undefined,
  pageCount?: number | null,
): string {
  const pages = normalizeSelectedPages(selectedPages)
  if (!pages.length) return ''
  const label = formatPageRanges(pages)
  const totalHint =
    typeof pageCount === 'number' && pageCount > pages.length
      ? ` (PDF tem ${pageCount} páginas; este lote cobre só ${pages.length})`
      : ''
  return `

═══ ESCOPO DO LOTE (OBRIGATÓRIO) ═══
Avalie APENAS as pranchas/páginas ${label}${totalHint}.
PROIBIDO exigir, completar ou marcar como faltante móveis de ambientes/páginas fora desta seleção
(ex.: suíte/quarto citados só na capa/índice, mas sem imagem neste lote).
Itens fora do lote ficam para outro lote — não invente BOM nem force cobertura da casa inteira.
selected_pages=[${pages.join(', ')}]`
}

/**
 * Em escopo batch, missing fora do lote não deve alimentar circuit breaker / NEEDS_REVIEW.
 * Com cobertura já scoped, missing.length já é só do lote; deferred nunca bloqueia.
 */
export function shouldBlockOnCoverageMissing(scope: {
  coverageScope?: CoverageScope | null
  missingCount?: number
  deferredCount?: number
}): boolean {
  const missing = Number(scope.missingCount) || 0
  if (missing <= 0) return false
  // deferred nunca bloqueia (mesmo se alguém passar missing global por engano)
  if (scope.coverageScope === 'batch') {
    return missing > 0
  }
  return missing > 0
}

/** Remove da árvore módulos com página explícita fora do lote (antes de persistir). */
export function filterExtractionToSelectedPages(
  extraction: unknown,
  pageNumbers: number[] | null | undefined,
): unknown {
  const selected = normalizeSelectedPages(pageNumbers)
  if (!selected.length || !extraction || typeof extraction !== 'object') return extraction
  const set = new Set(selected)
  const root = extraction as AnyRec
  const environments = asArray(root.environments)
    .map((env) => {
      const modules = asArray(env.modules).filter((mod) => {
        const page = pageOfModule(mod)
        if (page == null) return true
        return set.has(page)
      })
      if (!modules.length) return null
      return { ...env, modules }
    })
    .filter(Boolean)
  return { ...root, environments }
}
