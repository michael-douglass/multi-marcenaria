export type {
  QuoteAnalysisMode,
  QuoteAnalysisStatus,
  QuoteAnalysisRow,
} from '@/lib/orcamentos-ia/storage'

export {
  ORCAMENTOS_IA_BUCKET,
  QUOTE_STATUS_PROGRESS,
  QUOTE_STATUS_LABEL,
  CANCELLED_BY_USER_MESSAGE,
  ensureOrcamentosIaBucket,
  uploadQuotePdf,
  createPendingQuoteAnalysis,
  updateQuoteAnalysisPdfPath,
  cancelOrcamentosIaAnalysis,
  isQuoteAnalysisCancelled,
  isReadyForClientPricing,
} from '@/lib/orcamentos-ia/storage'

export { resolveMaterialPrice, barsOf3mFromMeters, endCapsForHandleBars, repriceZeroMaterials, CONTINGENCY_PRICE_WARNING, CONTINGENCY_PRICES } from '@/lib/orcamentos-ia/pricing'
export {
  calculateQuotePricing,
  calculateSalePrice,
  buildShoppingList,
  formatBRL,
  PRICING_MODALITY_LABEL,
  DEFAULT_PRICING_PARAMS,
  sheetsFromAreaM2,
  rollsForEdgeTapeMeters,
  normalizePricingModality,
  moduleMaterialsCost,
  environmentMaterialsCost,
  allocateSalePrice,
} from '@/lib/orcamentos-ia/pricing'
export {
  buildQuotePresentationLayout,
  resolveModuleImageUrl,
  formatModuleDimensions,
  clonePresentationLayout,
  recomputePresentationTotals,
  computeLaborProfitExtra,
  distributeExtraOntoSalePrices,
} from '@/lib/orcamentos-ia/quote-presentation'
export type {
  QuotePresentationLayout,
  QuotePresentationBranding,
  QuotePageImage,
} from '@/lib/orcamentos-ia/quote-presentation'
export {
  openQuotePresentationPrint,
  buildQuotePresentationHtml,
  buildQuotePresentationBodyHtml,
  QUOTE_PRESENTATION_CSS,
} from '@/lib/orcamentos-ia/quote-presentation-print'
export type { PricingModality, PricingParams, PricingResult, ShoppingListItem } from '@/lib/orcamentos-ia/pricing'
export {
  DEFAULT_SYSTEM_PREFERENCES,
  DEFAULT_COMPANY_STANDARDS,
  getSystemPreferences,
  upsertSystemPreferences,
  formatPreferencesForPrompt,
} from '@/lib/orcamentos-ia/system-preferences'
export type { SystemPreferences } from '@/lib/orcamentos-ia/system-preferences'
export {
  companyStandardsSchema,
  drawerConstructionSchema,
  getCompanyStandards,
  upsertCompanyStandards,
  parseCompanyStandards,
} from '@/lib/orcamentos-ia/company-standards'
export type { CompanyStandards, DrawerConstruction } from '@/lib/orcamentos-ia/company-standards'
export {
  explodeModule,
  explodeFromExtractionModule,
  buildBoxMeshesFromBom,
  buildAtomicPieces,
  colorForAtomicPiece,
  buildIndustrialLabels,
  formatLabelsForPrint,
  applyEdgebandPolicy,
} from '@/lib/orcamentos-ia/bom-engine'
export { buildObservabilityBlocks } from '@/lib/orcamentos-ia/observability'
export { migrateLegacyPricingParams } from '@/lib/orcamentos-ia/migrate-modality'
export { CORTE_CLAUDE_TOKENS } from '@/lib/orcamentos-ia/ui-tokens'
export {
  runOrcamentosIaPipeline,
  reprocessOrcamentosIaPipeline,
  reauditOrcamentosIaAnalysis,
  repersistQuoteAnalysisFromLastExtraction,
} from '@/lib/orcamentos-ia/pipeline'
export {
  consolidateExtractionForPricing,
  consolidateProjectBom,
  applySheetPaletteToExtraction,
  DEFAULT_PROJECT_SHEET_PALETTE,
} from '@/lib/orcamentos-ia/bom-consolidate'
export type {
  ConsolidatedBom,
  ConsolidatedSheetLine,
  ConsolidatedHardwareLine,
  ProjectSheetSku,
} from '@/lib/orcamentos-ia/bom-consolidate'
export {
  FLAVIANE_REFERENCE_PALETTE,
  FLAVIANE_PALETTE_MATERIAL_KEYS,
  DEFAULT_BOX_BACK_PALETTE,
  buildProjectSheetPaletteFromExtraction,
  parseProjectSheetPalette,
  resolvePaletteForPricing,
} from '@/lib/orcamentos-ia/project-sheet-palette'
export {
  mapHardwareAlias,
  hardwareAliasSeedPairs,
  HARDWARE_ALIAS_RULES,
} from '@/lib/orcamentos-ia/hardware-alias'
export type { HardwareCanonicalKey, MappedHardware } from '@/lib/orcamentos-ia/hardware-alias'
export {
  quoteExtractionSchema,
  atomicPieceSchema,
} from '@/lib/orcamentos-ia/schemas'
export type {
  AtomicPiece,
  AtomicPieceRole,
  AtomicSheetRole,
} from '@/lib/orcamentos-ia/schemas'
export {
  estimateModuleDimensions,
  defaultPieceMm,
  defaultFrenteMm,
} from '@/lib/orcamentos-ia/dimension-defaults'
export {
  getCompanyMemories,
  listCompanyMemories,
  deleteCompanyMemory,
  saveCompanyMemory,
  formatMemoriesForPrompt,
  askMaxChat,
} from '@/lib/orcamentos-ia/memory'
export { loadQuoteAnalysisTree, getSignedPdfUrl, getSignedPageImageUrl, listQuotePagePaths, getSignedQuotePageUrls } from '@/lib/orcamentos-ia/quote-tree'
export {
  convertSelectedPdfPagesToJpeg,
  assertBatchPagePaths,
  normalizeSelectedPages,
  pageNumbersFromTotals,
} from '@/lib/orcamentos-ia/pdf-processor'
export {
  derivePipelineTelemetry,
  type PipelineTelemetry,
  type PipelineTelemetryPhase,
  type ShaderThoughtMode,
} from '@/lib/orcamentos-ia/pipeline-telemetry'
export {
  scopeInventoryToSelectedPages,
  buildScopedCoverageReport,
  scopedAuditorPromptAddendum,
  filterExtractionToSelectedPages,
  shouldBlockOnCoverageMissing,
} from '@/lib/orcamentos-ia/audit'
export type { CoverageScope } from '@/lib/orcamentos-ia/audit'
export {
  buildQuoteProjectThumbPath,
  cacheMissingProjectPageThumbs,
  loadProjectPageThumbUrls,
  uploadQuoteProjectThumb,
  PROJECT_THUMB_WIDTH,
} from '@/lib/orcamentos-ia/project-page-thumbs'
export {
  getInventoryItems,
  updateInventoryItem,
  updateInventoryItemsBatch,
  createInventoryItem,
  getInventoryAliases,
  createInventoryAlias,
  deleteInventoryAlias,
  getRollMeters,
  normalizeAlias,
  INVENTORY_CATEGORY_LABEL,
} from '@/lib/orcamentos-ia/inventory'
export type {
  InventoryCategory,
  InventoryItem,
  InventoryItemPatch,
  InventoryAlias,
  GetInventoryItemsParams,
  CreateInventoryItemParams,
} from '@/lib/orcamentos-ia/inventory'
