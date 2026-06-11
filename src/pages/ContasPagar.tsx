import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Trash2, RefreshCw } from 'lucide-react'
import { useContasPagar } from '../hooks/useContasPagar'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field, FieldRow } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { FilterBar } from '../components/ui/FilterBar'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import { ContaPagarAnexosField } from '../components/contas-pagar/ContaPagarAnexosField'
import { ContaPagarAnexosGrupoField } from '../components/contas-pagar/ContaPagarAnexosGrupoField'
import { ContaPagarAnexosButton } from '../components/contas-pagar/ContaPagarAnexosModal'
import { getContasRelacionadas, resolveGrupoLancamentoId } from '../lib/contas-pagar-grupo'
import { ContaPagarParcelasAbertasPanel } from '../components/contas-pagar/ContaPagarParcelasAbertasPanel'
import { ContasPagarConfigButton } from '../components/contas-pagar/ContasPagarConfigModal'
import { useFormasPagamentoPagar } from '../hooks/useFormasPagamentoPagar'
import {
  clearLancamentoPagarDraft,
  hasLancamentoPagarDraft,
  loadLancamentoPagarDraft,
  saveLancamentoPagarDraft,
  type LancamentoPagarDraftForm,
} from '../lib/lancamento-pagar-draft'
import {
  revokePendingAnexoUrls,
  uploadContaPagarAnexos,
} from '../lib/contas-pagar-anexos'
import { createId, fmtCur, fmtDate, isOverdue, parseMoneyBr, todayISO } from '../lib/utils'
import {
  applyPeriodFilter,
  isSemDatasDefinidas,
  PeriodFilterBar,
  sortContasPagarSemDatas,
  type PeriodFilter,
} from '../components/ui/PeriodFilterBar'
import {
  getValorPagoConta,
  somarPagamentosNoPeriodo,
} from '../lib/contas-pagar-valores'
import type { ContaPagar, Fornecedor, PendingContaPagarAnexo } from '../types'

// ── Componente de seleção de fornecedor com busca ─────────────
const normForn = (s: string) => s.toLowerCase().replace(/[\s.]/g, '')

interface FornecedorSelectProps {
  fornecedores: Fornecedor[]
  value: string
  onChange: (id: string) => void
  getSaldoFornecedor: (id: string) => number
  contasPagar: ContaPagar[]
}

