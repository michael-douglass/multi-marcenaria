import { useMemo } from 'react'
import type { CutPiece } from '@/lib/orcamentos-ia/bom-engine/types'
import {
  buildBoxMeshesFromBom,
} from '@/lib/orcamentos-ia/bom-engine/xray-geometry'
import type { AtomicPiece, AtomicPieceRole, AtomicSheetRole } from '@/lib/orcamentos-ia/schemas'
import { RaioX3D } from '@/components/orcamentos-ia/RaioX3D'

interface ModuleXraySceneProps {
  pieces: CutPiece[]
  moduleWidthMm: number
  moduleHeightMm: number
  moduleDepthMm: number
  boxThicknessMm?: number
  selectedPieceId?: string | null
  className?: string
}

function sheetRoleFor(role: string, thicknessMm: number): AtomicSheetRole {
  if (role === 'frente' || role === 'porta') return 'front_color'
  if (role === 'fundo' || thicknessMm <= 8) return 'back_white'
  return 'box_white'
}

/**
 * Compat: converte CutPiece[] (explode) em AtomicPiece[] e delega ao RaioX3D.
 * Preferir `<RaioX3D atomic_pieces={…} />` com buildAtomicPieces no Audit Workspace.
 */
export function ModuleXrayScene({
  pieces,
  moduleWidthMm,
  moduleHeightMm,
  moduleDepthMm,
  boxThicknessMm = 15,
  selectedPieceId = null,
  className,
}: ModuleXraySceneProps) {
  const atomic_pieces = useMemo((): AtomicPiece[] => {
    const meshes = buildBoxMeshesFromBom(pieces, {
      moduleWidthMm,
      moduleHeightMm,
      moduleDepthMm,
      boxThicknessMm,
      selectedPieceId,
    })
    return meshes.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role as AtomicPieceRole,
      width_mm: Math.round(Math.max(...m.size) * 1000),
      height_mm: Math.round([...m.size].sort((a, b) => b - a)[1] * 1000),
      thickness_mm: m.thickness_mm,
      quantity: 1,
      material_name:
        m.role === 'fundo'
          ? `MDF Branco ${m.thickness_mm}mm`
          : m.role === 'frente' || m.role === 'porta'
            ? 'MDF Frente'
            : `MDF Branco TX ${m.thickness_mm}mm`,
      sheet_role: sheetRoleFor(m.role, m.thickness_mm),
      position_m: m.position,
      size_m: m.size,
      highlighted: m.highlighted,
      gapTag: m.gapTag,
      column_index: m.column_index,
    }))
  }, [
    pieces,
    moduleWidthMm,
    moduleHeightMm,
    moduleDepthMm,
    boxThicknessMm,
    selectedPieceId,
  ])

  return (
    <RaioX3D
      atomic_pieces={atomic_pieces}
      selectedPieceId={selectedPieceId}
      className={className}
    />
  )
}
