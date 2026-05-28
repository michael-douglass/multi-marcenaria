export interface LancamentoPagarDraftForm {
  supplierId: string
  desc: string
  observacao: string
  formaPagamentoId: string
  total: string
  inst: string
  fdd: string
}

export interface LancamentoPagarDraft {
  form: LancamentoPagarDraftForm
  savedAt: string
}

const DRAFT_KEY = 'movelaria-contas-pagar-lancamento-draft'

export function loadLancamentoPagarDraft(): LancamentoPagarDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LancamentoPagarDraft
    if (!parsed?.form || typeof parsed.form !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function saveLancamentoPagarDraft(form: LancamentoPagarDraftForm): void {
  try {
    const payload: LancamentoPagarDraft = { form, savedAt: new Date().toISOString() }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  } catch {
    /* quota ou modo privado — ignora */
  }
}

export function clearLancamentoPagarDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignora */
  }
}

export function hasLancamentoPagarDraft(): boolean {
  return loadLancamentoPagarDraft() !== null
}
