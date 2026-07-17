import type { FormaPagamento, TipoRecebimento } from '@/types'
import { todayISO } from '@/lib/utils'

export interface CobrancaReceberDraftParcela {
  numero: number
  valor: number
  vencimento: string
}

export interface CobrancaReceberDraftForm {
  clienteId: string
  total: string
  inst: string
  fdd: string
  pm: FormaPagamento
  tipo: TipoRecebimento
  descontoCartao: string
  entradaAtiva: boolean
  entradaValor: string
  entradaData: string
  entradaForma: FormaPagamento
  observacao: string
}

export interface CobrancaReceberDraft {
  form: CobrancaReceberDraftForm
  billingParcelas: CobrancaReceberDraftParcela[]
  savedAt: string
}

const DRAFT_KEY = 'movelaria-contas-receber-nova-cobranca-draft'

export function emptyCobrancaReceberDraftForm(): CobrancaReceberDraftForm {
  return {
    clienteId: '',
    total: '',
    inst: '1',
    fdd: todayISO(),
    pm: 'pix',
    tipo: 'a_vista',
    descontoCartao: '0',
    entradaAtiva: false,
    entradaValor: '',
    entradaData: todayISO(),
    entradaForma: 'pix',
    observacao: '',
  }
}

export function loadCobrancaReceberDraft(): CobrancaReceberDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CobrancaReceberDraft
    if (!parsed?.form || typeof parsed.form !== 'object') return null
    return {
      form: { ...emptyCobrancaReceberDraftForm(), ...parsed.form },
      billingParcelas: Array.isArray(parsed.billingParcelas) ? parsed.billingParcelas : [],
      savedAt: parsed.savedAt || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function saveCobrancaReceberDraft(
  form: CobrancaReceberDraftForm,
  billingParcelas: CobrancaReceberDraftParcela[] = [],
): void {
  try {
    const payload: CobrancaReceberDraft = {
      form,
      billingParcelas,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  } catch {
    /* quota ou modo privado — ignora */
  }
}

export function clearCobrancaReceberDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignora */
  }
}

export function hasCobrancaReceberDraft(): boolean {
  return loadCobrancaReceberDraft() !== null
}

/** Tem algo preenchido além dos padrões vazios? */
export function cobrancaReceberDraftHasContent(form: CobrancaReceberDraftForm): boolean {
  return Boolean(
    form.clienteId
    || form.total.trim()
    || form.observacao.trim()
    || form.entradaAtiva
    || form.entradaValor.trim()
    || form.tipo !== 'a_vista'
    || (form.inst !== '1' && form.inst !== ''),
  )
}
