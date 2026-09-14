import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  Banknote,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useFinanceData } from '@/context/FinanceDataContext'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field, FieldRow } from '../components/ui/Field'
import { Badge } from '../components/ui/badge'
import { FilterBar } from '../components/ui/FilterBar'
import { DateInput } from '../components/ui/DateInput'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import { ContaPagarAnexosField } from '../components/contas-pagar/ContaPagarAnexosField'
import { ContaPagarAnexosGrupoField } from '../components/contas-pagar/ContaPagarAnexosGrupoField'
import { ContaPagarAnexosButton } from '../components/contas-pagar/ContaPagarAnexosModal'
import { getContasRelacionadas, getDetalhesExibicaoContaPagar, getModeloRecorrencia, getPrimeiraParcela, lancamentoTemParcelamento, resolveGrupoLancamentoId } from '../lib/contas-pagar-grupo'
import { ContaPagarParcelasAbertasPanel } from '../components/contas-pagar/ContaPagarParcelasAbertasPanel'
import { ContasPagarConfigButton } from '../components/contas-pagar/ContasPagarConfigModal'
import { ContasPagarExportButton } from '../components/contas-pagar/ContasPagarExportButton'
import { ContasPagarListaPdfExportButton } from '../components/contas-pagar/ContasPagarListaPdfExportButton'
import { ContasPagarImportButton } from '../components/contas-pagar/ContasPagarImportButton'
import { ContasPagarSelecaoPopup } from '../components/contas-pagar/ContasPagarSelecaoPopup'
import { ContasPagarPageAura } from '../components/contas-pagar/ContasPagarPageAura'
import { ContasPagarPanelStatusFilter } from '../components/contas-pagar/ContasPagarPanelStatusFilter'
import { useEmpresa } from '@/contexts/EmpresaContext'
import type { ContasPagarListaPdfExportInput } from '@/lib/contas-pagar-lista-pdf-export'
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
import { createId, cn, fmtCur, fmtDate, isOverdue, parseMoneyBr, todayISO, addMonths } from '../lib/utils'
import { normalizeObraDate, parseIsoDate } from '../lib/date-br'
import {
  applyPeriodFilter,
  isPeriodoAtivo,
  isVencimentoNoMesAtual,
  monthLabel,
  PeriodFilterBar,
  sortContasPagarSemDatas,
  type PeriodFilter,
} from '../components/ui/PeriodFilterBar'
import {
  getValorPagoConta,
  getValorTotalLancamento,
  normalizarValorBusca,
} from '../lib/contas-pagar-valores'
import type { ContaPagar, Fornecedor, PendingContaPagarAnexo } from '../types'
import { CaixaPopup } from '@/components/layout/CaixaPopup'

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
          className="absolute z-[200] w-full mt-1 rounded-lg border border-[rgba(240,210,140,.2)] overflow-y-auto"
          style={{ background: '#1a0f0a', boxShadow: '0 8px 32px rgba(0,0,0,.6)', maxHeight: 224 }}
        >
          <div
            className="px-3 py-2 text-sm cursor-pointer hover:bg-[rgba(240,210,140,.08)]"
            style={{ color: '#edd9c4' }}
            onClick={() => handleSelect('')}
          >
            — Nenhum —
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[#edd9c4]">Nenhum resultado.</div>
          ) : (
            filtered.map(f => {
              const saldo = getSaldoFornecedor(f.id)
              const devido = getTotalDevido(f.id)
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-[rgba(240,210,140,.08)]"
                  onClick={() => handleSelect(f.id)}
                >
                  <span style={{ color: '#fffaf4', fontSize: '.9rem' }}>{f.nome}</span>
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

interface EditContaForm {
  supplierId: string
  desc: string
  observacao: string
  formaPagamentoId: string
  valorParcela: string
  vencimento: string
  primeiroVencimentoParcelado: string
  recorrenciaValorMensal: string
  recorrenciaDiaMensal: string
  recorrenciaEncerramento: string
  aplicarValorFuturas: boolean
}

interface RecorrenciaEdicaoSnapshot {
  encerramento: string
  diaMensal: string
}

function diaFromIso(iso: string): string {
  return String(parseIsoDate(normalizeObraDate(iso) ?? iso)?.day ?? 1)
}

function editFormFromConta(conta: ContaPagar, todasContas?: ContaPagar[]): EditContaForm {
  const vencimento = normalizeObraDate(conta.data_vencimento) ?? todayISO()
  let textoRef = conta
  if (conta.recorrente && conta.recorrencia_id && todasContas?.length) {
    const serie = todasContas.filter(c => c.recorrencia_id === conta.recorrencia_id)
    if (serie.length > 0) textoRef = getModeloRecorrencia(serie)
  }
  const primeira =
    todasContas?.length
      ? getPrimeiraParcela(conta, todasContas)
      : conta
  const primeiroVencimento =
    normalizeObraDate(primeira.data_vencimento) ?? vencimento
  return {
    supplierId: conta.fornecedor_id ?? '',
    desc: textoRef.descricao ?? conta.fornecedor_nome ?? '',
    observacao: textoRef.observacao ?? '',
    formaPagamentoId: conta.forma_pagamento_id ?? '',
    valorParcela: String(conta.valor_parcela ?? ''),
    vencimento,
    primeiroVencimentoParcelado: primeiroVencimento,
    recorrenciaValorMensal: String(conta.recorrencia_valor_base ?? conta.valor_parcela ?? ''),
    recorrenciaDiaMensal: diaFromIso(vencimento),
    recorrenciaEncerramento: normalizeObraDate(conta.recorrencia_encerramento) ?? '',
    aplicarValorFuturas: true,
  }
}

const getStatus = (vencimento: string, status: string): string => {
  if (status === 'pago') return 'pago'
  // Parcial tem prioridade sobre vencido: senão o filtro "Pago" some
  // com o botão "Zerar" quando a parcela já venceu (ex.: pró-labore).
  if (status === 'parcialmente_pago') return 'parcialmente_pago'
  if (isOverdue(vencimento)) return 'vencido'
  return 'pendente'
}

const STATUS_FILTER_OPTIONS = ['Pendente', 'Pago', 'Vencido'] as const
type StatusFilterOption = (typeof STATUS_FILTER_OPTIONS)[number]

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
  const { empresa } = useEmpresa()
  // Usa o mesmo store do FinanceDataProvider — evita 2º useContasPagar()
  // (dois canais realtime com o mesmo nome quebram a página).
  const {
    data,
    loading,
    error,
    gerarParcelas,
    criarRecorrencia,
    encerrarRecorrencia,
    atualizarRecorrencia,
    marcarPago,
    reverterPagamento,
    vincularGrupoLancamento,
    editarContaPagar,
    excluirContaPagar,
    excluirContasPagarPorIds,
    marcarPagoEmLote,
    importarCobrancasUnicas,
  } = useFinanceData().contasPagar

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
  const [activeFilters, setActiveFilters] = useState<StatusFilterOption[]>([])
  const [search, setSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(() => {
    try {
      const s = localStorage.getItem('movelaria_contaspagar_period')
      return s ? (JSON.parse(s) as PeriodFilter) : { mode: 'all' }
    } catch { return { mode: 'all' } }
  })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<LancamentoPagarDraftForm>(() => emptyForm())
  const [anexos, setAnexos] = useState<PendingContaPagarAnexo[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [draftHint, setDraftHint] = useState(false)
  const anexosRef = useRef(anexos)
  anexosRef.current = anexos
  const recorrenciaEdicaoRef = useRef<RecorrenciaEdicaoSnapshot>({
    encerramento: '',
    diaMensal: '1',
  })
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
  const [caixaOpen, setCaixaOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [scopePromptOpen, setScopePromptOpen] = useState(false)
  const [deleteScopeOpen, setDeleteScopeOpen] = useState(false)
  const [contaToDelete, setContaToDelete] = useState<ContaPagar | null>(null)
  const [deleting, setDeleting] = useState(false)

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
  const pagarSavingRef = useRef(false)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [bulkPayModalOpen, setBulkPayModalOpen] = useState(false)

  const [ocultarOpen, setOcultarOpen] = useState(false)
  const [ocultarStatuses, setOcultarStatuses] = useState<Set<string>>(new Set())
  const [ocultarIds, setOcultarIds] = useState<Set<string>>(new Set())
  const [ocultarBusca, setOcultarBusca] = useState('')
  const ocultarRef = useRef<HTMLDivElement>(null)

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

  const bindRecorrenciaSnapshot = useCallback((conta: ContaPagar) => {
    const vencimento = normalizeObraDate(conta.data_vencimento) ?? todayISO()
    recorrenciaEdicaoRef.current = {
      encerramento: normalizeObraDate(conta.recorrencia_encerramento) ?? '',
      diaMensal: diaFromIso(vencimento),
    }
  }, [])

  const openEditModal = useCallback((conta: ContaPagar) => {
    bindRecorrenciaSnapshot(conta)
    setEditingConta(conta)
    setEditForm(editFormFromConta(conta, data))
    setEditAnexos([])
    setEditError(null)
    setEditOpen(true)
  }, [bindRecorrenciaSnapshot, data])

  const selecionarParcelaParaEdicao = useCallback((conta: ContaPagar) => {
    bindRecorrenciaSnapshot(conta)
    setEditingConta(conta)
    setEditForm(editFormFromConta(conta, data))
    setEditError(null)
  }, [bindRecorrenciaSnapshot, data])

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

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ocultarRef.current && !ocultarRef.current.contains(e.target as Node)) setOcultarOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Salvamento automático enquanto o formulário está aberto
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => persistDraft(form), 450)
    return () => window.clearTimeout(timer)
  }, [form, open, persistDraft])

  const isDefaultView = activeFilters.length === 0
  const periodoLabel = useMemo(() => {
    if (periodFilter.mode === 'fixed-month' && periodFilter.month) {
      return monthLabel(periodFilter.month)
    }
    if (periodFilter.mode === 'month') return 'este mês'
    if (periodFilter.mode === 'next-month') return 'próximo mês'
    if (periodFilter.mode === 'next-6m') return 'próximos 6 meses'
    if (periodFilter.mode === 'fixed-day' && periodFilter.day) return fmtDate(periodFilter.day)
    if (periodFilter.mode === 'date-range') {
      const from = periodFilter.from ? fmtDate(periodFilter.from) : '…'
      const to = periodFilter.to ? fmtDate(periodFilter.to) : '…'
      return `${from} – ${to}`
    }
    return null
  }, [periodFilter])
  const activeFilterSet = useMemo(() => new Set(activeFilters), [activeFilters])

  const periodBase = applyPeriodFilter(data, periodFilter)
  const ocultarPagasProximoMes =
    periodFilter.mode === 'next-month' && isDefaultView
  const periodFiltered = ocultarPagasProximoMes
    ? periodBase.filter(p => p.status !== 'pago')
    : periodBase

  // idsOcultos: apenas IDs marcados individualmente — status pills só filtram a lista do dropdown
  const idsOcultos = ocultarIds

  const hasCardsFiltroAtivo = useMemo(
    () =>
      activeFilters.length > 0
      || search.trim().length > 0
      || periodFilter.mode !== 'all'
      || idsOcultos.size > 0,
    [activeFilters, search, periodFilter.mode, idsOcultos.size],
  )

  const matchesSearch = useCallback((p: ContaPagar) => {
    if (!search.trim()) return true
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[\s.,]/g, '')
    const term = norm(search)
    if (!term) return true
    const forn = norm(p.fornecedor_nome || fornecedores.find(x => x.id === p.fornecedor_id)?.nome || '')
    const desc = norm(p.descricao || '')
    const obs = norm(p.observacao || '')
    const valor = normalizarValorBusca(p.valor_parcela)
    const valorTotalLanc = getValorTotalLancamento(p, data)
    const valorTotal = valorTotalLanc != null ? normalizarValorBusca(valorTotalLanc) : ''
    const dataVenc = fmtDate(p.data_vencimento).replace(/[\s.,/]/g, '')
    return forn.includes(term) || desc.includes(term) || obs.includes(term) || valor.includes(term) || valorTotal.includes(term) || dataVenc.includes(term)
  }, [search, fornecedores, data])

  const periodoAtivo = isPeriodoAtivo(periodFilter)

  const matchesStatusFilter = useCallback((p: ContaPagar, forList: boolean) => {
    const s = getStatus(p.data_vencimento, p.status)
    if (isDefaultView) {
      // Sem período fixo: esconde pagas na lista (foco no que ainda falta pagar).
      // Com mês/período selecionado: mostra tudo daquele recorte, inclusive pagas.
      if (forList && !periodoAtivo && s === 'pago') return false
      return true
    }
    return (
      (activeFilterSet.has('Pendente') && (s === 'pendente' || s === 'parcialmente_pago')) ||
      // "Pago" inclui parcial: há valor já pago que dá para ver e desfazer.
      (activeFilterSet.has('Pago') && (s === 'pago' || s === 'parcialmente_pago')) ||
      (activeFilterSet.has('Vencido') && (
        s === 'vencido' || (s === 'parcialmente_pago' && isOverdue(p.data_vencimento))
      ))
    )
  }, [isDefaultView, activeFilterSet, periodoAtivo])

  const ocultarListaFiltrada = useMemo(() => {
    let items = periodFiltered

    // Pills de status filtram a lista do dropdown (não ocultam da tabela)
    if (ocultarStatuses.size > 0 && !ocultarStatuses.has('todos')) {
      items = items.filter(c => {
        const s = getStatus(c.data_vencimento, c.status)
        return ocultarStatuses.has(s)
      })
    }

    const term = ocultarBusca.trim().toLowerCase().replace(/[\s.,]/g, '')
    if (term) {
      items = items.filter(c => {
        const nome = (c.fornecedor_nome ?? fornecedores.find(x => x.id === c.fornecedor_id)?.nome ?? c.descricao ?? '').toLowerCase().replace(/[\s.,]/g, '')
        const desc = (c.descricao ?? '').toLowerCase().replace(/[\s.,]/g, '')
        const obs = (c.observacao ?? '').toLowerCase().replace(/[\s.,]/g, '')
        return nome.includes(term) || desc.includes(term) || obs.includes(term)
      })
    }

    return items.slice(0, 60)
  }, [periodFiltered, ocultarStatuses, ocultarBusca, fornecedores])

  const baseFiltered = useMemo(
    () => periodFiltered.filter(p => !idsOcultos.has(p.id) && matchesSearch(p)),
    [periodFiltered, idsOcultos, matchesSearch],
  )

  const kpiSource = useMemo(
    () => baseFiltered.filter(p => matchesStatusFilter(p, false)),
    [baseFiltered, matchesStatusFilter],
  )

  const kpiCards = useMemo(() => {
    const restante = (p: ContaPagar) =>
      Math.max(0, p.valor_parcela - getValorPagoConta(p))

    if (hasCardsFiltroAtivo) {
      return [
        {
          label: 'A pagar',
          hint: 'ainda sai do caixa neste recorte',
          value: kpiSource.filter(p => p.status !== 'pago').reduce((s, p) => s + restante(p), 0),
          tone: 'gold' as const,
          icon: Wallet,
        },
        {
          label: 'Pago',
          hint: 'já saiu do caixa',
          value: kpiSource.reduce((s, p) => s + getValorPagoConta(p), 0),
          tone: 'ok' as const,
          icon: Banknote,
        },
        {
          label: 'Vencido',
          hint: 'passou do vencimento',
          value: kpiSource
            .filter(p => p.status !== 'pago' && isOverdue(p.data_vencimento))
            .reduce((s, p) => s + restante(p), 0),
          tone: 'late' as const,
          icon: AlertCircle,
        },
      ]
    }

    const baseKpi = data.filter(p => !idsOcultos.has(p.id))

    return [
      {
        label: 'A pagar',
        hint: 'vencimento neste mês',
        value: baseKpi
          .filter(p => isVencimentoNoMesAtual(p.data_vencimento) && p.status !== 'pago')
          .reduce((s, p) => s + restante(p), 0),
        tone: 'gold' as const,
        icon: Wallet,
      },
      {
        label: 'Pago',
        hint: 'pago neste mês',
        value: baseKpi
          .filter(p => isVencimentoNoMesAtual(p.data_vencimento))
          .reduce((s, p) => s + getValorPagoConta(p), 0),
        tone: 'ok' as const,
        icon: Banknote,
      },
      {
        label: 'Vencidas',
        hint: 'todas as que atrasaram',
        value: baseKpi
          .filter(p => p.status !== 'pago' && isOverdue(p.data_vencimento))
          .reduce((s, p) => s + restante(p), 0),
        tone: 'late' as const,
        icon: AlertCircle,
      },
    ]
  }, [hasCardsFiltroAtivo, kpiSource, data, idsOcultos])

  const filtered = useMemo(() => {
    const base = baseFiltered.filter(p => matchesStatusFilter(p, true))
    return sortContasPagarSemDatas(base)
  }, [baseFiltered, matchesStatusFilter])

  const selectedContas = useMemo(() => {
    if (selectedRowIds.size === 0) return [] as ContaPagar[]
    const byId = new Map(data.map(p => [p.id, p]))
    const ordered: ContaPagar[] = []
    for (const id of selectedRowIds) {
      const conta = byId.get(id)
      if (conta) ordered.push(conta)
    }
    return ordered
  }, [data, selectedRowIds])

  const selectedParaPagar = useMemo(
    () => selectedContas.filter(p => p.status !== 'pago'),
    [selectedContas],
  )

  const totalRestanteSelecionado = useMemo(
    () => selectedParaPagar.reduce(
      (sum, p) => sum + Math.max(0, p.valor_parcela - getValorPagoConta(p)),
      0,
    ),
    [selectedParaPagar],
  )

  const toggleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback((checked: boolean) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev)
      if (checked) filtered.forEach(p => next.add(p.id))
      else filtered.forEach(p => next.delete(p.id))
      return next
    })
  }, [filtered])

  const clearRowSelection = useCallback(() => {
    setSelectedRowIds(new Set())
  }, [])

  const confirmarBulkDelete = async () => {
    if (selectedRowIds.size === 0) return
    const ok = confirm(
      `Apagar ${selectedRowIds.size} conta(s) selecionada(s)?\n\n` +
      'Cada parcela será removida individualmente. Esta ação não pode ser desfeita.',
    )
    if (!ok) return

    setBulkProcessing(true)
    setSaveError(null)
    try {
      await excluirContasPagarPorIds([...selectedRowIds])
      clearRowSelection()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao apagar contas selecionadas.')
    } finally {
      setBulkProcessing(false)
    }
  }

  const confirmarBulkPago = async () => {
    if (selectedParaPagar.length === 0) return

    setBulkProcessing(true)
    setSaveError(null)
    try {
      const itens = selectedParaPagar.map(p => ({
        id: p.id,
        valor: parseFloat(Math.max(0, p.valor_parcela - getValorPagoConta(p)).toFixed(2)),
      })).filter(item => item.valor > 0)

      await marcarPagoEmLote(itens)
      setBulkPayModalOpen(false)
      clearRowSelection()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao marcar contas como pagas.')
    } finally {
      setBulkProcessing(false)
    }
  }

  const totaisColunas = {
    valorTotal: filtered.reduce((s, p) => s + p.valor_parcela, 0),
    pago: filtered.reduce((s, p) => s + getValorPagoConta(p), 0),
    restante: filtered.reduce((s, p) => s + Math.max(0, p.valor_parcela - getValorPagoConta(p)), 0),
  }

  const filtrosStatusLabel = activeFilters.length > 0
    ? activeFilters.join(' + ')
    : (isDefaultView ? 'Em aberto (padrão)' : 'Todos')

  const pdfExportInput: ContasPagarListaPdfExportInput = {
    contas: filtered,
    fornecedores,
    getStatus,
    periodFilter,
    kpis: kpiCards.map(({ label, hint, value, tone }) => ({ label, hint, value, tone })),
    empresaNome: empresa?.nome ?? 'Movelaria Garbo',
    filtrosStatusLabel,
    busca: search,
  }

  // Cards: padrão = mês atual + vencidas globais; com filtro = reflete a seleção

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

    const isRecorrente = !!(editingConta.recorrente && editingConta.recorrencia_id)
    let recorrenciaValorMensal = valorParcela

    if (isRecorrente) {
      recorrenciaValorMensal = parseMoneyBr(editForm.recorrenciaValorMensal)
      if (!recorrenciaValorMensal || recorrenciaValorMensal <= 0) {
        setEditError('Informe um valor mensal recorrente válido.')
        return
      }
    }

    setEditSaving(true)
    setEditError(null)
    try {
      const vencimentoAtual = normalizeObraDate(editForm.vencimento) ?? editForm.vencimento
      const encerramentoAtual = normalizeObraDate(editForm.recorrenciaEncerramento) ?? ''
      const encerramentoAlterado =
        encerramentoAtual !== recorrenciaEdicaoRef.current.encerramento
      const diaMensal = Number.parseInt(editForm.recorrenciaDiaMensal, 10)
      const diaAlterado = editForm.recorrenciaDiaMensal !== recorrenciaEdicaoRef.current.diaMensal

      if (isRecorrente && (diaAlterado && (diaMensal < 1 || diaMensal > 31))) {
        setEditError('Informe um dia de vencimento mensal válido (1 a 31).')
        setEditSaving(false)
        return
      }

      // Comissão de montador: não sobrescrever o título "Comissão: Nome" com a descrição da obra
      const fornecedorNomeEdit =
        fornecedores.find(x => x.id === editForm.supplierId)?.nome
        ?? (editingConta.prestador_id
          ? (editingConta.fornecedor_nome ?? null)
          : (editForm.desc?.trim() || null))

      const metadados = {
        fornecedor_id: editForm.supplierId || null,
        fornecedor_nome: fornecedorNomeEdit,
        descricao: editForm.desc?.trim() || null,
        observacao: editForm.observacao?.trim() || null,
        forma_pagamento_id: editForm.formaPagamentoId || null,
      }

      if (isRecorrente && editingConta.recorrencia_id) {
        await editarContaPagar(
          editingConta,
          {
            valor_parcela: valorParcela,
            valor_total: valorParcela,
            data_vencimento: vencimentoAtual,
          },
          'single',
        )

        await atualizarRecorrencia({
          recorrencia_id: editingConta.recorrencia_id,
          conta_referencia_vencimento: vencimentoAtual,
          recorrencia_valor_base: recorrenciaValorMensal,
          recorrencia_encerramento: encerramentoAtual || null,
          encerramento_alterado: encerramentoAlterado,
          dia_vencimento_alterado: diaAlterado,
          novo_dia_vencimento: diaAlterado ? diaMensal : null,
          aplicar_valor_futuras_pendentes: editForm.aplicarValorFuturas,
          metadados,
        })
      } else {
        const isParcelado = lancamentoTemParcelamento(editingConta, data)
        const relacionadas = isParcelado ? getContasRelacionadas(editingConta, data) : []
        const primeiroVenc =
          normalizeObraDate(editForm.primeiroVencimentoParcelado) ?? vencimentoAtual

        const updatePayload: Parameters<typeof editarContaPagar>[1] = {
          ...metadados,
          valor_parcela: valorParcela,
          data_vencimento: scope === 'single' ? vencimentoAtual : undefined,
          primeiro_vencimento_grupo:
            scope === 'group' && isParcelado ? primeiroVenc : undefined,
        }

        if (!isParcelado) {
          updatePayload.valor_total = valorParcela
        } else if (scope === 'group') {
          updatePayload.valor_total = parseFloat(
            (valorParcela * relacionadas.length).toFixed(2),
          )
        }

        await editarContaPagar(editingConta, updatePayload, scope)
      }

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
    if (editingConta && lancamentoTemParcelamento(editingConta, data)) {
      setScopePromptOpen(true)
      return
    }
    void persistEdit('single')
  }

  const askDeleteScope = (conta: ContaPagar) => {
    if (lancamentoTemParcelamento(conta, data)) {
      setContaToDelete(conta)
      setDeleteScopeOpen(true)
      return
    }
    const ok = confirm('Deseja realmente apagar esta fatura?')
    if (!ok) return
    void confirmarExclusaoEscopo(conta, 'single')
  }

  const confirmarExclusaoEscopo = async (conta: ContaPagar, scope: 'single' | 'group') => {
    setDeleting(true)
    setSaveError(null)
    try {
      await excluirContaPagar(conta, scope)
      setDeleteScopeOpen(false)
      setContaToDelete(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao excluir fatura.')
    } finally {
      setDeleting(false)
    }
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
    // Ref + flag: o state do React ainda não atualizou no 2º clique no mesmo instante
    if (pagarSavingRef.current || pagarModal.saving) return
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

    pagarSavingRef.current = true
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
      setPagarModal(p => ({ ...p, open: false, conta: null, saving: false }))
    } catch (e) {
      setPagarModal(p => ({ ...p, erro: e instanceof Error ? e.message : 'Erro ao processar pagamento.', saving: false }))
    } finally {
      pagarSavingRef.current = false
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

  const removeConta = (conta: ContaPagar) => {
    askDeleteScope(conta)
  }

  return (
    <div className="cobrancas-page-shell fade-in relative -mx-2 -mt-2 min-h-[calc(100svh-4.25rem)] px-2 pb-10 sm:-mx-3 sm:-mt-3 sm:px-3 md:px-4">
      <ContasPagarPageAura />
      <div className="relative z-[1] mx-auto w-full max-w-[1760px] space-y-6 pt-4 md:pt-8">
      <header className="cobrancas-masthead relative overflow-hidden rounded-2xl border border-[rgba(26,16,12,0.12)] bg-[#fffaf4]/92 px-5 py-6 shadow-[0_12px_32px_rgba(42,24,18,0.06)] sm:px-8 sm:py-8">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b3f12]">
              <Receipt className="h-3.5 w-3.5" aria-hidden />
              Saídas do ateliê
              {readOnly ? (
                <span className="rounded-full border border-[rgba(107,63,18,0.35)] px-2 py-0.5 text-[10px] font-normal normal-case tracking-normal">
                  Somente visualização
                </span>
              ) : null}
            </p>
            <h1 className="mt-2 font-display text-3xl italic leading-tight text-[#1a100c] sm:text-5xl">
              Contas a pagar
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#4a3428] sm:text-base">
              Fornecedores, parcelas e o que ainda precisa sair do caixa — no mesmo papel da casa.
            </p>
            <p className="section-label mt-3">
              {periodFiltered.length} parcela{periodFiltered.length !== 1 ? 's' : ''}
              {periodoLabel ? ` em ${periodoLabel}` : ' no período'}
              {hasLancamentoPagarDraft() && !open ? ' · rascunho salvo neste navegador' : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ContasPagarListaPdfExportButton input={pdfExportInput} disabled={loading} />
            {!readOnly && (
              <>
                <ContasPagarConfigButton readOnly={readOnly} formasHook={formasHook} />
                <ContasPagarImportButton
                  fornecedores={fornecedores}
                  contasExistentes={data}
                  readOnly={readOnly}
                  onImport={importarCobrancasUnicas}
                />
                <button type="button" className="btn btn-gold btn-md gap-1.5" onClick={openManualLaunch}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Lançamento manual
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {saveError && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {saveError}
        </p>
      )}

      <PeriodFilterBar
        value={periodFilter}
        onChange={v => {
          setPeriodFilter(v)
          localStorage.setItem('movelaria_contaspagar_period', JSON.stringify(v))
        }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card
              key={kpi.label}
              className={cn(
                'cobrancas-kpi-tile border-[rgba(26,16,12,0.14)] bg-[#fffaf4] shadow-[0_12px_32px_rgba(42,24,18,0.07)]',
                kpi.tone === 'late' && 'border-[rgba(159,18,57,0.28)]',
                kpi.tone === 'ok' && 'border-[rgba(20,108,56,0.24)]',
                kpi.tone === 'gold' && 'border-[rgba(107,63,18,0.28)]',
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#4a3428]">
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      kpi.tone === 'ok' && 'text-[#146c38]',
                      kpi.tone === 'late' && 'text-[#9f1239]',
                      kpi.tone === 'gold' && 'text-[#6b3f12]',
                    )}
                    aria-hidden
                  />
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    'font-display text-2xl font-semibold sm:text-3xl',
                    kpi.tone === 'ok' && 'text-[#146c38]',
                    kpi.tone === 'late' && 'text-[#9f1239]',
                    kpi.tone === 'gold' && 'text-[#6b3f12]',
                  )}
                >
                  {fmtCur(kpi.value)}
                </p>
                <p className="mt-1 text-xs text-[#6b5244]">{kpi.hint}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Modal
        open={open}
        onClose={closeModalKeepDraft}
        title="LANÇAMENTO MANUAL — CONTAS A PAGAR"
        wide
        closeOnBackdrop={false}
      >
        {(draftHint || hasLancamentoPagarDraft()) && (
          <p className="mb-3 rounded-lg border border-[rgba(240,210,140,0.2)] bg-[rgba(240,210,140,0.08)] px-3 py-2 text-xs text-[#f2d892]">
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
                    ? '1.5px solid #f2d892'
                    : '1px solid rgba(240,210,140,.2)',
                  background: form.recorrente === opt.value
                    ? 'rgba(240,210,140,.12)'
                    : 'transparent',
                  color: form.recorrente === opt.value ? '#f2d892' : '#edd9c4',
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
            <p style={{ fontSize: '.72rem', color: '#edd9c4', marginTop: '.4rem' }}>
              Gera cobranças todo mês automaticamente. O sistema sempre mantém 12 meses à frente.
            </p>
          )}
        </div>

        {form.recorrente ? (
          <>
            <Field label="1º vencimento — dia / mês / ano">
              <DateInput
                value={form.fdd}
                onChange={iso => setForm(p => ({ ...p, fdd: iso ?? todayISO() }))}
              />
            </Field>
            <Field label="Encerrar recorrência em (opcional) — dia / mês / ano">
              <DateInput
                value={form.recorrenciaEncerramento || null}
                onChange={iso => setForm(p => ({ ...p, recorrenciaEncerramento: iso ?? '' }))}
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
              <Field label="1º vencimento — dia / mês / ano" half>
                <DateInput
                  value={form.fdd}
                  onChange={iso => setForm(p => ({ ...p, fdd: iso ?? todayISO() }))}
                />
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
        {editingConta && (lancamentoTemParcelamento(editingConta, data) || (editingConta.recorrente && editingConta.recorrencia_id)) && (
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
          {editingConta?.recorrente && editingConta.recorrencia_id ? (
            <p className="mt-1 text-[0.68rem] text-[#d4bc9f]">
              Vale para todas as parcelas desta recorrência (passadas, atuais e futuras).
            </p>
          ) : null}
        </Field>
        <Field label="Observação">
          <textarea
            className="glass-input min-h-[72px]"
            value={editForm.observacao}
            onChange={ef('observacao')}
            rows={3}
            placeholder="Ex.: Salário base mais comissão — início em dd/mm/aaaa"
          />
          {editingConta?.recorrente && editingConta.recorrencia_id ? (
            <p className="mt-1 text-[0.68rem] text-[#d4bc9f]">
              Este texto aparece em todas as cobranças recorrentes ao salvar.
            </p>
          ) : null}
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
          <Field
            label={editingConta?.recorrente ? 'Valor desta cobrança (R$)' : 'Valor da Parcela (R$)'}
            half
          >
            <input className="glass-input" value={editForm.valorParcela} onChange={ef('valorParcela')} />
          </Field>
          <Field label="Vencimento desta cobrança — dia / mês / ano" half>
            <DateInput
              value={editForm.vencimento}
              onChange={iso => setEditForm(p => ({ ...p, vencimento: iso ?? todayISO() }))}
            />
          </Field>
        </FieldRow>

        {editingConta && lancamentoTemParcelamento(editingConta, data) ? (
          <div className="mb-4 rounded-lg border border-[rgba(240,210,140,.22)] bg-[rgba(240,210,140,.04)] p-4">
            <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-wider text-[#f2d892]">
              Vencimentos do parcelamento
            </p>
            <Field label="Vencimento da 1ª parcela — dia / mês / ano">
              <DateInput
                value={editForm.primeiroVencimentoParcelado}
                onChange={iso =>
                  setEditForm(p => ({
                    ...p,
                    primeiroVencimentoParcelado: iso ?? todayISO(),
                  }))
                }
              />
            </Field>
            <p className="mt-2 text-xs text-[#edd9c4]">
              Ao salvar em &quot;Editar todas as parcelas&quot;, os vencimentos serão recalculados
              mês a mês a partir desta data.
            </p>
            {editForm.primeiroVencimentoParcelado && editingConta.total_parcelas > 1 ? (
              <div className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Previsão:{' '}
                {Array.from({ length: editingConta.total_parcelas }, (_, i) =>
                  fmtDate(addMonths(editForm.primeiroVencimentoParcelado, i)),
                ).join(' · ')}
              </div>
            ) : null}
          </div>
        ) : null}

        {editingConta?.recorrente && editingConta.recorrencia_id ? (
          <div className="mb-4 rounded-lg border border-[rgba(240,210,140,.22)] bg-[rgba(240,210,140,.04)] p-4">
            <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-wider text-[#f2d892]">
              Configurações da recorrência
            </p>
            <p className="mb-3 text-xs text-[#edd9c4]">
              O sistema mantém automaticamente 12 meses de cobranças à frente. Só altere
              &quot;Encerrar recorrência&quot; se quiser parar de gerar novos meses.
            </p>
            <Field label="Valor mensal recorrente (R$)">
              <input
                className="glass-input"
                value={editForm.recorrenciaValorMensal}
                onChange={ef('recorrenciaValorMensal')}
                placeholder="0,00"
              />
            </Field>
            <FieldRow>
              <Field label="Dia do vencimento mensal (próximas cobranças)" half>
                <select
                  className="glass-input"
                  value={editForm.recorrenciaDiaMensal}
                  onChange={ef('recorrenciaDiaMensal')}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(dia => (
                    <option key={dia} value={String(dia)}>
                      Dia {dia}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Encerrar recorrência em (opcional) — dia / mês / ano" half>
                <DateInput
                  value={editForm.recorrenciaEncerramento || null}
                  onChange={iso =>
                    setEditForm(p => ({ ...p, recorrenciaEncerramento: iso ?? '' }))
                  }
                />
              </Field>
            </FieldRow>
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-[#edd9c4]">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={editForm.aplicarValorFuturas}
                onChange={e => setEditForm(p => ({ ...p, aplicarValorFuturas: e.target.checked }))}
              />
              <span>
                Atualizar parcelas futuras pendentes com o novo valor mensal
                {' '}
                <span className="text-[#d4bc9f]">(a partir do próximo vencimento)</span>
              </span>
            </label>
            {parseMoneyBr(editForm.recorrenciaValorMensal) > 0 && (
              <div className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                {fmtCur(parseMoneyBr(editForm.recorrenciaValorMensal))}/mês
                {editForm.recorrenciaEncerramento
                  ? ` · até ${fmtDate(editForm.recorrenciaEncerramento)}`
                  : ' · sem data de encerramento'}
              </div>
            )}
          </div>
        ) : null}

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
        <p className="mb-4 text-sm text-[#fffaf4]">
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

      <Modal
        open={deleteScopeOpen}
        onClose={() => {
          if (deleting) return
          setDeleteScopeOpen(false)
          setContaToDelete(null)
        }}
        title="APAGAR FATURA"
        closeOnBackdrop={false}
      >
        {contaToDelete && (
          <>
            <p className="mb-4 text-sm text-[#fffaf4]">
              <strong style={{ color: '#f2d892' }}>
                {contaToDelete.fornecedor_nome ?? contaToDelete.descricao ?? 'Esta fatura'}
              </strong>
              {' '}— parcela{' '}
              {contaToDelete.numero_parcela}/{contaToDelete.total_parcelas}{' '}
              ({fmtCur(contaToDelete.valor_parcela)}).
              <br /><br />
              Esta conta faz parte de um lançamento parcelado. Deseja apagar apenas esta parcela
              ou todas as parcelas deste lançamento?
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setDeleteScopeOpen(false)
                  setContaToDelete(null)
                }}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => void confirmarExclusaoEscopo(contaToDelete, 'single')}
                disabled={deleting}
              >
                {deleting
                  ? 'Apagando...'
                  : `Só esta parcela (${contaToDelete.numero_parcela}/${contaToDelete.total_parcelas})`}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => void confirmarExclusaoEscopo(contaToDelete, 'group')}
                disabled={deleting}
              >
                {deleting
                  ? 'Apagando...'
                  : `Todas as parcelas (${getContasRelacionadas(contaToDelete, data).length || contaToDelete.total_parcelas})`}
              </button>
            </div>
          </>
        )}
      </Modal>

      <div className="flex items-start gap-2 flex-wrap">
        <div className="cobrancas-filters min-w-0 flex-1">
          <FilterBar
            options={['Todos', ...STATUS_FILTER_OPTIONS]}
            multi
            values={activeFilterSet}
            multiHint="Clique em um ou mais status para combinar os filtros. Toque de novo para remover."
            onChange={v => {
              if (v === 'Todos') {
                setActiveFilters([])
                return
              }
              const option = v as StatusFilterOption
              if (!STATUS_FILTER_OPTIONS.includes(option)) return
              setActiveFilters(prev =>
                prev.includes(option)
                  ? prev.filter(item => item !== option)
                  : [...prev, option],
              )
            }}
          />
        </div>

        <ContasPagarExportButton
          todasContas={data}
          fornecedores={fornecedores}
          periodFilter={periodFilter}
          getStatus={getStatus}
        />

        {/* Ocultar Dívida */}
        <div ref={ocultarRef} className="relative mb-4 shrink-0">
          <button
            type="button"
            className="btn btn-outline btn-sm flex items-center gap-1.5"
            onClick={() => setOcultarOpen(p => !p)}
            style={{ whiteSpace: 'nowrap' }}
          >
            <span>Ocultar Dívida</span>
            {idsOcultos.size > 0 && (
              <span style={{
                background: '#f2d892', color: '#1a0f0a', borderRadius: 9999,
                fontSize: '.65rem', fontWeight: 700, padding: '0 .4rem',
                lineHeight: '1.35rem', minWidth: '1.35rem', textAlign: 'center' as const,
              }}>
                {idsOcultos.size}
              </span>
            )}
            <span style={{ opacity: .5, fontSize: '.7rem' }}>{ocultarOpen ? '▲' : '▼'}</span>
          </button>

          {ocultarOpen && (
            <div
              className="cobrancas-action-panel absolute right-0 z-[200]"
              style={{ width: 320, top: 'calc(100% + 4px)' }}
            >
              <ContasPagarPanelStatusFilter
                activeKeys={ocultarStatuses}
                onToggle={key => setOcultarStatuses(p => {
                  const next = new Set(p)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })}
              />

              <div className="cobrancas-action-panel__section">
                <input
                  type="text"
                  className="glass-input w-full"
                  placeholder="Buscar dívida específica..."
                  value={ocultarBusca}
                  onChange={e => setOcultarBusca(e.target.value)}
                  style={{ fontSize: '.82rem', padding: '.4rem .7rem' }}
                />
              </div>

              {ocultarListaFiltrada.length > 0 && (
                <label className="cobrancas-action-panel__select-all">
                  <input
                    type="checkbox"
                    ref={el => {
                      if (!el) return
                      const allChecked = ocultarListaFiltrada.every(c => ocultarIds.has(c.id))
                      const someChecked = ocultarListaFiltrada.some(c => ocultarIds.has(c.id))
                      el.checked = allChecked
                      el.indeterminate = someChecked && !allChecked
                    }}
                    onChange={e => setOcultarIds(p => {
                      const next = new Set(p)
                      if (e.target.checked) ocultarListaFiltrada.forEach(c => next.add(c.id))
                      else ocultarListaFiltrada.forEach(c => next.delete(c.id))
                      return next
                    })}
                  />
                  <span>Marcar todos ({ocultarListaFiltrada.length})</span>
                </label>
              )}

              <div className="cobrancas-action-panel__list cobrancas-action-panel__list--compact">
                {ocultarListaFiltrada.length === 0 ? (
                  <p className="cobrancas-action-panel__empty">Nenhuma dívida encontrada.</p>
                ) : (
                  ocultarListaFiltrada.map(c => {
                    const s = getStatus(c.data_vencimento, c.status)
                    const nome = c.fornecedor_nome ?? fornecedores.find(x => x.id === c.fornecedor_id)?.nome ?? c.descricao ?? '—'
                    const checked = ocultarIds.has(c.id)
                    return (
                      <label key={c.id} className="cobrancas-action-panel__list-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => setOcultarIds(p => {
                            const next = new Set(p)
                            if (e.target.checked) next.add(c.id)
                            else next.delete(c.id)
                            return next
                          })}
                        />
                        <div className="min-w-0 flex-1">
                          <div className={`cobrancas-action-panel__list-title${checked ? '' : ' cobrancas-action-panel__list-title--muted'}`}>
                            {nome}
                          </div>
                          <div className="cobrancas-action-panel__list-meta">
                            {fmtCur(c.valor_parcela)} · {fmtDate(c.data_vencimento)}
                          </div>
                        </div>
                        <Badge status={s} />
                      </label>
                    )
                  })
                )}
              </div>

              {ocultarIds.size > 0 && (
                <div className="cobrancas-action-panel__footer">
                  <span>{ocultarIds.size} item(s) oculto(s)</span>
                  <button
                    type="button"
                    className="cobrancas-action-panel__footer-action"
                    onClick={() => setOcultarIds(new Set())}
                  >
                    Limpar tudo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative mb-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b3f12]" aria-hidden />
        <input
          type="search"
          className="glass-input w-full pl-10"
          placeholder="Buscar por fornecedor, descrição, valor total, valor da parcela ou data…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Buscar contas a pagar"
        />
      </div>

      {!readOnly && (
        <ContasPagarSelecaoPopup
          contas={selectedContas}
          totalRestante={totalRestanteSelecionado}
          processing={bulkProcessing}
          pagarCount={selectedParaPagar.length}
          onMarcarPago={() => setBulkPayModalOpen(true)}
          onApagar={() => void confirmarBulkDelete()}
          onLimpar={clearRowSelection}
          onRemover={id => toggleSelectRow(id, false)}
          resolveNome={conta =>
            conta.fornecedor_nome
            ?? fornecedores.find(x => x.id === conta.fornecedor_id)?.nome
            ?? conta.descricao
            ?? '—'
          }
        />
      )}

      <div className="cobrancas-ledger cobrancas-ledger--pagar glass-card min-w-0 overflow-hidden">
        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : filtered.length === 0 ? (
          <EmptyState
            message={
              periodoLabel
                ? `Nenhuma conta com vencimento em ${periodoLabel} para este filtro.`
                : 'Nenhuma conta para este filtro.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="cobrancas-ledger__table w-full border-collapse">
              <thead>
                <tr>
                {!readOnly && (
                  <th className="section-label cobrancas-ledger__col-check px-2 py-3">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas as contas visíveis"
                      ref={el => {
                        if (!el) return
                        const allChecked = filtered.length > 0 && filtered.every(p => selectedRowIds.has(p.id))
                        const someChecked = filtered.some(p => selectedRowIds.has(p.id))
                        el.checked = allChecked
                        el.indeterminate = someChecked && !allChecked
                      }}
                      onChange={e => toggleSelectAllVisible(e.target.checked)}
                      className="accent-[#6b3f12]"
                    />
                  </th>
                )}
                <th className="section-label cobrancas-ledger__col-fornecedor px-4 py-3 text-left">Fornecedor</th>
                <th className="section-label cobrancas-ledger__col-pagamento px-3 py-3 text-left">Pagamento</th>
                <th className="section-label cobrancas-ledger__col-parcela px-3 py-3 text-left">Parcela</th>
                <th className="section-label cobrancas-ledger__col-valor px-3 py-3 text-left">Valor Total</th>
                <th className="section-label cobrancas-ledger__col-valor px-3 py-3 text-left">Pago</th>
                <th className="section-label cobrancas-ledger__col-valor px-3 py-3 text-left">Restante</th>
                <th className="section-label cobrancas-ledger__col-venc px-3 py-3 text-left">Vencimento</th>
                <th className="section-label cobrancas-ledger__col-status px-3 py-3 text-left">Status</th>
                <th className="section-label cobrancas-ledger__col-acoes px-3 py-3 text-left" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const s = getStatus(p.data_vencimento, p.status)
                  const isParcial = p.status === 'parcialmente_pago'
                  const isAtrasada = p.status !== 'pago' && isOverdue(p.data_vencimento)
                  const isSelected = selectedRowIds.has(p.id)
                  const nomeExibido = p.fornecedor_nome ?? fornecedores.find(x => x.id === p.fornecedor_id)?.nome ?? p.descricao ?? '—'
                  const detalhes = getDetalhesExibicaoContaPagar(p, nomeExibido)
                  const valorTotalLancamento = getValorTotalLancamento(p, data)
                  return (
                    <tr
                      key={p.id}
                      className={cn('trow', isAtrasada && 'cobrancas-row-late', isSelected && 'bg-[#f8efe0]')}
                    >
                      {!readOnly && (
                        <td className="cobrancas-ledger__col-check px-2 py-3 align-top">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${nomeExibido}`}
                            checked={isSelected}
                            onChange={e => toggleSelectRow(p.id, e.target.checked)}
                            className="accent-[#6b3f12]"
                          />
                        </td>
                      )}
                      <td className="cobrancas-ledger__col-fornecedor px-4 py-3 font-medium text-[#1a100c]">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {p.recorrente && (
                            <RefreshCw
                              className="h-2.5 w-2.5 shrink-0 text-[#6b3f12]"
                              title="Cobrança recorrente"
                            />
                          )}
                          <span className="min-w-0 break-words">{nomeExibido}</span>
                        </div>
                        {valorTotalLancamento != null && (
                          <div className="mt-0.5 text-[0.72rem] text-[#6b3f12]">
                            {fmtCur(valorTotalLancamento)}
                          </div>
                        )}
                        {p.fornecedor_id && getSaldoFornecedor(p.fornecedor_id) > 0 && s !== 'pago' && (
                          <div className="mt-0.5 text-[0.72rem] text-[#146c38]">
                            Saldo: {fmtCur(getSaldoFornecedor(p.fornecedor_id))}
                          </div>
                        )}
                        {detalhes.descricao ? (
                          <p
                            className="mt-1 text-[0.75rem] leading-snug text-[#4a3428]"
                            title={detalhes.descricao}
                          >
                            {detalhes.descricao}
                          </p>
                        ) : null}
                        {detalhes.observacao ? (
                          <p
                            className="mt-0.5 text-[0.72rem] italic leading-snug text-[#6b5244]"
                            title={detalhes.observacao}
                          >
                            {detalhes.observacao}
                          </p>
                        ) : null}
                      </td>
                      <td className="cobrancas-ledger__col-pagamento px-3 py-3 text-[0.82rem] text-[#4a3428]">
                        {p.movelaria_formas_pagamento_pagar?.nome ?? '—'}
                      </td>
                      <td className="cobrancas-ledger__col-parcela px-3 py-3 text-sm text-[#4a3428]">{p.numero_parcela}/{p.total_parcelas}</td>
                      <td className="cobrancas-ledger__col-valor px-3 py-3 font-semibold tabular-nums text-[#6b3f12]">{fmtCur(p.valor_parcela)}</td>
                      <td className={cn('cobrancas-ledger__col-valor px-3 py-3 font-semibold tabular-nums', getValorPagoConta(p) > 0 ? 'text-[#146c38]' : 'text-[#6b5244]')}>{fmtCur(getValorPagoConta(p))}</td>
                      <td className={cn('cobrancas-ledger__col-valor px-3 py-3 font-semibold tabular-nums', p.status === 'pago' ? 'text-[#146c38]' : 'text-[#1a100c]')}>{fmtCur(Math.max(0, p.valor_parcela - getValorPagoConta(p)))}</td>
                      <td className={cn('cobrancas-ledger__col-venc px-3 py-3 text-sm tabular-nums', isAtrasada ? 'font-semibold text-[#9f1239]' : 'text-[#4a3428]')}>{fmtDate(p.data_vencimento)}</td>
                      <td className="cobrancas-ledger__col-status px-3 py-3"><Badge status={s} /></td>
                      <td className="cobrancas-ledger__col-acoes px-3 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
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
                                {isParcial ? '+ Pagar mais' : '✓ Marcar Pago'}
                              </button>
                              {isParcial && (
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
                            <span className="text-xs font-semibold text-[#146c38]">✓ {fmtDate(p.data_pagamento)}</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[rgba(26,16,12,0.14)] bg-[rgba(26,16,12,0.04)]">
                  <td colSpan={readOnly ? 3 : 4} className="section-label px-4 py-3 font-bold">Total</td>
                  <td className="cobrancas-ledger__col-valor px-3 py-3 font-bold tabular-nums text-[#6b3f12]">{fmtCur(totaisColunas.valorTotal)}</td>
                  <td className={cn('cobrancas-ledger__col-valor px-3 py-3 font-bold tabular-nums', totaisColunas.pago > 0 ? 'text-[#146c38]' : 'text-[#6b5244]')}>{fmtCur(totaisColunas.pago)}</td>
                  <td className={cn('cobrancas-ledger__col-valor px-3 py-3 font-bold tabular-nums', totaisColunas.restante > 0 ? 'text-[#9f1239]' : 'text-[#146c38]')}>{fmtCur(totaisColunas.restante)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
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
        <p className="mb-4 text-sm" style={{ color: '#fffaf4' }}>
          <strong style={{ color: '#f2d892' }}>{encerrarModal.descricao}</strong>
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
                color: encerrarModal.modo === opt.value ? '#f87171' : '#edd9c4',
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
          <Field label="Encerrar em — dia / mês / ano (última parcela a manter)">
            <DateInput
              value={encerrarModal.data}
              onChange={iso => setEncerrarModal(p => ({ ...p, data: iso ?? todayISO() }))}
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

      {/* Modal — Marcar como pago em lote */}
      <Modal
        open={bulkPayModalOpen}
        onClose={() => !bulkProcessing && setBulkPayModalOpen(false)}
        title="MARCAR SELECIONADAS COMO PAGAS"
        closeOnBackdrop={false}
      >
        <p className="mb-4 text-sm text-[#fffaf4]">
          Serão quitadas <strong style={{ color: '#f2d892' }}>{selectedParaPagar.length}</strong> conta(s)
          {' '}pelo valor restante total de{' '}
          <strong style={{ color: '#4ade80' }}>{fmtCur(totalRestanteSelecionado)}</strong>.
        </p>
        <p className="mb-4 text-xs text-[#edd9c4]">
          Contas já pagas na seleção são ignoradas. O pagamento usa a data de hoje e quita o valor restante de cada parcela.
        </p>
        {saveError && <p className="mb-2 text-sm text-red-400">{saveError}</p>}
        <ModalFormFooter
          onCancel={() => setBulkPayModalOpen(false)}
          onSubmit={() => void confirmarBulkPago()}
          submitLabel="Confirmar pagamento em lote"
          submittingLabel="Processando..."
          submitting={bulkProcessing}
          submitDisabled={selectedParaPagar.length === 0}
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
                <div style={{ background: 'rgba(240,210,140,.06)', border: '1px solid rgba(240,210,140,.2)', borderRadius: 8, padding: '.6rem .75rem' }}>
                  <div className="text-xs text-[#edd9c4] mb-1">Valor Total</div>
                  <div className="font-display" style={{ fontSize: '1.05rem', color: '#f2d892' }}>{fmtCur(conta.valor_parcela)}</div>
                </div>
                <div style={{ background: 'rgba(74,222,128,.06)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, padding: '.6rem .75rem' }}>
                  <div className="text-xs text-[#edd9c4] mb-1">Já Pago</div>
                  <div className="font-display" style={{ fontSize: '1.05rem', color: valorPagoAtual > 0 ? '#4ade80' : '#edd9c4' }}>{fmtCur(valorPagoAtual)}</div>
                </div>
                <div style={{ background: 'rgba(248,113,113,.06)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 8, padding: '.6rem .75rem' }}>
                  <div className="text-xs text-[#edd9c4] mb-1">Restante</div>
                  <div className="font-display" style={{ fontSize: '1.05rem', color: '#f87171' }}>{fmtCur(restanteDevido)}</div>
                </div>
              </div>

              {/* Caixa do fornecedor (se houver saldo) */}
              {nomeForn && saldo > 0 && (
                <div style={{ background: 'rgba(74,222,128,.04)', border: '1px solid rgba(74,222,128,.15)', borderRadius: 6, padding: '.4rem .75rem', marginBottom: '.75rem' }}>
                  <span className="text-xs text-[#edd9c4]">Caixa — {nomeForn}: </span>
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
                    <span className="text-xs text-[#edd9c4]">Restante a pagar (outra forma):</span>
                    <span style={{ fontWeight: 700, fontSize: '.9rem', color: quitado ? '#4ade80' : '#fffaf4' }}>
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

      {createPortal(
        <button
          type="button"
          onClick={() => setCaixaOpen(true)}
          className="fixed top-20 right-5 z-[200] rounded-full border border-[rgba(240,210,140,0.45)] bg-gradient-to-br from-[rgba(20,8,4,0.98)] to-[rgba(8,3,1,0.98)] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f2d892] shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-all hover:scale-105 hover:border-[#f5e0a8] hover:text-[#f5e0a8]"
          aria-label="Abrir caixa de pagamentos"
          title="Abrir Caixa de Pagamentos"
        >
          Caixa
        </button>,
        document.body,
      )}

      <CaixaPopup open={caixaOpen} onClose={() => setCaixaOpen(false)} />
      </div>
    </div>
  )
}
