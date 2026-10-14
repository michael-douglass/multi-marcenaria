/**
 * Rebalanceamento de ambientes — lock de dormitório (paridade HelloMob Quarto).
 * Nunca migra mesa de cabeceira / painel TV / cabeceira / guarda-roupa para Cozinha fantasma.
 */

export type AnyRec = Record<string, unknown>

export interface InventoryEnvLite {
  environment: string
  modules?: string[]
}

function asArray(value: unknown): AnyRec[] {
  if (!Array.isArray(value)) return []
  return value.filter((x) => x && typeof x === 'object') as AnyRec[]
}

export function normalizeRebalanceKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const BEDROOM_ENV_RE = /quarto|suite|dormitorio|closet|suite/
const SOCIAL_ENV_RE = /gourmet|cozinha|lavabo|lavanderia|jantar|area\s*gourmet|espaco\s*gourmet/
/** Tipologias de quarto — NUNCA forçar Cozinha/Gourmet. */
const BEDROOM_PROTECTED_RE =
  /mesa\s*de\s*cabeceira|criado.?mudo|\bcriado\b|cabeceira|painel\s*tv|painel\s*ripad|painel\s*liso|painel\s*avulso|^painel$|guarda.?roupa|roupeiro|aparador|divisoria|divisória|nicho|vista\s*vertical|gaveteiro/
const BEDROOM_ONLY_REMOVE_RE = /guarda.?roupa|roupeiro|cabeceira|criado.?mudo/

function moduleDims(mod: AnyRec): { h: number; d: number; w: number } {
  const dims =
    mod.dimensions && typeof mod.dimensions === 'object' ? (mod.dimensions as AnyRec) : null
  return {
    h: Number(dims?.height_mm) || 0,
    d: Number(dims?.depth_mm) || 0,
    w: Number(dims?.width_mm) || 0,
  }
}

function isDiningTableHint(nameKey: string, descKey: string, h: number, d: number, w: number): boolean {
  const blob = `${nameKey} ${descKey}`
  if (/jantar|belize|organico|escrivaninha|tampo organico|mesa de jantar/.test(blob)) return true
  if (h >= 700 && h <= 820 && (d >= 900 || w >= 2400)) return true
  return false
}

function fixWrongBancadaLabel(
  modName: string,
  descKey: string,
  h: number,
  d: number,
  w: number,
): string | null {
  const nameKey = normalizeRebalanceKey(modName)
  if (!/bancada/.test(nameKey)) return null
  if (/lavabo|pia|cooktop|ilha|churras|balcao/.test(`${nameKey} ${descKey}`)) return null
  if (isDiningTableHint(nameKey, descKey, h, d, w) || /mesa|jantar|belize|organico/.test(descKey)) {
    return modName.replace(/bancada/gi, 'Mesa')
  }
  return null
}

export function isBedroomEnvironment(name: string): boolean {
  return BEDROOM_ENV_RE.test(normalizeRebalanceKey(name))
}

export function isBedroomProtectedModule(name: string, description = ''): boolean {
  return BEDROOM_PROTECTED_RE.test(normalizeRebalanceKey(`${name} ${description}`))
}

function findBedroomEnvName(
  environments: AnyRec[],
  inventory?: InventoryEnvLite[] | null,
): string | null {
  for (const env of environments) {
    const n = typeof env.name === 'string' ? env.name : ''
    if (isBedroomEnvironment(n)) return n
  }
  for (const inv of inventory || []) {
    if (isBedroomEnvironment(inv.environment)) return inv.environment
  }
  return null
}

function projectLooksBedroom(environments: AnyRec[], inventory?: InventoryEnvLite[] | null): boolean {
  if (findBedroomEnvName(environments, inventory)) return true
  for (const env of environments) {
    for (const mod of asArray(env.modules)) {
      const name = typeof mod.name === 'string' ? mod.name : ''
      if (isBedroomProtectedModule(name, String(mod.description || ''))) return true
    }
  }
  return false
}

/**
 * Separa Lavabo; funde Cozinha+Gourmet; preserva Quarto/Suíte (lock dormitório).
 * @param inventory opcional — ajuda a repatriar módulos protegidos para o Quarto do inventário.
 */
