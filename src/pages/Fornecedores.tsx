import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Search, Trash2 } from 'lucide-react'
import { useFornecedores } from '../hooks/useFornecedores'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field, FieldRow } from '../components/ui/Field'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import { ResumoFinanceiroFornecedor } from '../components/fornecedores/ResumoFinanceiroFornecedor'
import {
  clearFornecedorDraft,
  hasFornecedorDraft,
  loadFornecedorDraft,
  saveFornecedorDraft,
} from '../lib/fornecedor-draft'
import { resumoFornecedor, totaisPaginaFornecedores } from '../lib/fornecedor-financeiro'
import { fmtCur, parseMoneyBr } from '../lib/utils'
import type { ContaPagar, Fornecedor, FornecedorInput } from '../types'

const BLANK: FornecedorInput = {
  nome: '',
  cnpj_cpf: '',
  telefone: '',
  email: '',
  nome_vendedor: '',
  telefone_vendedor: '',
  limite_com_fornecedor: 0,
}

interface FormState extends FornecedorInput {
  limiteStr: string
}

const BLANK_FORM: FormState = { ...BLANK, limiteStr: '' }

function limiteToStr(v?: number | null): string {
  if (v == null || v === 0) return ''
  return String(v).replace('.', ',')
}

function formToInput(form: FormState): FornecedorInput {
  const { limiteStr, ...rest } = form
  return {
    ...rest,
    limite_com_fornecedor: parseMoneyBr(limiteStr),
  }
}

function fornecedorToForm(item: FornecedorInput & { limite_com_fornecedor?: number }): FormState {
  return {
    nome: item.nome,
    cnpj_cpf: item.cnpj_cpf ?? '',
    telefone: item.telefone ?? '',
    email: item.email ?? '',
    nome_vendedor: item.nome_vendedor ?? '',
    telefone_vendedor: item.telefone_vendedor ?? '',
    limite_com_fornecedor: item.limite_com_fornecedor ?? 0,
    limiteStr: limiteToStr(item.limite_com_fornecedor),
  }
}

interface Props {
  readOnly?: boolean
  contasPagar?: ContaPagar[]
  getSaldoFornecedor?: (fornecedorId: string) => number
}

