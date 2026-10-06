import type { SystemPreferences } from '@/lib/orcamentos-ia/system-preferences'
import { DEFAULT_SYSTEM_PREFERENCES } from '@/lib/orcamentos-ia/system-preferences'
import type { ModuleTypology } from '@/lib/orcamentos-ia/bom-engine/types'

/** Preferências efetivas usadas no desmonte (defaults da Tabela Construtiva). */
export type BomPreferences = SystemPreferences

export function resolveBomPreferences(
  prefs?: Partial<SystemPreferences> | null,
  companyId = 'default',
): BomPreferences {
  return { ...DEFAULT_SYSTEM_PREFERENCES(companyId), ...prefs, company_id: prefs?.company_id ?? companyId }
}

/**
 * Dispositivo de montagem efetivo por tipologia.
 * Nichos abertos: obrigatoriamente 100% cavilha.
 */
export function effectiveMountingDevice(
  typology: ModuleTypology,
  prefs: BomPreferences,
): BomPreferences['mounting_device'] {
  if (typology === 'nicho') return 'dowel_only'
  return prefs.mounting_device
}

export function shouldSkipBackGroove(typology: ModuleTypology, hasBack: boolean): boolean {
  if (!hasBack) return true
  if (typology === 'nicho') return true
  return false
}
