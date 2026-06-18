import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useClientes } from '../hooks/useClientes'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field } from '../components/ui/Field'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import type { ClienteInput } from '../types'
import { fmtDate } from '../lib/utils'

const BLANK: ClienteInput = {
  nome: '',
  cpf: '',
  telefone: '',
  email: '',
  endereco: '',
  origem: 'Manual',
}

interface Props { readOnly?: boolean }

export function Clientes({ readOnly }: Props) {
  const { data, loading, error, create, update, remove } = useClientes()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ClienteInput>(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const f = (k: keyof ClienteInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const openNew = () => { setForm(BLANK); setEditId(null); setOpen(true) }
  const openEdit = (id: string, item: ClienteInput) => { setForm(item); setEditId(id); setOpen(true) }

  const save = async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      if (editId) await update(editId, form)
      else await create(form)
      setOpen(false)
    } finally { setSaving(false) }
  }

  const normalizedSearch = search.trim().toLowerCase()
  const filteredData = data.filter(cliente => {
    if (!normalizedSearch) return true
    const haystack = [
      cliente.nome,
      cliente.telefone ?? '',
      cliente.email ?? '',
      cliente.origem ?? '',
      cliente.cpf ?? '',
      cliente.endereco ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalizedSearch)
  })

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#f2d892', letterSpacing: '.08em' }}>Clientes</h1>
          <p className="section-label mt-1">{filteredData.length} cliente{filteredData.length !== 1 ? 's' : ''}</p>
        </div>
        {!readOnly && (
          <button type="button" className="btn btn-gold btn-md" onClick={openNew}>
            + Novo Cliente
          </button>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'EDITAR CLIENTE' : 'NOVO CLIENTE'}>
        <Field label="Nome Completo *">
          <input className="glass-input" value={form.nome} onChange={f('nome')} placeholder="Nome completo do cliente" />
        </Field>
        <Field label="CPF">
          <input className="glass-input" value={form.cpf ?? ''} onChange={f('cpf')} placeholder="000.000.000-00" />
        </Field>
        <Field label="Celular">
          <input className="glass-input" value={form.telefone ?? ''} onChange={f('telefone')} placeholder="(00) 00000-0000" />
        </Field>
        <Field label="E-mail">
          <input className="glass-input" type="email" value={form.email ?? ''} onChange={f('email')} placeholder="cliente@email.com" />
        </Field>
        <Field label="Endereço">
          <input className="glass-input" value={form.endereco ?? ''} onChange={f('endereco')} placeholder="Rua, Nº, Bairro, Cidade – UF" />
        </Field>
        <Field label="Origem">
          <input className="glass-input" value={form.origem ?? ''} onChange={f('origem')} placeholder="Manual ou origem do lead" />
        </Field>
        <ModalFormFooter
          onCancel={() => setOpen(false)}
          onSubmit={save}
          submitLabel={editId ? 'Salvar' : 'Cadastrar'}
          submitting={saving}
          submitDisabled={!form.nome.trim()}
        />
      </Modal>

      <div className="mb-4">
        <input
          className="glass-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone, e-mail, origem, CPF ou endereço..."
        />
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : filteredData.length === 0 ? (
          <EmptyState message="Nenhum cliente cadastrado." />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(240,210,140,.18)' }}>
                  {['Nome', 'CPF', 'Celular', 'E-mail', 'Origem', 'Cadastro', 'Endereço', ''].map((h, i) => (
                    <th key={i} className="section-label text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map(c => (
                  <tr key={c.id} className="trow">
                    <td className="px-4 py-3" style={{ color: '#fffaf4', fontWeight: 500 }}>{c.nome}</td>
                    <td className="px-4 py-3" style={{ color: '#edd9c4', fontSize: '.85rem' }}>{c.cpf || '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#edd9c4', fontSize: '.85rem' }}>{c.telefone || '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#edd9c4', fontSize: '.85rem' }}>{c.email || '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#edd9c4', fontSize: '.82rem' }}>{c.origem || '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#edd9c4', fontSize: '.82rem' }}>{fmtDate(c.data_cadastro || c.criado_em)}</td>
                    <td className="px-4 py-3" style={{ color: '#edd9c4', fontSize: '.82rem', maxWidth: 200 }}>{c.endereco || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {!readOnly && (
                        <div className="flex gap-2 justify-end">
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(c.id, { nome: c.nome, cpf: c.cpf, telefone: c.telefone, email: c.email, endereco: c.endereco, origem: c.origem })}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>
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
