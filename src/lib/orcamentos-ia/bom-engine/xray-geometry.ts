import type { CutPiece } from '@/lib/orcamentos-ia/bom-engine/types'
import {
  HELLOMOB_CONSTRUCTION_RULES,
  backPanelCenterZ_m,
  detectOpenTypology,
  type HellomobConstructionRules,
} from '@/lib/orcamentos-ia/bom-engine/hellomob-construction-rules'

/** Descrição pura de mesh para cena 3D (sem WebGL) — usada no teste E5. */
export interface BoxMeshDesc {
  id: string
  role: string
  name: string
  /** Centro da peça no espaço do módulo (metros). */
  position: [number, number, number]
  /** Dimensões da caixa (metros): x=largura, y=altura, z=profundidade. */
  size: [number, number, number]
  thickness_mm: number
  highlighted?: boolean
  /** Tag de vão / coluna (Módulos 9–10) para overlay 3D. */
  gapTag?: string
  column_index?: number
}

export interface BuildMeshesOptions {
  /** Origem do módulo (canto inferior esquerdo frontal). */
  origin?: [number, number, number]
  selectedPieceId?: string | null
  boxThicknessMm?: number
  moduleWidthMm?: number
  moduleHeightMm?: number
  moduleDepthMm?: number
  /** Nome do módulo (mesa / tipologias abertas). */
  moduleName?: string | null
  typology?: string | null
  /** Override das regras HelloMob (testes). */
  rules?: HellomobConstructionRules
}

const EPS_M = 0.001 // 1 mm

/** Distribui N centros uniformemente em [lo, hi] respeitando espessuras. */
export function distributeCenters(
  count: number,
  lo: number,
  hi: number,
  thicknessEach: number,
): number[] {
  if (count <= 0) return []
  if (count === 1) return [(lo + hi) / 2]
  const clear = Math.max(hi - lo - count * thicknessEach, 0)
  const gap = clear / (count + 1)
  const centers: number[] = []
  let cursor = lo + gap
  for (let i = 0; i < count; i++) {
    centers.push(cursor + thicknessEach / 2)
    cursor += thicknessEach + gap
  }
  return centers
}

/** True se dois centros coincidem (ε em metros). */
export function centersNearlyEqual(
  a: [number, number, number],
  b: [number, number, number],
  eps = EPS_M,
): boolean {
  return (
    Math.abs(a[0] - b[0]) < eps &&
    Math.abs(a[1] - b[1]) < eps &&
    Math.abs(a[2] - b[2]) < eps
  )
}

/** Retorna true se não há pares com o mesmo centro. */
export function assertNoIdenticalCenters(meshes: BoxMeshDesc[], eps = EPS_M): boolean {
  for (let i = 0; i < meshes.length; i++) {
    for (let j = i + 1; j < meshes.length; j++) {
      if (centersNearlyEqual(meshes[i].position, meshes[j].position, eps)) return false
    }
  }
  return true
}

function isPlinthName(name: string): boolean {
  return /s[oó]culo|soculo|rodap[eé]|saia|p[eé]\b|plinth/i.test(name)
}

function isTopStretcher(name: string): boolean {
  return /travessa.*(teto|superior|cima)|superior|teto/i.test(name)
}

function isBaseStretcher(name: string): boolean {
  return /travessa.*(base|inferior|baixo)|inferior|base/i.test(name) || isPlinthName(name)
}

/**
 * Converte peças do BOM em caixas axis-aligned no espaço do móvel.
 * Coordenadas: X = largura, Y = altura, Z = profundidade (frente → fundo).
 * Regras: HelloMob / System Preferences (rebaixo fundo 10 mm, vão livre, etc.).
 */
