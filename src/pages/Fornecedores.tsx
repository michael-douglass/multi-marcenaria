import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useFornecedores } from '../hooks/useFornecedores'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field, FieldRow } from '../components/ui/Field'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import {
  clearFornecedorDraft,
  hasFornecedorDraft,
  loadFornecedorDraft,
  saveFornecedorDraft,
} from '../lib/fornecedor-draft'
import type { FornecedorInput } from '../types'

const BLANK: FornecedorInput = {
  nome: '',
  cnpj_cpf: '',
  telefone: '',
  email: '',
  nome_vendedor: '',
  telefone_vendedor: '',
}

interface Props {
  readOnly?: boolean
}

export function Fornecedores({ readOnly }: Props) {
  const { data, loading, error, create, update, remove } = useFornecedores()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FornecedorInput>(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [draftHint, setDraftHint] = useState(false)

  const f =
    (k: keyof FornecedorInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  const persistDraft = useCallback(
    (nextForm: FornecedorInput, id: string | null) => {
      saveFornecedorDraft(id, nextForm)
      setDraftHint(true)
    },
    [],
  )

  const openNew = () => {
    const draft = loadFornecedorDraft()
    if (draft && draft.editId === null) {
      setForm({ ...BLANK, ...draft.form })
      setDraftHint(true)
    } else {
      setForm(BLANK)
      setDraftHint(false)
    }
    setEditId(null)
    setOpen(true)
  }

  const openEdit = (id: string, item: FornecedorInput) => {
    const draft = loadFornecedorDraft()
    if (draft && draft.editId === id) {
      setForm({ ...BLANK, ...item, ...draft.form })
      setDraftHint(true)
    } else {
      setForm({
        nome: item.nome,
        cnpj_cpf: item.cnpj_cpf ?? '',
        telefone: item.telefone ?? '',
        email: item.email ?? '',
        nome_vendedor: item.nome_vendedor ?? '',
        telefone_vendedor: item.telefone_vendedor ?? '',
      })
      setDraftHint(false)
    }
    setEditId(id)
    setOpen(true)
  }

  const closeModalUi = () => setOpen(false)

  const closeModalKeepDraft = useCallback(() => {
    persistDraft(form, editId)
    closeModalUi()
  }, [form, editId, persistDraft])

  const discardAndClose = () => {
    clearFornecedorDraft()
    setForm(BLANK)
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
      if (editId) await update(editId, form)
      else await create(form)
      clearFornecedorDraft()
      setDraftHint(false)
      setForm(BLANK)
      setEditId(null)
      closeModalUi()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1
            className="font-display"
            style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}
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

      <Modal
        open={open}
        onClose={closeModalKeepDraft}
        title={editId ? 'EDITAR FORNECEDOR' : 'NOVO FORNECEDOR'}
        closeOnBackdrop={false}
      >
        {(draftHint || hasFornecedorDraft()) && (
          <p className="mb-3 rounded-lg border border-[rgba(212,168,83,0.2)] bg-[rgba(212,168,83,0.08)] px-3 py-2 text-xs text-[#d4a853]">
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

      <div className="glass-card overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : data.length === 0 ? (
          <EmptyState message="Nenhum fornecedor cadastrado." />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(212,168,83,.18)' }}>
                  {['Razão Social', 'CNPJ/CPF', 'Telefone', 'E-mail', 'Vendedor', 'Tel. Vendedor', ''].map(
                    (h, i) => (
                      <th key={i} className="section-label text-left px-4 py-3">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map(s => (
                  <tr key={s.id} className="trow">
                    <td className="px-4 py-3" style={{ color: '#f4e4d6', fontWeight: 500 }}>
                      {s.nome}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#8a6a55', fontSize: '.85rem' }}>
                      {s.cnpj_cpf || '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#8a6a55', fontSize: '.85rem' }}>
                      {s.telefone || '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#8a6a55', fontSize: '.85rem' }}>
                      {s.email || '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#8a6a55', fontSize: '.85rem' }}>
                      {s.nome_vendedor || '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#8a6a55', fontSize: '.85rem' }}>
                      {s.telefone_vendedor || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!readOnly && (
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() =>
                              openEdit(s.id, {
                                nome: s.nome,
                                cnpj_cpf: s.cnpj_cpf,
                                telefone: s.telefone,
                                email: s.email,
                                nome_vendedor: s.nome_vendedor,
                                telefone_vendedor: s.telefone_vendedor,
                              })
                            }
                          >
                            <Pencil size={13} />
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
