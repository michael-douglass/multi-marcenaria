/**
 * Travas geométricas por tipologia (clamp — não rejeita a árvore).
 * Evita placeholders absurdo (ex.: criado-mudo 2500×2800 → 3 chapas fantasma).
 */

type AnyRec = Record<string, unknown>

function asArray(value: unknown): AnyRec[] {
  if (!Array.isArray(value)) return []
  return value.filter((x) => x && typeof x === 'object') as AnyRec[]
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type GeometryTypology =
  | 'mesa_de_cabeceira'
  | 'cabeceira'
  | 'painel_tv'
  | 'painel_ripado'
  | 'other'

/** Limites máximos por tipologia (mm). */
export const GEOMETRY_BOUNDS: Record<
  Exclude<GeometryTypology, 'other'>,
  { width_mm: number; height_mm: number; depth_mm: number }
> = {
  mesa_de_cabeceira: { width_mm: 900, height_mm: 700, depth_mm: 500 },
  cabeceira: { width_mm: 2800, height_mm: 1400, depth_mm: 150 },
  painel_tv: { width_mm: 4000, height_mm: 2800, depth_mm: 80 },
  painel_ripado: { width_mm: 4000, height_mm: 2800, depth_mm: 80 },
}

export function inferGeometryTypology(name: string, description = ''): GeometryTypology {
  const blob = normalizeKey(`${name} ${description}`)
  if (/painel/.test(blob) && /ripad|brise|ripa/.test(blob)) return 'painel_ripado'
  if (/painel/.test(blob) && (/tv|liso|avulso/.test(blob) || /^painel$/.test(blob))) {
    return 'painel_tv'
  }
  if (/mesa\s*de\s*cabeceira|criado.?mudo|criado\b/.test(blob)) return 'mesa_de_cabeceira'
  if (/cabeceira/.test(blob) && !/mesa/.test(blob)) return 'cabeceira'
  return 'other'
}

function pieceLooksRipado(piece: AnyRec): boolean {
  const n = normalizeKey(String(piece.name || ''))
  const fn = normalizeKey(String(piece.function || ''))
  return /ripa|ripad|brise/.test(n) || (/ripa/.test(fn) && Number(piece.width_mm) > 0 && Number(piece.width_mm) <= 60)
}

function pieceLooksLisoPainel(piece: AnyRec): boolean {
  const n = normalizeKey(String(piece.name || ''))
  if (/ripa|ripad|brise|sarrafo|apoio/.test(n)) return false
  return /painel|chapa|fundo/.test(n) || String(piece.function || '') === 'painel'
}

function clampNum(n: number, max: number): number {
  if (!Number.isFinite(n) || n <= 0) return n
  return Math.min(n, max)
}

function clampDimsObject(
  dims: AnyRec,
  bounds: { width_mm: number; height_mm: number; depth_mm: number },
): { dims: AnyRec; changed: boolean } {
  const w = Number(dims.width_mm)
  const h = Number(dims.height_mm)
  const d = Number(dims.depth_mm)
  const next = { ...dims }
  let changed = false
  if (Number.isFinite(w) && w > bounds.width_mm) {
    next.width_mm = bounds.width_mm
    changed = true
  }
  if (Number.isFinite(h) && h > bounds.height_mm) {
    next.height_mm = bounds.height_mm
    changed = true
  }
  if (Number.isFinite(d) && d > bounds.depth_mm) {
    next.depth_mm = bounds.depth_mm
    changed = true
  }
  if (changed) next.estimated = true
  return { dims: next, changed }
}

function clampPieceList(
  pieces: AnyRec[],
  bounds: { width_mm: number; height_mm: number; depth_mm: number },
): { pieces: AnyRec[]; changed: boolean } {
  let changed = false
  const next = pieces.map((p) => {
    const w = Number(p.width_mm)
    const h = Number(p.height_mm)
    // Peças: width/height no plano de corte — limitar eixos absurdos (>2800 típico de chapa)
    const cw = Number.isFinite(w) ? clampNum(w, Math.max(bounds.width_mm, 2750)) : w
    const ch = Number.isFinite(h) ? clampNum(h, Math.max(bounds.height_mm, 2750)) : h
    // Para mesa/cabeceira/painel: nenhum eixo de peça pode passar o bound tipológico em ambos
    let nw = cw
    let nh = ch
    if (Number.isFinite(cw) && Number.isFinite(ch)) {
      // Evita laterais 390×2800 em criado-mudo
      if (cw > bounds.width_mm && ch > bounds.height_mm) {
        nw = Math.min(cw, bounds.depth_mm > 0 ? bounds.depth_mm : bounds.width_mm)
        nh = Math.min(ch, bounds.height_mm)
      } else {
        if (cw > Math.max(bounds.width_mm, bounds.depth_mm, 2750)) {
          nw = Math.max(bounds.width_mm, bounds.depth_mm)
        }
        if (ch > Math.max(bounds.height_mm, 2750)) {
          nh = bounds.height_mm
        }
      }
    }
    if (nw !== w || nh !== h) {
      changed = true
      return { ...p, width_mm: nw, height_mm: nh, dimensions_estimated: true }
    }
    return p
  })
  return { pieces: next, changed }
}

/**
 * Separa Painel TV que misturou ripas + painel liso em dois módulos.
 */
export function splitMixedPainelModules(extraction: unknown): unknown {
  if (!extraction || typeof extraction !== 'object') return extraction
  const root = extraction as AnyRec
  const notes: string[] = Array.isArray(root.auditor_notes)
    ? root.auditor_notes.filter((n): n is string => typeof n === 'string')
    : []
  const environments = asArray(root.environments).map((env) => {
    const modules: AnyRec[] = []
    for (const mod of asArray(env.modules)) {
      const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const typ = inferGeometryTypology(name, String(mod.description || ''))
      const caixaria = asArray(mod.caixaria)
      const ripadas = caixaria.filter(pieceLooksRipado)
      const lisas = caixaria.filter(pieceLooksLisoPainel)
      const other = caixaria.filter((p) => !pieceLooksRipado(p) && !pieceLooksLisoPainel(p))

      if (
        (typ === 'painel_tv' || /painel\s*tv/i.test(name)) &&
        ripadas.length > 0 &&
        lisas.length > 0
      ) {
        notes.push(
          `Geometria: separado "${name}" → Painel TV (liso) + Painel ripado (paridade HelloMob).`,
        )
        modules.push({
          ...mod,
          name: 'Painel TV',
          typology: 'painel',
          caixaria: [...lisas, ...other.filter((p) => /sarrafo|apoio|fixacao/.test(normalizeKey(String(p.name || ''))))],
        })
        modules.push({
          ...mod,
          name: 'Painel ripado',
          typology: 'painel',
          description: `Ripado separado de ${name}`,
          caixaria: [
            ...ripadas,
            ...other.filter((p) => /fundo|apoio|sarrafo/.test(normalizeKey(String(p.name || '')))),
          ],
          frentes_portas: [],
        })
        continue
      }
      modules.push(mod)
    }
    return { ...env, modules }
  })
  return {
    ...root,
    environments,
    auditor_notes: [...new Set(notes)],
  }
}

/**
 * Aplica limites tipológicos (clamp) + split ripado.
 */
export function clampGeometryBounds(extraction: unknown): unknown {
  if (!extraction || typeof extraction !== 'object') return extraction
  let root = splitMixedPainelModules(extraction) as AnyRec
  const notes: string[] = Array.isArray(root.auditor_notes)
    ? root.auditor_notes.filter((n): n is string => typeof n === 'string')
    : []
  const warnings: string[] = Array.isArray(root.warnings)
    ? root.warnings.filter((w): w is string => typeof w === 'string')
    : []

  const environments = asArray(root.environments).map((env) => {
    const modules = asArray(env.modules).map((mod) => {
      const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const typ = inferGeometryTypology(name, String(mod.description || ''))
      if (typ === 'other') return mod
      const bounds = GEOMETRY_BOUNDS[typ]
      let next = { ...mod }
      let changed = false

      if (next.dimensions && typeof next.dimensions === 'object') {
        const r = clampDimsObject(next.dimensions as AnyRec, bounds)
        if (r.changed) {
          next.dimensions = r.dims
          changed = true
        }
      }

      const cx = clampPieceList(asArray(next.caixaria), bounds)
      if (cx.changed) {
        next.caixaria = cx.pieces
        changed = true
      }
      const fr = clampPieceList(asArray(next.frentes_portas), bounds)
      if (fr.changed) {
        next.frentes_portas = fr.pieces
        changed = true
      }

      if (typ === 'mesa_de_cabeceira' && !next.typology) {
        next.typology = 'gaveteiro'
      }
      if ((typ === 'painel_tv' || typ === 'painel_ripado' || typ === 'cabeceira') && !next.typology) {
        next.typology = 'painel'
      }

      if (changed) {
        const msg = `Geometria clamp (${typ}): cotas de "${name}" limitadas (anti-placeholder 2500×2800).`
        notes.push(msg)
        warnings.push(msg)
      }
      return next
    })
    return { ...env, modules }
  })

  return {
    ...root,
    environments,
    auditor_notes: [...new Set(notes)],
    warnings: [...new Set(warnings)],
  }
}