export function buildBoxMeshesFromBom(
  pieces: CutPiece[],
  options: BuildMeshesOptions = {},
): BoxMeshDesc[] {
  const rules = options.rules ?? HELLOMOB_CONSTRUCTION_RULES
  const ox = options.origin?.[0] ?? 0
  const oy = options.origin?.[1] ?? 0
  const oz = options.origin?.[2] ?? 0
  const boxTmm = options.boxThicknessMm ?? rules.box.thickness_mm
  const t = boxTmm / 1000
  const W = (options.moduleWidthMm ?? 1000) / 1000
  const H = (options.moduleHeightMm ?? 800) / 1000
  const D = (options.moduleDepthMm ?? 500) / 1000
  const shelfRecess = (options.rules?.shelf_recess_mm ?? rules.shelf_recess_mm) / 1000
  const frontGap = rules.front_gap_mm / 1000
  const open = detectOpenTypology(options.moduleName, options.typology)

  const working = open
    ? pieces.filter((p) => !rules.open_forbidden_roles.includes(p.role))
    : pieces

  const meshes: BoxMeshDesc[] = []
  let lateralPlaced = 0

  const shelfPieces = working.filter((p) => p.role === 'prateleira')
  const shelfCount = shelfPieces.reduce((s, p) => s + p.quantity, 0)
  const dividerPieces = working.filter((p) => p.role === 'divisoria')
  const fundoPieces = working.filter((p) => p.role === 'fundo')
  const fundoSlots = fundoPieces.reduce((s, p) => s + Math.max(1, p.quantity), 0)

  // Estimativa de espessuras de base/tampo/sóculo para vão livre
  const baseTh =
    (working.find((p) => p.role === 'base')?.thickness_mm ?? (open ? 0 : boxTmm)) / 1000
  const tampoTh =
    (working.find((p) => p.role === 'tampo')?.thickness_mm ?? (open ? 0 : boxTmm)) / 1000
  const plinthPiece = working.find(
    (p) => p.role === 'sarrafo' || p.role === 'outro' || p.role === 'travessa',
  )
  const plinthH = plinthPiece && isPlinthName(plinthPiece.name)
    ? plinthPiece.height_mm / 1000 || plinthPiece.thickness_mm / 1000
    : 0

  const yInnerLo = oy + plinthH + baseTh
  const yInnerHi = oy + H - tampoTh
  const shelfThAvg =
    shelfCount > 0
      ? shelfPieces.reduce((s, p) => s + p.thickness_mm * p.quantity, 0) /
        shelfCount /
        1000
      : t
  const shelfYs = distributeCenters(shelfCount, yInnerLo, yInnerHi, shelfThAvg)

  const xInnerLo = ox + t
  const xInnerHi = ox + W - t
  const dividerCount = dividerPieces.reduce((s, p) => s + Math.max(1, p.quantity), 0)
  const divThAvg =
    dividerCount > 0
      ? dividerPieces.reduce((s, p) => s + p.thickness_mm * Math.max(1, p.quantity), 0) /
        dividerCount /
        1000
      : t
  const dividerXs = distributeCenters(dividerCount, xInnerLo, xInnerHi, divThAvg)

  // Fundos: Z no rebaixo; múltiplos → vãos em X (colunas) ou faixas em Y
  const fundoZ = (th: number) => backPanelCenterZ_m(D, th, rules.back_panel) + oz
  const fundoCenters: Array<{ x: number; y: number }> = []
  if (fundoSlots <= 1) {
    fundoCenters.push({ x: ox + W / 2, y: oy + H / 2 })
  } else if (dividerCount > 0 || fundoSlots <= 4) {
    // Um fundo por vão horizontal (colunas)
    const bayXs = distributeCenters(fundoSlots, xInnerLo, xInnerHi, 0.01)
    for (const x of bayXs) fundoCenters.push({ x, y: oy + (yInnerLo + yInnerHi) / 2 })
  } else {
    // Empilhar faixas verticais (cristaleira alta com muitos fundos)
    const bayYs = distributeCenters(fundoSlots, yInnerLo, yInnerHi, 0.01)
    for (const y of bayYs) fundoCenters.push({ x: ox + W / 2, y })
  }
  let fundoSlotIndex = 0

  let shelfIndex = 0
  let dividerIndex = 0

  // Gavetas: empilhar frentes de baixo para cima
  const drawerFronts = working.filter(
    (p) =>
      p.role === 'frente' &&
      /gaveta/i.test(p.name + (p.role ?? '')),
  )
  const allFronts = working.filter((p) => p.role === 'frente' || p.role === 'porta')
  const useDrawerStack =
    working.some((p) => p.role.startsWith('gaveta_')) || drawerFronts.length > 0

  const drawerBoxParts = working.filter((p) =>
    ['gaveta_lateral', 'gaveta_contrafundo', 'gaveta_fundo'].includes(p.role),
  )
  const drawerFrontList =
    drawerFronts.length > 0
      ? drawerFronts
      : useDrawerStack
        ? allFronts.filter((p) => p.role === 'frente')
        : []

  const drawerStackHeights = drawerFrontList.flatMap((p) => {
    const h = (p.height_mm > 0 ? p.height_mm : 150) / 1000
    return Array.from({ length: Math.max(1, p.quantity) }, () => h)
  })
  let drawerCursorY = yInnerLo + frontGap
  const drawerCentersY: number[] = []
  for (const h of drawerStackHeights) {
    drawerCentersY.push(drawerCursorY + h / 2)
    drawerCursorY += h + frontGap
  }
  let drawerFrontIdx = 0
  let drawerBoxIdx = 0

  const pushMesh = (mesh: BoxMeshDesc) => {
    // Evita centro idêntico: jitter mínimo em Y se colidir
    let guard = 0
    while (
      meshes.some((m) => centersNearlyEqual(m.position, mesh.position)) &&
      guard < 8
    ) {
      mesh.position[1] += EPS_M * (guard + 1)
      guard += 1
    }
    meshes.push(mesh)
  }

  for (const piece of working) {
    const w = piece.width_mm / 1000
    const h = piece.height_mm / 1000
    const th = piece.thickness_mm / 1000
    const highlight = options.selectedPieceId === piece.id
    const gapTag =
      piece.column_index != null
        ? `Coluna ${piece.column_index}`
        : piece.role === 'prateleira'
          ? 'Vão prateleira'
          : piece.role === 'frente'
            ? 'Vão gaveta'
            : undefined

    if (piece.role === 'lateral') {
      for (let i = 0; i < piece.quantity; i++) {
        const left = lateralPlaced % 2 === 0
        lateralPlaced += 1
        pushMesh({
          id: `${piece.id}-${i}`,
          role: piece.role,
          name: piece.name,
          position: [ox + (left ? th / 2 : W - th / 2), oy + H / 2, oz + D / 2],
          size: [th, h > 0.01 ? h : H, w > 0.01 ? w : D],
          thickness_mm: piece.thickness_mm,
          highlighted: highlight,
          gapTag,
          column_index: piece.column_index,
        })
      }
      continue
    }

    if (piece.role === 'base') {
      pushMesh({
        id: piece.id,
        role: piece.role,
        name: piece.name,
        position: [ox + W / 2, oy + plinthH + th / 2, oz + D / 2],
        size: [w > 0.01 ? w : W, th, h > 0.01 ? h : D],
        thickness_mm: piece.thickness_mm,
        highlighted: highlight,
        gapTag,
        column_index: piece.column_index,
      })
      continue
    }

    if (piece.role === 'tampo') {
      pushMesh({
        id: piece.id,
        role: piece.role,
        name: piece.name,
        position: [ox + W / 2, oy + H - th / 2, oz + D / 2],
        size: [w > 0.01 ? w : W, th, h > 0.01 ? h : D],
        thickness_mm: piece.thickness_mm,
        highlighted: highlight,
        gapTag,
        column_index: piece.column_index,
      })
      continue
    }

    if (piece.role === 'fundo') {
      for (let i = 0; i < Math.max(1, piece.quantity); i++) {
        const slot = fundoCenters[Math.min(fundoSlotIndex, fundoCenters.length - 1)] ?? {
          x: ox + W / 2,
          y: oy + H / 2,
        }
        fundoSlotIndex += 1
        const fw = w > 0.01 ? w : Math.max(W / Math.max(fundoSlots, 1) - 0.01, t)
        const fh = h > 0.01 ? h : Math.max((yInnerHi - yInnerLo) / Math.max(fundoSlots, 1), t)
        pushMesh({
          id: `${piece.id}-${i}`,
          role: piece.role,
          name: piece.name,
          position: [slot.x, slot.y, fundoZ(th)],
          size: [fw, fh, th],
          thickness_mm: piece.thickness_mm,
          highlighted: highlight,
          gapTag: gapTag ?? `Fundo ${fundoSlotIndex}`,
          column_index: piece.column_index,
        })
      }
      continue
    }

    if (piece.role === 'prateleira') {
      for (let i = 0; i < piece.quantity; i++) {
        const y = shelfYs[shelfIndex] ?? oy + H / 2
        shelfIndex += 1
        const depthShelf = Math.max((h > 0.01 ? h : D) - shelfRecess, t)
        pushMesh({
          id: `${piece.id}-${i}`,
          role: piece.role,
          name: piece.name,
          position: [ox + W / 2, y, oz + depthShelf / 2],
          size: [w > 0.01 ? w : W - 2 * t, th, depthShelf],
          thickness_mm: piece.thickness_mm,
          highlighted: highlight,
          gapTag: gapTag ?? `Vão ${shelfIndex}`,
          column_index: piece.column_index,
        })
      }
      continue
    }

    if (piece.role === 'divisoria') {
      for (let i = 0; i < Math.max(1, piece.quantity); i++) {
        const x = dividerXs[dividerIndex] ?? ox + W / 2
        dividerIndex += 1
        pushMesh({
          id: `${piece.id}-${i}`,
          role: piece.role,
          name: piece.name,
          position: [x, oy + (yInnerLo + yInnerHi) / 2, oz + D / 2],
          size: [th, h > 0.01 ? h : yInnerHi - yInnerLo, w > 0.01 ? w : D - shelfRecess],
          thickness_mm: piece.thickness_mm,
          highlighted: highlight,
          gapTag: gapTag ?? `Divisória ${dividerIndex}`,
          column_index: piece.column_index,
        })
      }
      continue
    }

    if (piece.role === 'frente' || piece.role === 'porta') {
      const isDrawerFront =
        useDrawerStack &&
        piece.role === 'frente' &&
        (drawerFrontList.includes(piece) || /gaveta/i.test(piece.name))
      if (isDrawerFront) {
        for (let i = 0; i < Math.max(1, piece.quantity); i++) {
          const cy = drawerCentersY[drawerFrontIdx] ?? oy + H / 2
          drawerFrontIdx += 1
          const sy = h > 0.01 ? h : 0.15
          pushMesh({
            id: `${piece.id}-${i}`,
            role: piece.role,
            name: piece.name,
            position: [ox + W / 2, cy, oz + th / 2],
            size: [w > 0.01 ? w : W * 0.96, sy, th],
            thickness_mm: piece.thickness_mm,
            highlighted: highlight,
            gapTag: gapTag ?? `Gaveta ${drawerFrontIdx}`,
            column_index: piece.column_index,
          })
        }
        continue
      }

      const frontCount = Math.max(1, piece.quantity)
      for (let i = 0; i < frontCount; i++) {
        const slotW = W / frontCount
        const cx = ox + slotW * (i + 0.5)
        const sx = Math.min(w > 0.01 ? w : slotW * 0.96, slotW * 0.98)
        const sy = h > 0.01 ? h : H
        pushMesh({
          id: `${piece.id}-${i}`,
          role: piece.role,
          name: piece.name,
          position: [cx, oy + sy / 2, oz + th / 2],
          size: [sx, sy, th],
          thickness_mm: piece.thickness_mm,
          highlighted: highlight,
          gapTag: gapTag ?? (piece.role === 'porta' ? `Porta ${i + 1}` : `Frente ${i + 1}`),
          column_index: piece.column_index,
        })
      }
      continue
    }

    if (piece.role === 'gaveta_lateral' || piece.role === 'gaveta_contrafundo' || piece.role === 'gaveta_fundo') {
      const n = Math.max(1, piece.quantity)
      for (let i = 0; i < n; i++) {
        const stackI = Math.min(drawerBoxIdx, Math.max(drawerCentersY.length - 1, 0))
        const cy =
          drawerCentersY[stackI] ??
          drawerCentersY[drawerCentersY.length - 1] ??
          oy + H * 0.35
        drawerBoxIdx += 1
        if (piece.role === 'gaveta_lateral') {
          const left = i % 2 === 0
          const boxW = Math.min(W * 0.9, w > 0.01 ? w : D * 0.8)
          pushMesh({
            id: `${piece.id}-${i}`,
            role: piece.role,
            name: piece.name,
            position: [
              ox + (left ? t * 2 + th / 2 : W - t * 2 - th / 2),
              cy,
              oz + D * 0.4,
            ],
            size: [th, h > 0.01 ? h : 0.12, boxW],
            thickness_mm: piece.thickness_mm,
            highlighted: highlight,
            gapTag: `Caixa gaveta ${stackI + 1}`,
            column_index: piece.column_index,
          })
        } else if (piece.role === 'gaveta_fundo') {
          pushMesh({
            id: `${piece.id}-${i}`,
            role: piece.role,
            name: piece.name,
            position: [ox + W / 2, cy - 0.04, oz + D * 0.4],
            size: [w > 0.01 ? w : W * 0.7, th, h > 0.01 ? h : D * 0.5],
            thickness_mm: piece.thickness_mm,
            highlighted: highlight,
            gapTag: `Fundo gaveta ${stackI + 1}`,
            column_index: piece.column_index,
          })
        } else {
          // contrafundo
          pushMesh({
            id: `${piece.id}-${i}`,
            role: piece.role,
            name: piece.name,
            position: [ox + W / 2, cy, oz + D * 0.55],
            size: [w > 0.01 ? w : W * 0.7, h > 0.01 ? h : 0.1, th],
            thickness_mm: piece.thickness_mm,
            highlighted: highlight,
            gapTag: `Contrafundo ${stackI + 1}`,
            column_index: piece.column_index,
          })
        }
      }
      continue
    }

    if (piece.role === 'travessa' || piece.role === 'sarrafo' || piece.role === 'outro') {
      const plinth = isPlinthName(piece.name)
      const topS = isTopStretcher(piece.name)
      const baseS = isBaseStretcher(piece.name) || plinth
      let cy = oy + H * 0.5
      if (plinth || baseS) cy = oy + Math.max(th, h > 0.01 ? h : th) / 2
      if (topS) cy = oy + H - th / 2
      // Pés de mesa (outro/sarrafo) nos cantos
      if (open && (piece.role === 'outro' || piece.role === 'sarrafo') && !plinth) {
        const footN = Math.max(1, piece.quantity)
        for (let i = 0; i < footN; i++) {
          const corners: Array<[number, number]> = [
            [ox + t, oz + t],
            [ox + W - t, oz + t],
            [ox + t, oz + D - t],
            [ox + W - t, oz + D - t],
          ]
          const [fx, fz] = corners[i % 4]
          pushMesh({
            id: `${piece.id}-foot-${i}`,
            role: piece.role,
            name: piece.name,
            position: [fx, oy + (h > 0.01 ? h : H * 0.7) / 2, fz],
            size: [th, h > 0.01 ? h : H * 0.7, th],
            thickness_mm: piece.thickness_mm,
            highlighted: highlight,
            gapTag: `Pé ${i + 1}`,
            column_index: piece.column_index,
          })
        }
        continue
      }
      pushMesh({
        id: piece.id,
        role: piece.role,
        name: piece.name,
        position: [ox + W / 2, cy, oz + (plinth || baseS || topS ? th / 2 + 0.005 : D / 2)],
        size: [
          w > 0.01 ? w : W - 2 * t,
          plinth ? Math.max(h, th) : th,
          h > 0.01 && !plinth ? h : t,
        ],
        thickness_mm: piece.thickness_mm,
        highlighted: highlight,
        gapTag,
        column_index: piece.column_index,
      })
      continue
    }

    // Default: centrado mas com offset por índice para não colidir
    pushMesh({
      id: piece.id,
      role: piece.role,
      name: piece.name,
      position: [ox + W / 2, oy + H / 2 + meshes.length * EPS_M, oz + D / 2],
      size: [w > 0.01 ? w : t, th, h > 0.01 ? h : t],
      thickness_mm: piece.thickness_mm,
      highlighted: highlight,
      gapTag,
      column_index: piece.column_index,
    })
  }

  return meshes
}

export { detectOpenTypology }
