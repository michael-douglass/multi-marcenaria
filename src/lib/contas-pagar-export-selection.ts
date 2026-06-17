import type { PeriodFilter } from '@/components/ui/PeriodFilterBar'

const STORAGE_KEY = 'movelaria_contaspagar_export_selection'

export interface ExportSelectionSnapshot {
  selectedIds: string[]
  /** Quando true, novas contas do período entram selecionadas automaticamente. */
  allSelected: boolean
  statuses: string[]
}

type ExportSelectionStore = Record<string, ExportSelectionSnapshot>

export function getPeriodStorageKey(period: PeriodFilter): string {
  switch (period.mode) {
    case 'fixed-month':
      return `fixed-month:${period.month ?? ''}`
    case 'fixed-day':
      return `fixed-day:${period.day ?? ''}`
    case 'date-range':
      return `range:${period.from ?? ''}:${period.to ?? ''}`
    default:
      return period.mode
  }
}

function readStore(): ExportSelectionStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ExportSelectionStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: ExportSelectionStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore quota / private mode
  }
}

export function loadExportSelection(periodKey: string): ExportSelectionSnapshot | null {
  const snapshot = readStore()[periodKey]
  if (!snapshot || !Array.isArray(snapshot.selectedIds)) return null
  return {
    selectedIds: snapshot.selectedIds,
    allSelected: snapshot.allSelected === true,
    statuses: Array.isArray(snapshot.statuses) ? snapshot.statuses : [],
  }
}

export function saveExportSelection(periodKey: string, snapshot: ExportSelectionSnapshot): void {
  const store = readStore()
  store[periodKey] = snapshot
  writeStore(store)
}

export function clearExportSelection(periodKey: string): void {
  const store = readStore()
  delete store[periodKey]
  writeStore(store)
}

export function resolveSelectedIds(
  contaIds: string[],
  saved: ExportSelectionSnapshot | null,
): Set<string> {
  const valid = new Set(contaIds)
  if (!saved) return new Set(contaIds)

  if (saved.allSelected) return new Set(contaIds)

  const restored = saved.selectedIds.filter(id => valid.has(id))
  return new Set(restored)
}
