import { useState } from 'react'
import { Eye, X } from 'lucide-react'
import { usePedidos } from '../hooks/usePedidos'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import { fmtCur, fmtDate } from '../lib/utils'
import type { Fornecedor, Produto, Pedido } from '../types'

interface ItemForm {
  produto_id: string
  quantidade: string
  valor_unitario: string
  unit: string
}

interface Props {
  fornecedores: Fornecedor[]
  produtos: Produto[]
  readOnly?: boolean
}

export function PedidosCompra({ fornecedores, produtos, readOnly }: Props) {
  const { data, loading, error, create } = usePedidos()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<Pedido | null>(null)
  const [selSup, setSelSup] = useState('')
  const [items, setItems] = useState<ItemForm[]>([])
  const [saving, setSaving] = useState(false)

  const addItem = () => setItems(p => [...p, { produto_id: '', quantidade: '1', valor_unitario: '0', unit: '' }])

  const updItem = (idx: number, k: keyof ItemForm, v: string) =>
    setItems(p => p.map((x, i) => {
      if (i !== idx) return x
      const u = { ...x, [k]: v }
      if (k === 'produto_id') {
        const pr = produtos.find(p => p.id === v)
        if (pr) { u.unit = pr.unidade_medida; u.valor_unitario = String(pr.preco_unitario) }
      }
      return u
    }))

  const total = items.reduce((s, x) => s + (parseFloat(x.quantidade) || 0) * (parseFloat(x.valor_unitario) || 0), 0)

  const save = async () => {
    if (!selSup || !items.length) return
    setSaving(true)
    try {
      const itensParsed = items.map(x => ({
        produto_id: x.produto_id,
        quantidade: parseFloat(x.quantidade) || 0,
        valor_unitario: parseFloat(x.valor_unitario) || 0,
        valor_total: (parseFloat(x.quantidade) || 0) * (parseFloat(x.valor_unitario) || 0),
      }))
      await create(selSup, itensParsed, total)
      setOpen(false); setSelSup(''); setItems([])
    } finally { setSaving(false) }
  }

  const statusLabel: Record<string, string> = {
    aguardando_aprovacao: 'Aguardando Aprovação',
    aprovado: 'Aprovado',
    recusado: 'Recusado',
  }

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#f2d892', letterSpacing: '.08em' }}>Pedidos de Compra</h1>
          <p className="section-label mt-1">{data.length} pedido{data.length !== 1 ? 's' : ''}</p>
        </div>
        {!readOnly && <button className="btn btn-gold btn-md" onClick={() => setOpen(true)}>+ Novo Pedido</button>}
      </div>

      {/* New Order Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="NOVO PEDIDO DE COMPRA" wide>
        <Field label="Fornecedor *">
          <select className="glass-input" value={selSup} onChange={e => setSelSup(e.target.value)}>
            <option value="">Selecionar fornecedor...</option>
            {fornecedores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Field>
        <div className="divider-gold" />
        <div className="flex justify-between items-center mb-3">
          <span className="section-label">Itens do Pedido</span>
          <button className="btn btn-outline btn-sm" onClick={addItem}>+ Adicionar Item</button>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#edd9c4', fontSize: '.85rem' }}>
            Clique em "+ Adicionar Item" para incluir produtos
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', marginBottom: '.75rem' }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ background: 'rgba(240,210,140,.05)', border: '1px solid rgba(240,210,140,.12)', borderRadius: 8, padding: '.8rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.2fr 1.2fr auto', gap: '.5rem', alignItems: 'end' }}>
                  <div>
                    <div className="section-label mb-1">Produto</div>
                    <select className="glass-input" value={item.produto_id} onChange={e => updItem(idx, 'produto_id', e.target.value)}>
                      <option value="">Selecionar...</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.descricao}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="section-label mb-1">Unidade</div>
                    <div className="glass-input flex items-center" style={{ height: 36, color: '#edd9c4', fontSize: '.8rem' }}>{item.unit || '—'}</div>
                  </div>
                  <div>
                    <div className="section-label mb-1">Qtd</div>
                    <input className="glass-input" type="number" value={item.quantidade} onChange={e => updItem(idx, 'quantidade', e.target.value)} min="0.01" step="0.01" />
                  </div>
                  <div>
                    <div className="section-label mb-1">Valor Unit.</div>
                    <input className="glass-input" type="number" value={item.valor_unitario} onChange={e => updItem(idx, 'valor_unitario', e.target.value)} min="0" step="0.01" />
                  </div>
                  <button onClick={() => setItems(p => p.filter((_, j) => j !== idx))} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.3rem', paddingBottom: 4 }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ textAlign: 'right', marginTop: '.4rem', color: '#f2d892', fontSize: '.82rem', fontWeight: 600 }}>
                  Subtotal: {fmtCur((parseFloat(item.quantidade) || 0) * (parseFloat(item.valor_unitario) || 0))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="divider-gold" />
        <div className="flex justify-between items-center mb-4">
          <span style={{ color: '#edd9c4', fontSize: '.85rem' }}>Total do Pedido:</span>
          <span className="font-display" style={{ fontSize: '1.6rem', color: '#f2d892' }}>{fmtCur(total)}</span>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-outline btn-md" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="btn btn-gold btn-md" onClick={save} disabled={saving || !selSup || !items.length}>
            {saving ? 'Salvando...' : 'Salvar Pedido'}
          </button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`PEDIDO #${detail?.id.slice(-6)}`} wide>
        {detail && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              {[
                ['Fornecedor', detail.movelaria_fornecedores?.nome ?? '—'],
                ['Data', fmtDate(detail.data_pedido)],
                ['Status', <Badge key="s" status={detail.status} />],
                ['Total', <span key="t" style={{ color: '#f2d892', fontWeight: 700 }}>{fmtCur(detail.total)}</span>],
              ].map(([l, v], i) => (
                <div key={i}><div className="section-label mb-1">{l}</div><div style={{ color: '#fffaf4', fontSize: '.9rem' }}>{v}</div></div>
              ))}
            </div>
            <div className="divider-gold" />
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(240,210,140,.15)' }}>
                {['Produto', 'Qtd / Un.', 'Unit.', 'Total'].map((h, i) => <th key={i} className="section-label text-left px-2 py-2">{h}</th>)}
              </tr></thead>
              <tbody>
                {detail.movelaria_pedidos_itens?.map((it, i) => (
                  <tr key={i} className="trow">
                    <td className="px-2 py-2" style={{ color: '#fffaf4', fontSize: '.85rem' }}>{it.movelaria_produtos?.descricao ?? '—'}</td>
                    <td className="px-2 py-2" style={{ color: '#edd9c4', fontSize: '.85rem' }}>{it.quantidade} {it.movelaria_produtos?.unidade_medida}</td>
                    <td className="px-2 py-2" style={{ color: '#edd9c4', fontSize: '.85rem' }}>{fmtCur(it.valor_unitario)}</td>
                    <td className="px-2 py-2" style={{ color: '#f2d892', fontWeight: 600, fontSize: '.85rem' }}>{fmtCur(it.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Modal>

      <div className="glass-card overflow-hidden">
        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : data.length === 0 ? (
          <EmptyState message="Nenhum pedido registrado." />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(240,210,140,.18)' }}>
                {['#', 'Fornecedor', 'Data', 'Total', 'Status', ''].map((h, i) => <th key={i} className="section-label text-left px-4 py-3">{h}</th>)}
              </tr></thead>
              <tbody>
                {data.map(o => (
                  <tr key={o.id} className="trow">
                    <td className="px-4 py-3" style={{ color: '#f2d892', fontWeight: 600, fontSize: '.85rem' }}>#{o.id.slice(-6)}</td>
                    <td className="px-4 py-3" style={{ color: '#fffaf4' }}>{o.movelaria_fornecedores?.nome ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#edd9c4', fontSize: '.85rem' }}>{fmtDate(o.data_pedido)}</td>
                    <td className="px-4 py-3" style={{ color: '#f2d892', fontWeight: 600 }}>{fmtCur(o.total)}</td>
                    <td className="px-4 py-3"><Badge status={o.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn btn-outline btn-sm" onClick={() => setDetail(o)}>
                        <Eye size={13} /> Ver
                      </button>
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