function FornecedorSelect({ fornecedores, value, onChange, getSaldoFornecedor, contasPagar }: FornecedorSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = useMemo(() => {
    const q = normForn(query)
    return q ? fornecedores.filter(f => normForn(f.nome).includes(q)) : fornecedores
  }, [fornecedores, query])

  const selected = fornecedores.find(f => f.id === value)

  const getTotalDevido = (fornecedorId: string) =>
    contasPagar
      .filter(c => c.fornecedor_id === fornecedorId && c.status !== 'pago')
      .reduce((s, c) => s + c.valor_parcela, 0)

  const handleSelect = (id: string) => {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        className="glass-input w-full"
        placeholder="Buscar fornecedor..."
        value={open ? query : (selected?.nome ?? '')}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={e => setQuery(e.target.value)}
      />
      {open && (
        <div
          className="absolute z-[200] w-full mt-1 rounded-lg border border-[rgba(212,168,83,.2)] overflow-y-auto"
          style={{ background: '#1a0f0a', boxShadow: '0 8px 32px rgba(0,0,0,.6)', maxHeight: 224 }}
        >
          <div
            className="px-3 py-2 text-sm cursor-pointer hover:bg-[rgba(212,168,83,.08)]"
            style={{ color: '#8a6a55' }}
            onClick={() => handleSelect('')}
          >
            — Nenhum —
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[#8a6a55]">Nenhum resultado.</div>
          ) : (
            filtered.map(f => {
              const saldo = getSaldoFornecedor(f.id)
              const devido = getTotalDevido(f.id)
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-[rgba(212,168,83,.08)]"
                  onClick={() => handleSelect(f.id)}
                >
                  <span style={{ color: '#f4e4d6', fontSize: '.9rem' }}>{f.nome}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {saldo > 0 && (
                      <span style={{ color: '#4ade80', fontSize: '.72rem', fontWeight: 700 }}>
                        +{fmtCur(saldo)}
                      </span>
                    )}
                    {devido > 0 && (
                      <span style={{ color: '#f87171', fontSize: '.72rem', fontWeight: 700 }}>
                        -{fmtCur(devido)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  fornecedores: Fornecedor[]
  getSaldoFornecedor: (id: string) => number
  debitarSaldo: (fornecedorId: string, valor: number, contaPagarId?: string, descricao?: string) => Promise<void>
  estornarDebitosContaPagar: (contaPagarId: string) => Promise<void>
  readOnly?: boolean
}

type Filter = 'Todos' | 'Pendente' | 'Pago' | 'Vencido'

interface EditContaForm {
  supplierId: string
  desc: string
  observacao: string
  formaPagamentoId: string
  valorParcela: string
  vencimento: string
}

function editFormFromConta(conta: ContaPagar): EditContaForm {
  return {
    supplierId: conta.fornecedor_id ?? '',
    desc: conta.descricao ?? conta.fornecedor_nome ?? '',
    observacao: conta.observacao ?? '',
    formaPagamentoId: conta.forma_pagamento_id ?? '',
    valorParcela: String(conta.valor_parcela ?? ''),
    vencimento: conta.data_vencimento ?? todayISO(),
  }
}

const getStatus = (vencimento: string, status: string): string => {
  if (status === 'pago') return 'pago'
  if (isOverdue(vencimento)) return 'vencido'
  if (status === 'parcialmente_pago') return 'parcialmente_pago'
  return 'pendente'
}

function emptyForm(defaultFormaId = ''): LancamentoPagarDraftForm {
  return {
    supplierId: '',
    desc: '',
    observacao: '',
    formaPagamentoId: defaultFormaId,
    total: '',
    inst: '1',
    fdd: todayISO(),
    recorrente: false,
    recorrenciaEncerramento: '',
  }
}

export function ContasPagar({ fornecedores, getSaldoFornecedor, debitarSaldo, estornarDebitosContaPagar, readOnly }: Props) {
  const {
    data,
    loading,
    error,
    gerarParcelas,
    criarRecorrencia,
    encerrarRecorrencia,
    marcarPago,
    reverterPagamento,
    vincularGrupoLancamento,
    editarContaPagar,
    excluirContaPagar,
  } = useContasPagar()

  const [encerrarModal, setEncerrarModal] = useState<{
    open: boolean
    recorrenciaId: string
    descricao: string
    modo: 'apagar_futuros' | 'definir_data'
    data: string
    saving: boolean
    erro: string | null
  }>({
    open: false, recorrenciaId: '', descricao: '', modo: 'apagar_futuros',
    data: todayISO(), saving: false, erro: null,
  })
  const formasHook = useFormasPagamentoPagar()
  const { formas, loading: loadingFormas } = formasHook
  const [filter, setFilter] = useState<Filter>('Todos')
  const [search, setSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(() => {
    try {
      const s = localStorage.getItem('movelaria_contaspagar_period')
      return s ? (JSON.parse(s) as PeriodFilter) : { mode: 'all' }
    } catch { return { mode: 'all' } }
  })
  const [isDefaultView, setIsDefaultView] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<LancamentoPagarDraftForm>(() => emptyForm())
  const [anexos, setAnexos] = useState<PendingContaPagarAnexo[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [draftHint, setDraftHint] = useState(false)
  const anexosRef = useRef(anexos)
  anexosRef.current = anexos
  const [editOpen, setEditOpen] = useState(false)
  const [editingConta, setEditingConta] = useState<ContaPagar | null>(null)
  const [editForm, setEditForm] = useState<EditContaForm>(() => editFormFromConta({
    id: '',
    numero_parcela: 1,
    total_parcelas: 1,
    valor_parcela: 0,
    data_vencimento: todayISO(),
    status: 'pendente',
  }))
  const [editAnexos, setEditAnexos] = useState<PendingContaPagarAnexo[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [scopePromptOpen, setScopePromptOpen] = useState(false)

  // Sentinel para identificar a opção "Caixa Fornecedor" no select de forma de pagamento
  const FORMA_CAIXA = '__caixa_fornecedor__'

  interface PagarModalState {
    open: boolean
    conta: ContaPagar | null
    valorPagarAgora: string          // quanto pagar nesta operação
    formaPagamentoId: string         // UUID normal ou FORMA_CAIXA
    valorCaixa: string               // quanto retirar do caixa (só quando FORMA_CAIXA)
    formaPagamentoRestanteId: string // forma para o restante (só quando parcial)
    saving: boolean
    erro: string | null
  }
  const [pagarModal, setPagarModal] = useState<PagarModalState>({
    open: false, conta: null, valorPagarAgora: '',
    formaPagamentoId: '', valorCaixa: '', formaPagamentoRestanteId: '', saving: false, erro: null,
  })
  const [revertingId, setRevertingId] = useState<string | null>(null)

  const defaultFormaId = formas[0]?.id ?? ''

  const f = (k: keyof LancamentoPagarDraftForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  const ef = (k: keyof EditContaForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEditForm(p => ({ ...p, [k]: e.target.value }))

  const persistDraft = useCallback((nextForm: LancamentoPagarDraftForm) => {
    saveLancamentoPagarDraft(nextForm)
    setDraftHint(true)
  }, [])

  const openManualLaunch = useCallback(() => {
    const draft = loadLancamentoPagarDraft()
    const base = emptyForm(defaultFormaId)
    if (draft?.form) {
      setForm({
        ...base,
        ...draft.form,
        formaPagamentoId: draft.form.formaPagamentoId || defaultFormaId,
        fdd: draft.form.fdd || todayISO(),
        inst: draft.form.inst || '1',
      })
      setDraftHint(true)
    } else {
      setForm(base)
      setDraftHint(false)
    }
    setAnexos([])
    setSaveError(null)
    setOpen(true)
  }, [defaultFormaId])

  const closeModalUi = useCallback(() => {
    revokePendingAnexoUrls(anexosRef.current)
    setAnexos([])
    setSaveError(null)
    setOpen(false)
  }, [])

  const closeEditModal = useCallback(() => {
    revokePendingAnexoUrls(editAnexos)
    setEditAnexos([])
    setEditError(null)
    setEditOpen(false)
    setEditingConta(null)
    setScopePromptOpen(false)
  }, [editAnexos])

  const openEditModal = useCallback((conta: ContaPagar) => {
    setEditingConta(conta)
    setEditForm(editFormFromConta(conta))
    setEditAnexos([])
    setEditError(null)
    setEditOpen(true)
  }, [])

  const selecionarParcelaParaEdicao = useCallback((conta: ContaPagar) => {
    setEditingConta(conta)
    setEditForm(editFormFromConta(conta))
    setEditError(null)
  }, [])

  /** Fecha o card mas mantém rascunho no navegador */
  const closeModalKeepDraft = useCallback(() => {
    persistDraft(form)
    closeModalUi()
  }, [form, persistDraft, closeModalUi])

  /** Descarta rascunho e fecha */
  const discardAndClose = useCallback(() => {
    clearLancamentoPagarDraft()
    setForm(emptyForm(defaultFormaId))
    setDraftHint(false)
    closeModalUi()
  }, [defaultFormaId, closeModalUi])

  // Salvamento automático enquanto o formulário está aberto
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => persistDraft(form), 450)
    return () => window.clearTimeout(timer)
  }, [form, open, persistDraft])

  const periodBase = applyPeriodFilter(data, periodFilter)
  const ocultarPagasProximoMes =
    periodFilter.mode === 'next-month' && isDefaultView && filter !== 'Pago'
  const periodFiltered = ocultarPagasProximoMes
    ? periodBase.filter(p => p.status !== 'pago')
    : periodBase

  const filtered = (() => {
    const base = periodFiltered.filter(p => {
      // 1. Filtro de Status / Modo Padrão
      if (isDefaultView) {
        if (getStatus(p.data_vencimento, p.status) === 'pago') return false
      } else if (filter !== 'Todos') {
        const s = getStatus(p.data_vencimento, p.status)
        if (filter === 'Pendente') {
          if (s !== 'pendente' && s !== 'parcialmente_pago') return false
        } else if (s !== filter.toLowerCase()) {
          return false
        }
      }

      // 2. Filtro de Busca (Fornecedor, Descrição, Valor, Data)
      if (search.trim()) {
        const term = search.toLowerCase().replace(/[\s\.\,]/g, '')

        const forn = (p.fornecedor_nome || fornecedores.find(x => x.id === p.fornecedor_id)?.nome || '').toLowerCase().replace(/[\s\.\,]/g, '')
        const desc = (p.descricao || '').toLowerCase().replace(/[\s\.\,]/g, '')
        const valor = String(p.valor_parcela).replace(/[\s\.\,]/g, '')
        const dataVenc = fmtDate(p.data_vencimento).replace(/[\s\.\,\/]/g, '')

        const match = forn.includes(term) ||
                      desc.includes(term) ||
                      valor.includes(term) ||
                      dataVenc.includes(term)

        if (!match) return false
      }

      return true
    })

    if (isSemDatasDefinidas(periodFilter)) {
      return sortContasPagarSemDatas(base)
    }

    if (!isDefaultView) return base

    return [...base].sort((a, b) => {
      const sa = getStatus(a.data_vencimento, a.status)
      const sb = getStatus(b.data_vencimento, b.status)
      if (sa === 'vencido' && sb !== 'vencido') return -1
      if (sa !== 'vencido' && sb === 'vencido') return 1
      return a.data_vencimento.localeCompare(b.data_vencimento)
    })
  })()

  // Cards: mês atual no estado padrão sem busca; ao interagir seguem os filtros ativos
  const kpiBase = (!isDefaultView || search.trim())
    ? filtered
    : applyPeriodFilter(data, { mode: 'month' })

  const kpiPeriodoPagamento: PeriodFilter =
    !isDefaultView || search.trim() ? periodFilter : { mode: 'month' }

  const totPend = kpiBase
    .filter(p => p.status !== 'pago')
    .reduce((s, p) => s + Math.max(0, p.valor_parcela - getValorPagoConta(p)), 0)
  const totPaid = somarPagamentosNoPeriodo(data, kpiPeriodoPagamento)
  const totOver = kpiBase
    .filter(p => p.status !== 'pago' && isOverdue(p.data_vencimento))
    .reduce((s, p) => s + Math.max(0, p.valor_parcela - getValorPagoConta(p)), 0)

  const save = async () => {
    const tot = parseMoneyBr(form.total)
    if (!tot || tot <= 0) return
    setSaving(true)
    setSaveError(null)
    try {
      if (form.recorrente) {
        await criarRecorrencia({
          fornecedor_id: form.supplierId || undefined,
          fornecedor_nome: fornecedores.find(s => s.id === form.supplierId)?.nome ?? form.desc,
          descricao: form.desc,
          observacao: form.observacao,
          forma_pagamento_id: form.formaPagamentoId || undefined,
          valor_mensal: tot,
          primeiro_vencimento: form.fdd || todayISO(),
          encerramento: form.recorrenciaEncerramento || undefined,
        })
      } else {
        const grupoId = createId()
        const { grupo_lancamento_id } = await gerarParcelas(
          {
            fornecedor_id: form.supplierId || undefined,
            fornecedor_nome: fornecedores.find(s => s.id === form.supplierId)?.nome ?? form.desc,
            descricao: form.desc,
            observacao: form.observacao,
            forma_pagamento_id: form.formaPagamentoId || undefined,
            valor_total: tot,
            num_parcelas: parseInt(form.inst) || 1,
            primeiro_vencimento: form.fdd || todayISO(),
          },
          grupoId,
        )

        if (anexos.length > 0 && grupo_lancamento_id) {
          await uploadContaPagarAnexos(grupo_lancamento_id, anexos)
        }
      }

      clearLancamentoPagarDraft()
      setDraftHint(false)
      revokePendingAnexoUrls(anexos)
      setAnexos([])
      setForm(emptyForm(defaultFormaId))
      closeModalUi()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar lançamento.')
    } finally {
      setSaving(false)
    }
  }

  const confirmarEncerrarRecorrencia = async () => {
    setEncerrarModal(p => ({ ...p, saving: true, erro: null }))
    try {
      await encerrarRecorrencia(
        encerrarModal.recorrenciaId,
        encerrarModal.modo,
        encerrarModal.modo === 'definir_data' ? encerrarModal.data : undefined,
      )
      setEncerrarModal(p => ({ ...p, open: false, saving: false }))
    } catch (e) {
      setEncerrarModal(p => ({
        ...p,
        saving: false,
        erro: e instanceof Error ? e.message : 'Erro ao encerrar recorrência.',
      }))
    }
  }

  const persistEdit = async (scope: 'single' | 'group') => {
    if (!editingConta) return

    const valorParcela = parseMoneyBr(editForm.valorParcela)
    if (!valorParcela || valorParcela <= 0) {
      setEditError('Informe um valor de parcela válido.')
      return
    }

    setEditSaving(true)
    setEditError(null)
    try {
      await editarContaPagar(
        editingConta,
        {
          fornecedor_id: editForm.supplierId || null,
          fornecedor_nome:
            fornecedores.find(x => x.id === editForm.supplierId)?.nome || editForm.desc || null,
          descricao: editForm.desc || null,
          observacao: editForm.observacao || null,
          forma_pagamento_id: editForm.formaPagamentoId || null,
          valor_parcela: valorParcela,
          data_vencimento: editForm.vencimento,
        },
        scope,
      )

      if (editAnexos.length > 0) {
        let grupoId = resolveGrupoLancamentoId(editingConta, data) ?? createId()
        const idsRelacionadas = getContasRelacionadas(editingConta, data).map(c => c.id)
        await vincularGrupoLancamento(editingConta.id, grupoId, idsRelacionadas)
        await uploadContaPagarAnexos(grupoId, editAnexos)
      }

      closeEditModal()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Erro ao salvar edição.')
    } finally {
      setEditSaving(false)
      setScopePromptOpen(false)
    }
  }

  const askEditScopeIfNeeded = () => {
    if (
      editingConta &&
      editingConta.total_parcelas > 1 &&
      editingConta.grupo_lancamento_id
    ) {
      setScopePromptOpen(true)
      return
    }
    void persistEdit('single')
  }

  const handleMarcarPago = (conta: ContaPagar) => {
    const restanteDevido = parseFloat(Math.max(0, conta.valor_parcela - (conta.valor_pago ?? 0)).toFixed(2))
    setPagarModal({
      open: true,
      conta,
      valorPagarAgora: String(restanteDevido),
      formaPagamentoId: defaultFormaId,
      valorCaixa: parseFloat(Math.min(
        conta.fornecedor_id ? getSaldoFornecedor(conta.fornecedor_id) : 0,
        restanteDevido,
      ).toFixed(2)).toString(),
      formaPagamentoRestanteId: defaultFormaId,
      saving: false,
      erro: null,
    })
  }

  const confirmarPagamento = async () => {
    const { conta, valorPagarAgora, formaPagamentoId, valorCaixa, formaPagamentoRestanteId } = pagarModal
    if (!conta) return
    const valorPagarAgoraNum = parseMoneyBr(valorPagarAgora) || 0
    const restanteDevido = parseFloat(Math.max(0, conta.valor_parcela - (conta.valor_pago ?? 0)).toFixed(2))
    const usarCaixa = formaPagamentoId === FORMA_CAIXA
    const valorCaixaNum = usarCaixa ? (parseMoneyBr(valorCaixa) || 0) : 0
    const saldo = conta.fornecedor_id ? getSaldoFornecedor(conta.fornecedor_id) : 0
    const restanteForma = parseFloat(Math.max(0, valorPagarAgoraNum - valorCaixaNum).toFixed(2))

    if (valorPagarAgoraNum <= 0) {
      setPagarModal(p => ({ ...p, erro: 'Informe o valor a pagar.' })); return
    }
    if (valorPagarAgoraNum > restanteDevido + 0.005) {
      setPagarModal(p => ({ ...p, erro: `Valor superior ao restante (${fmtCur(restanteDevido)}).` })); return
    }
    if (!formaPagamentoId) {
      setPagarModal(p => ({ ...p, erro: 'Selecione a forma de pagamento.' })); return
    }
    if (usarCaixa) {
      if (valorCaixaNum <= 0) { setPagarModal(p => ({ ...p, erro: 'Informe o valor a retirar do caixa.' })); return }
      if (valorCaixaNum > saldo) { setPagarModal(p => ({ ...p, erro: 'Valor superior ao saldo disponível.' })); return }
      if (valorCaixaNum > valorPagarAgoraNum) { setPagarModal(p => ({ ...p, erro: 'Valor do caixa superior ao valor a pagar.' })); return }
      if (restanteForma > 0.005 && !formaPagamentoRestanteId) {
        setPagarModal(p => ({ ...p, erro: 'Selecione a forma de pagamento para o valor restante.' })); return
      }
    }

    setPagarModal(p => ({ ...p, saving: true, erro: null }))
    try {
      if (valorCaixaNum > 0 && conta.fornecedor_id) {
        await debitarSaldo(
          conta.fornecedor_id,
          valorCaixaNum,
          conta.id,
          `Abatimento parcela ${conta.numero_parcela}/${conta.total_parcelas}`,
        )
      }
      await marcarPago(conta.id, valorPagarAgoraNum)
      setFilter('Pago')
      setIsDefaultView(false)
      setPagarModal(p => ({ ...p, open: false, conta: null, saving: false }))
    } catch (e) {
      setPagarModal(p => ({ ...p, erro: e instanceof Error ? e.message : 'Erro ao processar pagamento.', saving: false }))
    }
  }

  const handleReverterPagamento = async (conta: ContaPagar) => {
    const isParcial = conta.status === 'parcialmente_pago'
    const valorMostrar = isParcial ? (conta.valor_pago ?? 0) : conta.valor_parcela
    const ok = confirm(
      `Reverter ${isParcial ? 'o pagamento parcial' : 'o pagamento'} de ${fmtCur(valorMostrar)} (${conta.fornecedor_nome ?? conta.descricao ?? 'esta parcela'})?\n\n` +
        `Esta parcela volta para "A pagar"${isParcial ? ' e o valor pago é zerado' : ''}. A reserva no caixa referente a ela é removida.\n\n` +
        'Pagamentos já registrados manualmente no Caixa (valor consolidado do mês) não são alterados automaticamente.',
    )
    if (!ok) return
    setRevertingId(conta.id)
    setSaveError(null)
    try {
      await estornarDebitosContaPagar(conta.id)
      await reverterPagamento(conta.id)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao reverter pagamento.')
    } finally {
      setRevertingId(null)
    }
  }

  const removeConta = async (conta: ContaPagar) => {
    const shouldDelete = confirm('Deseja realmente apagar esta fatura?')
    if (!shouldDelete) return
    try {
      await excluirContaPagar(conta, 'single')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao excluir fatura.')
    }
  }

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>Contas a Pagar</h1>
          <p className="section-label mt-1">
            {periodFiltered.length} parcela{periodFiltered.length !== 1 ? 's' : ''} no período
            {hasLancamentoPagarDraft() && !open ? ' · rascunho salvo' : ''}
          </p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <ContasPagarConfigButton readOnly={readOnly} formasHook={formasHook} />
            <button type="button" className="btn btn-gold btn-md" onClick={openManualLaunch}>
              + Lançamento Manual
            </button>
          </div>
        )}
      </div>

      {saveError && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {saveError}
        </p>
      )}

      <PeriodFilterBar
        value={periodFilter}
        onChange={v => {
          setIsDefaultView(false)
          setPeriodFilter(v)
          localStorage.setItem('movelaria_contaspagar_period', JSON.stringify(v))
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { l: 'A Pagar', v: totPend, c: '#fbbf24' },
          { l: 'Pago',    v: totPaid, c: '#4ade80' },
          { l: 'Vencido', v: totOver, c: '#f87171' },
        ].map((x, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <div className="section-label mb-1">{x.l}</div>
            <div className="font-display" style={{ fontSize: '1.35rem', color: x.c }}>{fmtCur(x.v)}</div>
          </div>
        ))}
      </div>

      <Modal
        open={open}
        onClose={closeModalKeepDraft}
        title="LANÇAMENTO MANUAL — CONTAS A PAGAR"
        wide
        closeOnBackdrop={false}
      >
        {(draftHint || hasLancamentoPagarDraft()) && (
          <p className="mb-3 rounded-lg border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.08)] px-3 py-2 text-xs text-[#d4a853]">
            Seus dados são salvos automaticamente neste navegador. Ao reabrir, você continua de onde parou.
            {hasLancamentoPagarDraft() ? ' (Anexos precisam ser adicionados de novo.)' : ''}
          </p>
        )}

        <Field label="Fornecedor">
          <FornecedorSelect
            fornecedores={fornecedores}
            value={form.supplierId}
            onChange={id => setForm(p => ({ ...p, supplierId: id }))}
            getSaldoFornecedor={getSaldoFornecedor}
            contasPagar={data}
          />
        </Field>
        <Field label="Descrição / Referência">
          <input className="glass-input" value={form.desc} onChange={f('desc')} placeholder="Ex: Despesa operacional" />
        </Field>
        <Field label="Observação">
          <textarea
            className="glass-input min-h-[72px]"
            value={form.observacao}
            onChange={f('observacao')}
            placeholder="Notas internas sobre este lançamento (opcional)"
            rows={3}
          />
        </Field>
        <Field label="Forma de Pagamento">
          <select
            className="glass-input"
            value={form.formaPagamentoId}
            onChange={f('formaPagamentoId')}
            disabled={loadingFormas}
          >
            <option value="">Selecionar...</option>
            {formas.map(fp => (
              <option key={fp.id} value={fp.id}>
                {fp.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor Total (R$)">
          <input className="glass-input" type="number" value={form.total} onChange={f('total')} min="0" step="0.01" placeholder="0,00" />
        </Field>

        {/* Toggle: Única vez vs Recorrente */}
        <div className="mb-4">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '.5rem',
            }}
          >
            {([
              { label: 'Única vez', value: false, icon: '1×' },
              { label: 'Recorrente', value: true, icon: '🔄' },
            ] as const).map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setForm(p => ({ ...p, recorrente: opt.value }))}
                style={{
                  padding: '.6rem .75rem',
                  borderRadius: 8,
                  border: form.recorrente === opt.value
                    ? '1.5px solid #d4a853'
                    : '1px solid rgba(212,168,83,.2)',
                  background: form.recorrente === opt.value
                    ? 'rgba(212,168,83,.12)'
                    : 'transparent',
                  color: form.recorrente === opt.value ? '#d4a853' : '#8a6a55',
                  cursor: 'pointer',
                  fontSize: '.8rem',
                  fontWeight: 600,
                  fontFamily: 'Raleway, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '.4rem',
                  transition: 'all .15s',
                }}
              >
                <span>{opt.icon}</span> {opt.label}
              </button>
            ))}
          </div>
          {form.recorrente && (
            <p style={{ fontSize: '.72rem', color: '#8a6a55', marginTop: '.4rem' }}>
              Gera cobranças todo mês automaticamente. O sistema sempre mantém 12 meses à frente.
            </p>
          )}
        </div>

        {form.recorrente ? (
          <>
            <Field label="1º Vencimento (dia de cobrança mensal)">
              <input className="glass-input" type="date" value={form.fdd} onChange={f('fdd')} />
            </Field>
            <Field label="Encerrar em (opcional)">
              <input
                className="glass-input"
                type="date"
                value={form.recorrenciaEncerramento}
                onChange={f('recorrenciaEncerramento')}
                placeholder="Sem data de encerramento"
                min={form.fdd}
              />
            </Field>
            {parseMoneyBr(form.total) > 0 && (
              <div style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 8, padding: '.6rem .85rem', marginBottom: '.5rem' }}>
                <span style={{ color: '#fbbf24', fontSize: '.82rem' }}>
                  🔄 {fmtCur(parseMoneyBr(form.total))}/mês · 1ª: {fmtDate(form.fdd)}
                  {form.recorrenciaEncerramento ? ` · até ${fmtDate(form.recorrenciaEncerramento)}` : ' · sem data de encerramento'}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <FieldRow>
              <Field label="Nº de Parcelas" half>
                <input className="glass-input" type="number" value={form.inst} onChange={f('inst')} min="1" max="60" />
              </Field>
              <Field label="1º Vencimento" half>
                <input className="glass-input" type="date" value={form.fdd} onChange={f('fdd')} />
              </Field>
            </FieldRow>
            {form.total && parseInt(form.inst) > 0 && parseMoneyBr(form.total) > 0 && (
              <div style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 8, padding: '.6rem .85rem', marginBottom: '.5rem' }}>
                <span style={{ color: '#fbbf24', fontSize: '.82rem' }}>
                  {form.inst}× de {fmtCur(parseMoneyBr(form.total) / parseInt(form.inst))} · 1ª: {fmtDate(form.fdd)}
                </span>
              </div>
            )}
          </>
        )}

        <ContaPagarAnexosField anexos={anexos} onChange={setAnexos} />

        {saveError && <p className="mb-2 text-sm text-red-400">{saveError}</p>}

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="btn btn-outline btn-sm w-full sm:w-auto"
            onClick={discardAndClose}
          >
            Limpar rascunho
          </button>
          <ModalFormFooter
            onCancel={closeModalKeepDraft}
            onSubmit={save}
            submitLabel="Gerar Parcelas"
            submittingLabel="Gerando..."
            submitting={saving}
            submitDisabled={!form.total}
          />
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={closeEditModal}
        title="EDITAR FATURA"
        wide
        closeOnBackdrop={false}
      >
        {editingConta && (
          <ContaPagarParcelasAbertasPanel
            contaAtual={editingConta}
            todasContas={data}
            onSelecionarParcela={selecionarParcelaParaEdicao}
          />
        )}

        <Field label="Fornecedor">
          <FornecedorSelect
            fornecedores={fornecedores}
            value={editForm.supplierId}
            onChange={id => setEditForm(p => ({ ...p, supplierId: id }))}
            getSaldoFornecedor={getSaldoFornecedor}
            contasPagar={data}
          />
        </Field>
        <Field label="Descrição / Referência">
          <input className="glass-input" value={editForm.desc} onChange={ef('desc')} />
        </Field>
        <Field label="Observação">
          <textarea
            className="glass-input min-h-[72px]"
            value={editForm.observacao}
            onChange={ef('observacao')}
            rows={3}
          />
        </Field>
        <Field label="Forma de Pagamento">
          <select
            className="glass-input"
            value={editForm.formaPagamentoId}
            onChange={ef('formaPagamentoId')}
            disabled={loadingFormas}
          >
            <option value="">Selecionar...</option>
            {formas.map(fp => (
              <option key={fp.id} value={fp.id}>
                {fp.nome}
              </option>
            ))}
          </select>
        </Field>
        <FieldRow>
          <Field label="Valor da Parcela (R$)" half>
            <input className="glass-input" value={editForm.valorParcela} onChange={ef('valorParcela')} />
          </Field>
          <Field label="Vencimento" half>
            <input className="glass-input" type="date" value={editForm.vencimento} onChange={ef('vencimento')} />
          </Field>
        </FieldRow>

        {editingConta && (
          <ContaPagarAnexosGrupoField
            conta={editingConta}
            todasContas={data}
            novosAnexos={editAnexos}
            onNovosAnexosChange={setEditAnexos}
          />
        )}

        {editError && <p className="mb-2 text-sm text-red-400">{editError}</p>}

        <ModalFormFooter
          onCancel={closeEditModal}
          onSubmit={askEditScopeIfNeeded}
          submitLabel="Salvar alterações"
          submittingLabel="Salvando..."
          submitting={editSaving}
        />
      </Modal>

      <Modal
        open={scopePromptOpen}
        onClose={() => setScopePromptOpen(false)}
        title="APLICAR EM PARCELAS"
        closeOnBackdrop={false}
      >
        <p className="mb-4 text-sm text-[#f4e4d6]">
          Esta conta faz parte de um lançamento parcelado. Deseja editar apenas esta parcela ou
          também as outras parcelas do mesmo lançamento?
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => void persistEdit('single')}
            disabled={editSaving}
          >
            Apenas esta parcela
          </button>
          <button
            type="button"
            className="btn btn-gold btn-sm"
            onClick={() => void persistEdit('group')}
            disabled={editSaving}
          >
            Editar todas as parcelas
          </button>
        </div>
      </Modal>

      <FilterBar
        options={['Todos', 'Pendente', 'Pago', 'Vencido']}
        value={filter}
        onChange={v => {
          setIsDefaultView(false)
          setFilter(v as Filter)
        }}
      />

      <div className="mb-4">
        <input
          type="text"
          className="glass-input w-full"
          placeholder="Buscar por fornecedor, descrição, valor ou data..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}
        />
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : filtered.length === 0 ? (
          <EmptyState message="Nenhuma conta para este filtro." />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(212,168,83,.18)' }}>
                {['Fornecedor', 'Pagamento', 'Parcela', 'Valor Total', 'Pago', 'Restante', 'Vencimento', 'Status', ''].map((h, i) => <th key={i} className="section-label text-left px-4 py-3">{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map(p => {
                  const s = getStatus(p.data_vencimento, p.status)
                  const nomeExibido = p.fornecedor_nome ?? fornecedores.find(x => x.id === p.fornecedor_id)?.nome ?? p.descricao ?? '—'
                  return (
                    <tr key={p.id} className="trow">
                      <td className="px-4 py-3" style={{ color: '#f4e4d6', maxWidth: 220 }}>
                        <div className="flex items-center gap-1.5">
                          {p.recorrente && (
                            <RefreshCw
                              className="shrink-0 text-[#d4a853]"
                              style={{ width: 11, height: 11 }}
                              title="Cobrança recorrente"
                            />
                          )}
                          <span>{nomeExibido}</span>
                        </div>
                        {p.fornecedor_id && getSaldoFornecedor(p.fornecedor_id) > 0 && s !== 'pago' && (
                          <div className="mt-0.5 text-[0.72rem]" style={{ color: '#4ade80' }}>
                            Saldo: {fmtCur(getSaldoFornecedor(p.fornecedor_id))}
                          </div>
                        )}
                        {p.observacao ? (
                          <p
                            className="mt-1 line-clamp-2 text-[0.75rem] italic text-[#8a6a55]"
                            title={p.observacao}
                          >
                            {p.observacao}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[0.82rem] text-[#8a6a55]">
                        {p.movelaria_formas_pagamento_pagar?.nome ?? '—'}
                      </td>
                      <td className="px-4 py-3" style={{ color: '#8a6a55', fontSize: '.85rem' }}>{p.numero_parcela}/{p.total_parcelas}</td>
                      <td className="px-4 py-3" style={{ color: '#d4a853', fontWeight: 600 }}>{fmtCur(p.valor_parcela)}</td>
                      <td className="px-4 py-3" style={{ color: getValorPagoConta(p) > 0 ? '#4ade80' : '#4a5568', fontWeight: 600 }}>{fmtCur(getValorPagoConta(p))}</td>
                      <td className="px-4 py-3" style={{ color: p.status === 'pago' ? '#4ade80' : '#f4e4d6', fontWeight: 600 }}>{fmtCur(Math.max(0, p.valor_parcela - getValorPagoConta(p)))}</td>
                      <td className="px-4 py-3" style={{ color: s === 'vencido' ? '#f87171' : '#8a6a55', fontSize: '.85rem' }}>{fmtDate(p.data_vencimento)}</td>
                      <td className="px-4 py-3"><Badge status={s} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <ContaPagarAnexosButton conta={p} todasContas={data} />
                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm !px-2"
                                title="Editar fatura"
                                onClick={() => openEditModal(p)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {p.recorrente && p.recorrencia_id && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  title="Encerrar recorrência"
                                  onClick={() => setEncerrarModal({
                                    open: true,
                                    recorrenciaId: p.recorrencia_id!,
                                    descricao: nomeExibido,
                                    modo: 'apagar_futuros',
                                    data: todayISO(),
                                    saving: false,
                                    erro: null,
                                  })}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-danger btn-sm !px-2"
                                title="Apagar fatura"
                                onClick={() => void removeConta(p)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {!readOnly && s !== 'pago' ? (
                            <>
                              <button type="button" className="btn btn-success btn-sm" onClick={() => handleMarcarPago(p)}>
                                {s === 'parcialmente_pago' ? '+ Pagar mais' : '✓ Marcar Pago'}
                              </button>
                              {s === 'parcialmente_pago' && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  title="Zerar pagamento parcial"
                                  disabled={revertingId === p.id}
                                  onClick={() => void handleReverterPagamento(p)}
                                >
                                  {revertingId === p.id ? 'Revertendo…' : '↩ Zerar'}
                                </button>
                              )}
                            </>
                          ) : !readOnly && s === 'pago' ? (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              title={`Pago em ${fmtDate(p.data_pagamento)} — clique para reverter`}
                              disabled={revertingId === p.id}
                              onClick={() => void handleReverterPagamento(p)}
                            >
                              {revertingId === p.id ? 'Revertendo…' : `↩ Reverter (${fmtDate(p.data_pagamento)})`}
                            </button>
                          ) : s === 'pago' ? (
                            <span style={{ color: '#4ade80', fontSize: '.75rem' }}>✓ {fmtDate(p.data_pagamento)}</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal — Encerrar Recorrência */}
      <Modal
        open={encerrarModal.open}
        onClose={() => !encerrarModal.saving && setEncerrarModal(p => ({ ...p, open: false }))}
        title="ENCERRAR RECORRÊNCIA"
        closeOnBackdrop={false}
      >
        <p className="mb-4 text-sm" style={{ color: '#f4e4d6' }}>
          <strong style={{ color: '#d4a853' }}>{encerrarModal.descricao}</strong>
          {' '}— Como deseja encerrar esta cobrança recorrente?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginBottom: '1rem' }}>
          {([
            { label: 'Apagar meses futuros', value: 'apagar_futuros', desc: 'Remove todas as parcelas pendentes a partir de hoje' },
            { label: 'Definir data de término', value: 'definir_data', desc: 'Mantém parcelas até a data escolhida, remove o restante' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setEncerrarModal(p => ({ ...p, modo: opt.value }))}
              style={{
                padding: '.65rem .75rem',
                borderRadius: 8,
                border: encerrarModal.modo === opt.value
                  ? '1.5px solid #f87171'
                  : '1px solid rgba(248,113,113,.2)',
                background: encerrarModal.modo === opt.value
                  ? 'rgba(248,113,113,.1)'
                  : 'transparent',
                color: encerrarModal.modo === opt.value ? '#f87171' : '#8a6a55',
                cursor: 'pointer',
                fontSize: '.75rem',
                fontWeight: 600,
                fontFamily: 'Raleway, sans-serif',
                textAlign: 'left',
                transition: 'all .15s',
              }}
            >
              <div>{opt.label}</div>
              <div style={{ fontSize: '.68rem', opacity: .7, marginTop: '.2rem', fontWeight: 400 }}>{opt.desc}</div>
            </button>
          ))}
        </div>

        {encerrarModal.modo === 'definir_data' && (
          <Field label="Encerrar em (última parcela a manter)">
            <input
              className="glass-input"
              type="date"
              value={encerrarModal.data}
              onChange={e => setEncerrarModal(p => ({ ...p, data: e.target.value }))}
            />
          </Field>
        )}

        {encerrarModal.erro && <p className="mb-2 text-sm text-red-400">{encerrarModal.erro}</p>}

        <ModalFormFooter
          onCancel={() => setEncerrarModal(p => ({ ...p, open: false }))}
          onSubmit={confirmarEncerrarRecorrencia}
          submitLabel="Confirmar Encerramento"
          submittingLabel="Encerrando..."
          submitting={encerrarModal.saving}
        />
      </Modal>

      {/* Modal — Marcar como pago */}
      <Modal
        open={pagarModal.open}
        onClose={() => !pagarModal.saving && setPagarModal(p => ({ ...p, open: false, conta: null }))}
        title="MARCAR COMO PAGO"
        closeOnBackdrop={false}
      >
        {pagarModal.conta && (() => {
          const conta = pagarModal.conta!
          const nomeForn = conta.fornecedor_nome ?? fornecedores.find(x => x.id === conta.fornecedor_id)?.nome ?? null
          const saldo = conta.fornecedor_id ? getSaldoFornecedor(conta.fornecedor_id) : 0
          const valorPagoAtual = conta.valor_pago ?? 0
          const restanteDevido = parseFloat(Math.max(0, conta.valor_parcela - valorPagoAtual).toFixed(2))
          const valorPagarAgoraNum = parseMoneyBr(pagarModal.valorPagarAgora) || 0
          const usarCaixa = pagarModal.formaPagamentoId === FORMA_CAIXA
          const valorCaixaNum = usarCaixa ? (parseMoneyBr(pagarModal.valorCaixa) || 0) : 0
          const maxCaixa = parseFloat(Math.min(saldo, valorPagarAgoraNum || restanteDevido).toFixed(2))
          const restanteForma = parseFloat(Math.max(0, valorPagarAgoraNum - valorCaixaNum).toFixed(2))
          const quitado = usarCaixa && restanteForma < 0.01
          return (
            <>
              {/* Cards: Valor Total | Já Pago | Restante */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div style={{ background: 'rgba(212,168,83,.06)', border: '1px solid rgba(212,168,83,.2)', borderRadius: 8, padding: '.6rem .75rem' }}>
                  <div className="text-xs text-[#8a6a55] mb-1">Valor Total</div>
                  <div className="font-display" style={{ fontSize: '1.05rem', color: '#d4a853' }}>{fmtCur(conta.valor_parcela)}</div>
                </div>
                <div style={{ background: 'rgba(74,222,128,.06)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, padding: '.6rem .75rem' }}>
                  <div className="text-xs text-[#8a6a55] mb-1">Já Pago</div>
                  <div className="font-display" style={{ fontSize: '1.05rem', color: valorPagoAtual > 0 ? '#4ade80' : '#8a6a55' }}>{fmtCur(valorPagoAtual)}</div>
                </div>
                <div style={{ background: 'rgba(248,113,113,.06)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 8, padding: '.6rem .75rem' }}>
                  <div className="text-xs text-[#8a6a55] mb-1">Restante</div>
                  <div className="font-display" style={{ fontSize: '1.05rem', color: '#f87171' }}>{fmtCur(restanteDevido)}</div>
                </div>
              </div>

              {/* Caixa do fornecedor (se houver saldo) */}
              {nomeForn && saldo > 0 && (
                <div style={{ background: 'rgba(74,222,128,.04)', border: '1px solid rgba(74,222,128,.15)', borderRadius: 6, padding: '.4rem .75rem', marginBottom: '.75rem' }}>
                  <span className="text-xs text-[#8a6a55]">Caixa — {nomeForn}: </span>
                  <span style={{ fontWeight: 700, color: '#4ade80', fontSize: '.85rem' }}>{fmtCur(saldo)} disponível</span>
                </div>
              )}

              {/* Campo: quanto pagar agora */}
              <Field label="Valor a pagar agora (R$)">
                <input
                  className="glass-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={restanteDevido}
                  value={pagarModal.valorPagarAgora}
                  onChange={e => {
                    const v = e.target.value
                    const num = parseMoneyBr(v) || 0
                    const novoMaxCaixa = parseFloat(Math.min(saldo, num).toFixed(2))
                    setPagarModal(p => ({
                      ...p,
                      valorPagarAgora: v,
                      valorCaixa: p.formaPagamentoId === FORMA_CAIXA
                        ? String(novoMaxCaixa)
                        : p.valorCaixa,
                      erro: null,
                    }))
                  }}
                />
              </Field>
              {valorPagarAgoraNum > 0 && valorPagarAgoraNum < restanteDevido - 0.005 && (
                <p style={{ fontSize: '.72rem', color: '#93c5fd', marginBottom: '.5rem', marginTop: '-.25rem' }}>
                  Pagamento parcial — restará {fmtCur(restanteDevido - valorPagarAgoraNum)} após este lançamento.
                </p>
              )}

              {/* Forma de pagamento — com opção de caixa embutida */}
              <Field label="Forma de Pagamento">
                <select
                  className="glass-input"
                  value={pagarModal.formaPagamentoId}
                  onChange={e => {
                    const v = e.target.value
                    const num = parseMoneyBr(pagarModal.valorPagarAgora) || restanteDevido
                    setPagarModal(p => ({
                      ...p,
                      formaPagamentoId: v,
                      valorCaixa: v === FORMA_CAIXA
                        ? String(parseFloat(Math.min(saldo, num).toFixed(2)))
                        : p.valorCaixa,
                      erro: null,
                    }))
                  }}
                  disabled={loadingFormas}
                >
                  <option value="">Selecionar...</option>
                  {saldo > 0 && (
                    <option value={FORMA_CAIXA}>
                      Retirar do Caixa do Fornecedor — {fmtCur(saldo)} disponível
                    </option>
                  )}
                  {formas.map(fp => <option key={fp.id} value={fp.id}>{fp.nome}</option>)}
                </select>
              </Field>

              {/* Campos extras quando "Caixa Fornecedor" é selecionado */}
              {usarCaixa && (
                <div style={{ background: 'rgba(74,222,128,.04)', border: '1px solid rgba(74,222,128,.18)', borderRadius: 8, padding: '.75rem 1rem', marginBottom: '.5rem' }}>
                  <Field label={`Valor a retirar do caixa (máx. ${fmtCur(maxCaixa)})`}>
                    <input
                      className="glass-input"
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={maxCaixa}
                      value={pagarModal.valorCaixa}
                      onChange={e => setPagarModal(p => ({ ...p, valorCaixa: e.target.value, erro: null }))}
                    />
                  </Field>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-[#8a6a55]">Restante a pagar (outra forma):</span>
                    <span style={{ fontWeight: 700, fontSize: '.9rem', color: quitado ? '#4ade80' : '#f4e4d6' }}>
                      {quitado ? '✓ Coberto pelo caixa' : fmtCur(restanteForma)}
                    </span>
                  </div>

                  {/* Forma de pagamento do restante quando parcial */}
                  {restanteForma > 0.005 && (
                    <div className="mt-3">
                      <Field label={`Forma de pagamento do restante — ${fmtCur(restanteForma)}`}>
                        <select
                          className="glass-input"
                          value={pagarModal.formaPagamentoRestanteId}
                          onChange={e => setPagarModal(p => ({ ...p, formaPagamentoRestanteId: e.target.value, erro: null }))}
                          disabled={loadingFormas}
                        >
                          <option value="">Selecionar...</option>
                          {formas.map(fp => <option key={fp.id} value={fp.id}>{fp.nome}</option>)}
                        </select>
                      </Field>
                    </div>
                  )}
                </div>
              )}

              {pagarModal.erro && <p className="mb-2 text-sm text-red-400">{pagarModal.erro}</p>}

              <ModalFormFooter
                onCancel={() => setPagarModal(p => ({ ...p, open: false, conta: null }))}
                onSubmit={confirmarPagamento}
                submitLabel="Confirmar Pagamento"
                submittingLabel="Processando..."
                submitting={pagarModal.saving}
              />
            </>
          )
        })()}
      </Modal>
    </div>
  )
}
