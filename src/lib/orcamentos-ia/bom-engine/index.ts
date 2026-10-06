export type {
  ModuleTypology,
  PieceRole,
  BomItemCategory,
  BomUnit,
  CutPiece,
  BomLine,
  ModuleSpec,
  ExplodeResult,
} from '@/lib/orcamentos-ia/bom-engine/types'

export {
  resolveBomPreferences,
  effectiveMountingDevice,
  shouldSkipBackGroove,
} from '@/lib/orcamentos-ia/bom-engine/preferences'
export type { BomPreferences } from '@/lib/orcamentos-ia/bom-engine/preferences'

export {
  explodeBox,
  explodeDrawers,
  explodeDoors,
  inferTypology,
  resetPieceSeq,
} from '@/lib/orcamentos-ia/bom-engine/box-assembly'

export { edgebandWidthForPiece, edgeMetersForPiece, edgebandBomLines } from '@/lib/orcamentos-ia/bom-engine/edgeband'
export {
  hingesForDoorHeight,
  fastenersForBox,
  drawerHardwareLines,
  doorHardwareLines,
  handleProfileLines,
  estimateHandleMeters,
} from '@/lib/orcamentos-ia/bom-engine/hardware'
export {
  pieceAreaM2,
  totalBoardAreaM2,
  boardBomLines,
  sheetsFromAreaM2,
  STANDARD_SHEET_AREA_M2,
} from '@/lib/orcamentos-ia/bom-engine/sheets'
export { explodeModule, explodeFromExtractionModule } from '@/lib/orcamentos-ia/bom-engine/explode'
export type { ExplodeOptions } from '@/lib/orcamentos-ia/bom-engine/explode'
export { buildBoxMeshesFromBom } from '@/lib/orcamentos-ia/bom-engine/xray-geometry'
export type { BoxMeshDesc, BuildMeshesOptions } from '@/lib/orcamentos-ia/bom-engine/xray-geometry'