export function rebalanceEnvironments(
  extraction: unknown,
  inventory?: InventoryEnvLite[] | null,
): unknown {
  if (!extraction || typeof extraction !== 'object') return extraction
  const root = extraction as AnyRec
  const notes: string[] = Array.isArray(root.auditor_notes)
    ? [...(root.auditor_notes as string[])]
    : []
  const buckets = new Map<string, { name: string; modules: AnyRec[] }>()

  const put = (envName: string, mod: AnyRec) => {
    const key = normalizeRebalanceKey(envName)
    const prev = buckets.get(key)
    const modKey = normalizeRebalanceKey(typeof mod.name === 'string' ? mod.name : 'Modulo')
    if (!prev) {
      buckets.set(key, { name: envName, modules: [mod] })
      return
    }
    const existing = prev.modules.findIndex(
      (m) => normalizeRebalanceKey(typeof m.name === 'string' ? m.name : '') === modKey,
    )
    if (existing >= 0) prev.modules[existing] = { ...prev.modules[existing], ...mod }
    else prev.modules.push(mod)
    if (envName.length > prev.name.length) prev.name = envName
  }

  const envsIn = asArray(root.environments)
  const isBedroomProject = projectLooksBedroom(envsIn, inventory)
  const bedroomAnchor = findBedroomEnvName(envsIn, inventory) || 'Quarto Suíte'

  const hasGourmetLabel = envsIn.some((e) =>
    /gourmet/.test(normalizeRebalanceKey(typeof e.name === 'string' ? e.name : '')),
  )
  const defaultSocial = hasGourmetLabel ? 'Espaço Gourmet' : 'Cozinha'

  for (const env of envsIn) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    const envKey = normalizeRebalanceKey(envName)
    const envIsBedroom = isBedroomEnvironment(envName)

    for (const mod of asArray(env.modules)) {
      let modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const descKey = normalizeRebalanceKey(
        typeof mod.description === 'string' ? mod.description : '',
      )
      let nameKey = normalizeRebalanceKey(modName)
      const blob = `${nameKey} ${descKey}`
      const { h, d, w } = moduleDims(mod)
      const protectedMod = isBedroomProtectedModule(modName, String(mod.description || ''))

      const fixed = fixWrongBancadaLabel(modName, descKey, h, d, w)
      if (fixed) {
        notes.push(`Renomeado "${modName}" → "${fixed}" (mesa de jantar, não bancada).`)
        modName = fixed
        nameKey = normalizeRebalanceKey(modName)
      }

      // Tipologia de quarto em ambiente social genérico SEM projeto dormitório → remove alucinação
      if (
        !isBedroomProject &&
        BEDROOM_ONLY_REMOVE_RE.test(nameKey) &&
        SOCIAL_ENV_RE.test(envKey) &&
        !envIsBedroom
      ) {
        notes.push(`Removido "${modName}" de "${envName}": tipologia de quarto sem evidência.`)
        continue
      }

      const isKitchenFurniture =
        /cooktop|churras|ilha|geladeira|cristaleira|forno|fogao|fogão|gourmet|adega|microondas/.test(
          blob,
        ) || (/bancada/.test(nameKey) && /pia|cooktop|churras/.test(blob))
      const isLavabo = /lavabo/.test(blob) || (/lavabo/.test(envKey) && !isKitchenFurniture)
      const isLavanderia = /lavanderia|tanque|maquina de lavar|máquina de lavar/.test(blob)

      let target: string

      // LOCK DORMITÓRIO: ambiente quarto ou módulo protegido nunca vai para Cozinha
      if (envIsBedroom || (isBedroomProject && protectedMod)) {
        if (SOCIAL_ENV_RE.test(envKey) && !envIsBedroom && protectedMod) {
          target = bedroomAnchor
          notes.push(`Repatriado "${modName}" de "${envName}" → "${target}" (lock dormitório).`)
        } else {
          target = envIsBedroom ? envName : bedroomAnchor
        }
      } else if (isLavabo && !isKitchenFurniture) {
        target = 'Lavabo'
        if (!/lavabo/.test(nameKey)) {
          modName = /bancada/.test(nameKey) ? 'Bancada Lavabo' : `${modName} Lavabo`
          nameKey = normalizeRebalanceKey(modName)
        }
      } else if (isLavanderia && !isKitchenFurniture) {
        target = 'Lavanderia'
      } else if (/cozinha|gourmet/.test(envKey)) {
        target = envName
      } else if (isKitchenFurniture) {
        target = defaultSocial
      } else {
        // Ambiente real (escritório, sala, dormitório já tratado) — manter origem
        target = envName
      }

      // Módulo protegido ainda apontando para social → força Quarto
      if (
        protectedMod &&
        SOCIAL_ENV_RE.test(normalizeRebalanceKey(target)) &&
        !isBedroomEnvironment(target) &&
        isBedroomProject
      ) {
        notes.push(`Repatriado "${modName}" de "${target}" → "${bedroomAnchor}" (protegido dormitório).`)
        target = bedroomAnchor
      }

      put(target, { ...mod, name: modName })
    }
  }

  return {
    ...root,
    environments: [...buckets.values()].filter((e) => e.modules.length > 0),
    auditor_notes: [...new Set(notes)],
  }
}
