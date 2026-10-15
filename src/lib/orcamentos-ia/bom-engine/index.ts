export type {
  ModuleTypology,
  PieceRole,
  BomItemCategory,
  BomUnit,
  CutPiece,
  BomLine,
  ModuleSpec,
  ExplodeResult,
  IndustrialLabel,
} from '@/lib/orcamentos-ia/bom-engine/types'

export {
  resolveBomPreferences,
  effectiveMountingDevice,
  shouldSkipBackGroove,
  MIN_DRAWER_FRONT_MM,
  MIN_FRONT_GAP_MM,
} from '@/lib/orcamentos-ia/bom-engine/preferences'
export type { BomPreferences } from '@/lib/orcamentos-ia/bom-engine/preferences'

export {
  explodeBox,
  explodeDrawers,
  explodeDoors,
  inferTypology,
  resetPieceSeq,
} from '@/lib/orcamentos-ia/bom-engine/box-assembly'

export {
  edgebandWidthForPiece,
  edgeMetersForPiece,
  edgebandBomLines,
  applyEdgebandPolicy,
} from '@/lib/orcamentos-ia/bom-engine/edgeband'
export type { EdgebandWidthMm, EdgebandPolicy } from '@/lib/orcamentos-ia/bom-engine/edgeband'
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
export type { ExplodeOptions, ExplodeResultWithLabels } from '@/lib/orcamentos-ia/bom-engine/explode'
export { buildIndustrialLabels, formatLabelsForPrint } from '@/lib/orcamentos-ia/bom-engine/labels'
export { buildBoxMeshesFromBom } from '@/lib/orcamentos-ia/bom-engine/xray-geometry'
export type { BoxMeshDesc, BuildMeshesOptions } from '@/lib/orcamentos-ia/bom-engine/xray-geometry'
export {
  buildAtomicPieces,
  colorForAtomicPiece,
} from '@/lib/orcamentos-ia/bom-engine/atomic-pieces'
export type {
  BuildAtomicPiecesInput,
  BuildAtomicPiecesResult,
} from '@/lib/orcamentos-ia/bom-engine/atomic-pieces'
