import type { FornecedorInput } from '../types'

export interface FornecedorDraft {
  editId: string | null
  form: FornecedorInput
  savedAt: string
}

const DRAFT_KEY = 'movelaria-fornecedor-form-draft'

export function loadFornecedorDraft(): FornecedorDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FornecedorDraft
    if (!parsed?.form || typeof parsed.form !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function saveFornecedorDraft(editId: string | null, form: FornecedorInput): void {
  try {
    const payload: FornecedorDraft = {
      editId,
      form,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  } catch {
    /* ignora */
  }
}

export function clearFornecedorDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignora */
  }
}

export function hasFornecedorDraft(): boolean {
  return loadFornecedorDraft() !== null
}
