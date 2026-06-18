import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useProdutos } from '../hooks/useProdutos'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field, FieldRow } from '../components/ui/Field'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import { fmtCur } from '../lib/utils'
import type { Fornecedor, ProdutoInput } from '../types'

const UNITS = ['m²', 'metros', 'unidade', 'par', 'kg', 'litros', 'caixa', 'peça']
const BLANK: ProdutoInput = { descricao: '', fornecedor_id: undefined, unidade_medida: 'm²', especificacoes: '', preco_unitario: 0 }

interface Props { fornecedores: Fornecedor[]; readOnly?: boolean }

export function Produtos({ fornecedores, readOnly }: Props) {
  const { data, loading, error, create, update, remove } = useProdutos()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ProdutoInput>(BLANK)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const f = (k: keyof ProdutoInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const openNew = () => { setForm(BLANK); setEditId(null); setOpen(true) }
  const openEdit = (id: string, item: ProdutoInput) => { setForm(item); setEditId(id); setOpen(true) }

  const save = async () => {
    if (!form.descricao.trim()) return
    setSaving(true)
    try {
      const payload: ProdutoInput = {
        ...form,
        preco_unitario: parseFloat(String(form.preco_unitario)) || 0,
        fornecedor_id: form.fornecedor_id || undefined,
      }
      if (editId) await update(editId, payload)
      else await create(payload)
      setOpen(false)
    } finally { setSaving(false) }
  }

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#f2d892', letterSpacing: '.08em' }}>Produtos</h1>
          <p className="section-label mt-1">{data.length} produto{data.length !== 1 ? 's' : ''}</p>
        </div>
        {!readOnly && (
          <button type="button" className="btn btn-gold btn-md" onClick={openNew}>
            + Novo Produto
          </button>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'EDITAR PRODUTO' : 'NOVO PRODUTO'}>
        <Field label="Descrição *">
          <input className="glass-input" value={form.descricao} onChange={f('descricao')} placeholder="Ex: Chapa MDF Canela 15mm" />
        </Field>
        <Field label="Fornecedor">
          <select className="glass-input" value={form.fornecedor_id ?? ''} onChange={f('fornecedor_id')}>
            <option value="">Selecionar fornecedor...</option>
            {fornecedores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Field>
        <FieldRow>
          <Field label="Unidade de Medida" half>
            <select className="glass-input" value={form.unidade_medida} onChange={f('unidade_medida')}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Preço Unitário (R$)" half>
            <input className="glass-input" type="number" value={form.preco_unitario} onChange={f('preco_unitario')} placeholder="0,00" step="0.01" min="0" />
          </Field>
        </FieldRow>
        <Field label="Especificações Técnicas">
          <textarea className="glass-input" value={form.especificacoes ?? ''} onChange={f('especificacoes')} placeholder="Ex: MDF E1 Canela 15mm 2,75×1,84m" />
        </Field>
        <ModalFormFooter
          onCancel={() => setOpen(false)}
          onSubmit={save}
          submitLabel={editId ? 'Salvar' : 'Cadastrar'}
          submitting={saving}
          submitDisabled={!form.descricao.trim()}
        />
      </Modal>

      <div className="glass-card overflow-hidden">
        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : data.length === 0 ? (
          <EmptyState message="Nenhum produto cadastrado." />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(240,210,140,.18)' }}>
                  {['Descrição', 'Fornecedor', 'Unidade', 'Especificações', 'Preço Unit.', ''].map((h, i) => (
                    <th key={i} className="section-label text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(p => (
                  <tr key={p.id} className="trow">
                    <td className="px-4 py-3" style={{ color: '#fffaf4', fontWeight: 500 }}>{p.descricao}</td>
                    <td className="px-4 py-3" style={{ color: '#edd9c4', fontSize: '.85rem' }}>{p.movelaria_fornecedores?.nome ?? '—'}</td>
                    <td className="px-4 py-3"><span className="badge badge-blue">{p.unidade_medida}</span></td>
                    <td className="px-4 py-3" style={{ color: '#edd9c4', fontSize: '.8rem', maxWidth: 200 }}>{p.especificacoes || '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#f2d892', fontWeight: 600 }}>{fmtCur(p.preco_unitario)}</td>
                    <td className="px-4 py-3 text-right">
                      {!readOnly && (
                        <div className="flex gap-2 justify-end">
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(p.id, { descricao: p.descricao, fornecedor_id: p.fornecedor_id, unidade_medida: p.unidade_medida, especificacoes: p.especificacoes, preco_unitario: p.preco_unitario })}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>
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
