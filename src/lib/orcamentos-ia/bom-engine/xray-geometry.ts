import type { CutPiece } from '@/lib/orcamentos-ia/bom-engine/types'

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
}

/**
 * Converte peças do BOM em caixas axis-aligned no espaço do móvel.
 * Coordenadas: X = largura, Y = altura, Z = profundidade (frente → fundo).
 */
export function buildBoxMeshesFromBom(
  pieces: CutPiece[],
  options: BuildMeshesOptions = {},
): BoxMeshDesc[] {
  const ox = options.origin?.[0] ?? 0
  const oy = options.origin?.[1] ?? 0
  const oz = options.origin?.[2] ?? 0
  const t = (options.boxThicknessMm ?? 15) / 1000
  const W = (options.moduleWidthMm ?? 1000) / 1000
  const H = (options.moduleHeightMm ?? 800) / 1000
  const D = (options.moduleDepthMm ?? 500) / 1000

  const meshes: BoxMeshDesc[] = []
  let lateralPlaced = 0
  let shelfIndex = 0
  const shelfCount = pieces.filter((p) => p.role === 'prateleira').reduce((s, p) => s + p.quantity, 0)

  for (const piece of pieces) {
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
        meshes.push({
          id: `${piece.id}-${i}`,
          role: piece.role,
          name: piece.name,
          position: [
            ox + (left ? th / 2 : W - th / 2),
            oy + H / 2,
            oz + D / 2,
          ],
          size: [th, h, w], // thickness × height × depth
          thickness_mm: piece.thickness_mm,
          highlighted: highlight,
          gapTag,
          column_index: piece.column_index,
        })
      }
      continue
    }

    if (piece.role === 'base') {
      meshes.push({
        id: piece.id,
        role: piece.role,
        name: piece.name,
        position: [ox + W / 2, oy + th / 2, oz + D / 2],
        size: [w, th, h],
        thickness_mm: piece.thickness_mm,
        highlighted: highlight,
        gapTag,
        column_index: piece.column_index,
      })
      continue
    }

    if (piece.role === 'tampo') {
      meshes.push({
        id: piece.id,
        role: piece.role,
        name: piece.name,
        position: [ox + W / 2, oy + H - th / 2, oz + D / 2],
        size: [w, th, h],
        thickness_mm: piece.thickness_mm,
        highlighted: highlight,
        gapTag,
        column_index: piece.column_index,
      })
      continue
    }

    if (piece.role === 'fundo') {
      meshes.push({
        id: piece.id,
        role: piece.role,
        name: piece.name,
        position: [ox + W / 2, oy + H / 2, oz + D - th / 2],
        size: [w, h, th],
        thickness_mm: piece.thickness_mm,
        highlighted: highlight,
        gapTag,
        column_index: piece.column_index,
      })
      continue
    }

    if (piece.role === 'prateleira') {
      for (let i = 0; i < piece.quantity; i++) {
        shelfIndex += 1
        const y = oy + (H * shelfIndex) / (shelfCount + 1)
        meshes.push({
          id: `${piece.id}-${i}`,
          role: piece.role,
          name: piece.name,
          position: [ox + W / 2, y, oz + D / 2 - t],
          size: [w, th, h],
          thickness_mm: piece.thickness_mm,
          highlighted: highlight,
          gapTag: gapTag ?? `Vão ${shelfIndex}`,
          column_index: piece.column_index,
        })
      }
      continue
    }

    if (piece.role === 'divisoria') {
      for (let i = 0; i < piece.quantity; i++) {
        const x = ox + (W * (i + 1)) / (piece.quantity + 1)
        meshes.push({
          id: `${piece.id}-${i}`,
          role: piece.role,
          name: piece.name,
          position: [x, oy + H / 2, oz + D / 2],
          size: [th, h > 0.01 ? h : H - 2 * t, w > 0.01 ? w : D],
          thickness_mm: piece.thickness_mm,
          highlighted: highlight,
          gapTag: gapTag ?? `Divisória ${i + 1}`,
          column_index: piece.column_index,
        })
      }
      continue
    }

    if (piece.role === 'frente' || piece.role === 'porta') {
      const frontCount = Math.max(1, piece.quantity)
      for (let i = 0; i < frontCount; i++) {
        const slotW = W / frontCount
        const cx = ox + slotW * (i + 0.5)
        const sx = Math.min(w > 0.01 ? w : slotW * 0.96, slotW * 0.98)
        const sy = h > 0.01 ? h : H
        meshes.push({
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

    if (
      piece.role === 'travessa' ||
      piece.role === 'sarrafo' ||
      piece.role === 'gaveta_contrafundo'
    ) {
      meshes.push({
        id: piece.id,
        role: piece.role,
        name: piece.name,
        position: [ox + W / 2, oy + H * 0.55, oz + th / 2 + 0.01],
        size: [w > 0.01 ? w : W - 2 * t, th, h > 0.01 ? h : t],
        thickness_mm: piece.thickness_mm,
        highlighted: highlight,
        gapTag,
        column_index: piece.column_index,
      })
      continue
    }

    // Default: centrado
    meshes.push({
      id: piece.id,
      role: piece.role,
      name: piece.name,
      position: [ox + W / 2, oy + H / 2, oz + D / 2],
      size: [w, th, h],
      thickness_mm: piece.thickness_mm,
      highlighted: highlight,
      gapTag,
      column_index: piece.column_index,
    })
  }

  return meshes
}