export function Fornecedores({ readOnly, contasPagar = [], getSaldoFornecedor }: Props) {
  const getSaldo = useCallback(
    (id: string) => getSaldoFornecedor?.(id) ?? 0,
    [getSaldoFornecedor],
  )

  const { data, loading, error, create, update, remove } = useFornecedores()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [draftHint, setDraftHint] = useState(false)
  const [busca, setBusca] = useState('')

  const f =
    (k: keyof Omit<FormState, 'limiteStr'>) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  const persistDraft = useCallback(
    (nextForm: FormState, id: string | null) => {
      const { limiteStr, ...rest } = nextForm
      saveFornecedorDraft(id, {
        ...rest,
        limite_com_fornecedor: parseMoneyBr(limiteStr),
      })
      setDraftHint(true)
    },
    [],
  )

  const totais = useMemo(
    () => totaisPaginaFornecedores(data, contasPagar, getSaldo),
    [data, contasPagar, getSaldo],
  )

  const fornecedorEmEdicao = useMemo(
    () => (editId ? data.find(f => f.id === editId) : null),
    [data, editId],
  )

  const resumoModal = useMemo(() => {
    if (!fornecedorEmEdicao) return null
    return resumoFornecedor(fornecedorEmEdicao, contasPagar, getSaldo)
  }, [fornecedorEmEdicao, contasPagar, getSaldo])

  const fornecedoresFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      f =>
        f.nome.toLowerCase().includes(q) ||
        (f.cnpj_cpf ?? '').toLowerCase().includes(q) ||
        (f.cnpj_cpf ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, '')),
    )
  }, [data, busca])

  const openNew = () => {
    const draft = loadFornecedorDraft()
    if (draft && draft.editId === null) {
      setForm({
        ...BLANK_FORM,
        ...fornecedorToForm(draft.form),
      })
      setDraftHint(true)
    } else {
      setForm(BLANK_FORM)
      setDraftHint(false)
    }
    setEditId(null)
    setOpen(true)
  }

  const openEdit = (fornecedor: Fornecedor) => {
    const draft = loadFornecedorDraft()
    const base = fornecedorToForm(fornecedor)
    if (draft && draft.editId === fornecedor.id) {
      setForm({ ...base, ...fornecedorToForm(draft.form) })
      setDraftHint(true)
    } else {
      setForm(base)
      setDraftHint(false)
    }
    setEditId(fornecedor.id)
    setOpen(true)
  }

  const closeModalUi = () => setOpen(false)

  const closeModalKeepDraft = useCallback(() => {
    persistDraft(form, editId)
    closeModalUi()
  }, [form, editId, persistDraft])

  const discardAndClose = () => {
    clearFornecedorDraft()
    setForm(BLANK_FORM)
    setDraftHint(false)
    setEditId(null)
    closeModalUi()
  }

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => persistDraft(form, editId), 450)
    return () => window.clearTimeout(timer)
  }, [form, editId, open, persistDraft])

  const save = async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      const input = formToInput(form)
      if (editId) await update(editId, input)
      else await create(input)
      clearFornecedorDraft()
      setDraftHint(false)
      setForm(BLANK_FORM)
      setEditId(null)
      closeModalUi()
    } finally {
      setSaving(false)
    }
  }

  const headerKpis = [
    { l: 'Limite total', v: totais.limiteTotal, c: '#f2d892' },
    { l: 'A pagar', v: totais.aPagarTotal, c: '#f87171' },
    { l: 'Limite disponível', v: totais.disponivelTotal, c: totais.disponivelTotal < 0 ? '#f87171' : '#4ade80' },
    { l: 'Caixa fornecedor', v: totais.caixaTotal, c: '#60a5fa' },
  ]

  return (
    <div className="fade-in">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontSize: '2.2rem', color: '#f2d892', letterSpacing: '.08em' }}
          >
            Fornecedores
          </h1>
          <p className="section-label mt-1">
            {data.length} cadastrado{data.length !== 1 ? 's' : ''}
            {hasFornecedorDraft() && !open ? ' · rascunho salvo' : ''}
          </p>
        </div>
        {!readOnly && (
          <button type="button" className="btn btn-gold btn-md" onClick={openNew}>
            + Novo Fornecedor
          </button>
        )}
      </div>

      <div
        className="mb-5 grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        {headerKpis.map(x => (
          <div key={x.l} className="glass-card p-4 text-center">
            <div className="section-label mb-1">{x.l}</div>
            <div className="font-display" style={{ fontSize: '1.2rem', color: x.c }}>
              {fmtCur(x.v)}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={open}
        onClose={closeModalKeepDraft}
        title={editId ? 'EDITAR FORNECEDOR' : 'NOVO FORNECEDOR'}
        closeOnBackdrop={false}
        headerExtra={
          editId && resumoModal ? (
            <ResumoFinanceiroFornecedor resumo={resumoModal} compact />
          ) : null
        }
      >
        {(draftHint || hasFornecedorDraft()) && (
          <p className="mb-3 rounded-lg border border-[rgba(240,210,140,0.2)] bg-[rgba(240,210,140,0.08)] px-3 py-2 text-xs text-[#f2d892]">
            Seus dados são salvos automaticamente neste navegador. Ao reabrir, você continua de onde parou.
          </p>
        )}

        <Field label="Razão Social / Nome *">
          <input
            className="glass-input"
            value={form.nome}
            onChange={f('nome')}
            placeholder="MDF Distribuidora Ltda"
          />
        </Field>
        <Field label="Limite com fornecedor (R$)">
          <input
            className="glass-input"
            value={form.limiteStr}
            onChange={e => setForm(p => ({ ...p, limiteStr: e.target.value }))}
            placeholder="0,00"
            inputMode="decimal"
          />
          <p className="mt-1 text-xs text-[#edd9c4]">
            Contas a pagar pendentes abatem deste limite automaticamente.
          </p>
        </Field>
        <Field label="CNPJ / CPF">
          <input
            className="glass-input"
            value={form.cnpj_cpf ?? ''}
            onChange={f('cnpj_cpf')}
            placeholder="00.000.000/0001-00"
          />
        </Field>
        <FieldRow>
          <Field label="Telefone" half>
            <input
              className="glass-input"
              value={form.telefone ?? ''}
              onChange={f('telefone')}
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="E-mail" half>
            <input
              className="glass-input"
              type="email"
              value={form.email ?? ''}
              onChange={f('email')}
              placeholder="contato@empresa.com"
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Nome do Vendedor" half>
            <input
              className="glass-input"
              value={form.nome_vendedor ?? ''}
              onChange={f('nome_vendedor')}
              placeholder="João Silva"
            />
          </Field>
          <Field label="Telefone do Vendedor" half>
            <input
              className="glass-input"
              value={form.telefone_vendedor ?? ''}
              onChange={f('telefone_vendedor')}
              placeholder="(00) 00000-0000"
            />
          </Field>
        </FieldRow>

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
            submitLabel={editId ? 'Salvar' : 'Cadastrar'}
            submitting={saving}
            submitDisabled={!form.nome.trim()}
          />
        </div>
      </Modal>

      <div className="relative mb-4" style={{ maxWidth: 380 }}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#edd9c4]" />
        <input
          className="glass-input pl-9"
          placeholder="Buscar por nome ou CNPJ/CPF..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : fornecedoresFiltrados.length === 0 ? (
        <EmptyState message={busca ? 'Nenhum fornecedor encontrado.' : 'Nenhum fornecedor cadastrado.'} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fornecedoresFiltrados.map(fornecedor => {
            const resumo = resumoFornecedor(fornecedor, contasPagar, getSaldo)
            const semLimite = resumo.limite <= 0

            return (
              <div key={fornecedor.id} className="glass-card flex flex-col p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-[#fffaf4]">{fornecedor.nome}</h3>
                    {fornecedor.cnpj_cpf && (
                      <p className="text-xs text-[#edd9c4]">{fornecedor.cnpj_cpf}</p>
                    )}
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openEdit(fornecedor)}
                        aria-label="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => remove(fornecedor.id)}
                        aria-label="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {semLimite ? (
                  <p className="mb-2 text-xs text-[#edd9c4]">Limite não definido</p>
                ) : (
                  <div className="mb-2">
                    <div className="mb-1 flex justify-between text-xs text-[#edd9c4]">
                      <span>Limite utilizado</span>
                      <span>
                        {fmtCur(resumo.aPagar)} / {fmtCur(resumo.limite)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, resumo.limite > 0 ? (resumo.aPagar / resumo.limite) * 100 : 0)}%`,
                          background:
                            resumo.disponivel < 0
                              ? '#f87171'
                              : resumo.aPagar / resumo.limite > 0.85
                                ? '#fbbf24'
                                : '#4ade80',
                        }}
                      />
                    </div>
                  </div>
                )}

                <ResumoFinanceiroFornecedor resumo={resumo} compact />

                {(fornecedor.telefone || fornecedor.email || fornecedor.nome_vendedor) && (
                  <div className="mt-3 border-t border-[rgba(240,210,140,0.12)] pt-2 text-xs text-[#edd9c4]">
                    {fornecedor.telefone && <div>Tel: {fornecedor.telefone}</div>}
                    {fornecedor.email && <div>{fornecedor.email}</div>}
                    {fornecedor.nome_vendedor && (
                      <div>
                        Vendedor: {fornecedor.nome_vendedor}
                        {fornecedor.telefone_vendedor ? ` · ${fornecedor.telefone_vendedor}` : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
