import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useContasPagar } from '../hooks/useContasPagar'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field, FieldRow } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { FilterBar } from '../components/ui/FilterBar'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import { ContaPagarAnexosField } from '../components/contas-pagar/ContaPagarAnexosField'
import { ContaPagarAnexosButton } from '../components/contas-pagar/ContaPagarAnexosModal'
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
  DEFAULT_PERIOD,
  PeriodFilterBar,
  type PeriodFilter,
} from '../components/ui/PeriodFilterBar'
import type { ContaPagar, Fornecedor, PendingContaPagarAnexo } from '../types'

interface Props { fornecedores: Fornecedor[]; readOnly?: boolean }

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
  }
}

export function ContasPagar({ fornecedores, readOnly }: Props) {
  const {
    data,
    loading,
    error,
    gerarParcelas,
    marcarPago,
    vincularGrupoLancamento,
    editarContaPagar,
    excluirContaPagar,
  } = useContasPagar()
  const formasHook = useFormasPagamentoPagar()
  const { formas, loading: loadingFormas } = formasHook
  const [filter, setFilter] = useState<Filter>('Todos')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(DEFAULT_PERIOD)
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
  const periodFiltered =
    periodFilter.mode === 'next-month'
      ? periodBase.filter(p => p.status !== 'pago')
      : periodBase

  const totPend = periodFiltered.filter(p => p.status !== 'pago').reduce((s, p) => s + p.valor_parcela, 0)
  const totPaid = periodFiltered.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor_parcela, 0)
  const totOver = periodFiltered.filter(p => p.status !== 'pago' && isOverdue(p.data_vencimento)).reduce((s, p) => s + p.valor_parcela, 0)

  const filtered = periodFiltered.filter(p => {
    if (filter === 'Todos') return true
    const s = getStatus(p.data_vencimento, p.status)
    return s === filter.toLowerCase()
  })

  const save = async () => {
    const tot = parseMoneyBr(form.total)
    if (!tot || tot <= 0) return
    setSaving(true)
    setSaveError(null)
    try {
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
        let grupoId = editingConta.grupo_lancamento_id
        if (!grupoId) {
          grupoId = createId()
          await vincularGrupoLancamento(editingConta.id, grupoId)
        }
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

      <PeriodFilterBar value={periodFilter} onChange={setPeriodFilter} />

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
          <select className="glass-input" value={form.supplierId} onChange={f('supplierId')}>
            <option value="">Selecionar...</option>
            {fornecedores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
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
        <Field label="Fornecedor">
          <select className="glass-input" value={editForm.supplierId} onChange={ef('supplierId')}>
            <option value="">Selecionar...</option>
            {fornecedores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
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

        <ContaPagarAnexosField anexos={editAnexos} onChange={setEditAnexos} />

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

      <FilterBar options={['Todos', 'Pendente', 'Pago', 'Vencido']} value={filter} onChange={v => setFilter(v as Filter)} />

      <div className="glass-card overflow-hidden">
        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : filtered.length === 0 ? (
          <EmptyState message="Nenhuma conta para este filtro." />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(212,168,83,.18)' }}>
                {['Fornecedor', 'Pagamento', 'Parcela', 'Valor', 'Vencimento', 'Status', ''].map((h, i) => <th key={i} className="section-label text-left px-4 py-3">{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map(p => {
                  const s = getStatus(p.data_vencimento, p.status)
                  return (
                    <tr key={p.id} className="trow">
                      <td className="px-4 py-3" style={{ color: '#f4e4d6', maxWidth: 220 }}>
                        <div>{p.fornecedor_nome ?? fornecedores.find(x => x.id === p.fornecedor_id)?.nome ?? p.descricao ?? '—'}</div>
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
                      <td className="px-4 py-3" style={{ color: s === 'vencido' ? '#f87171' : '#8a6a55', fontSize: '.85rem' }}>{fmtDate(p.data_vencimento)}</td>
                      <td className="px-4 py-3"><Badge status={s} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ContaPagarAnexosButton grupoLancamentoId={p.grupo_lancamento_id} />
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
                            <button type="button" className="btn btn-success btn-sm" onClick={() => marcarPago(p.id)}>✓ Marcar Pago</button>
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
    </div>
  )
}
