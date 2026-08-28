import { useState } from 'react'
import { usePedidos } from '../hooks/usePedidos'
import { useFinanceData } from '@/context/FinanceDataContext'
import { Modal } from '../components/ui/Modal'
import { Field, FieldRow } from '../components/ui/Field'
import { Badge } from '../components/ui/badge'
import { LoadingState, ErrorState } from '../components/ui/EmptyState'
import { fmtCur, fmtDate, addDays, todayISO } from '../lib/utils'
import type { Pedido, Fornecedor, Produto } from '../types'

interface Props {
  fornecedores: Fornecedor[]
  produtos: Produto[]
}

export function Aprovacao({ fornecedores, produtos }: Props) {
  const { data: pedidos, loading, error, updateStatus } = usePedidos()
  const { gerarParcelas } = useFinanceData().contasPagar

  const [appOrder, setAppOrder] = useState<Pedido | null>(null)
  const [inst, setInst] = useState('3')
  const [fdd, setFdd] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  const pending = pedidos.filter(o => o.status === 'aguardando_aprovacao')
  const processed = pedidos.filter(o => o.status !== 'aguardando_aprovacao')

  const approve = async () => {
    if (!appOrder) return
    setSaving(true)
    try {
      const n = parseInt(inst) || 1
      const supNome = fornecedores.find(s => s.id === appOrder.fornecedor_id)?.nome ?? ''
      await gerarParcelas({
        pedido_id: appOrder.id,
        fornecedor_id: appOrder.fornecedor_id,
        fornecedor_nome: supNome,
        valor_total: appOrder.total,
        num_parcelas: n,
        primeiro_vencimento: fdd,
      })
      await updateStatus(appOrder.id, 'aprovado')
      setAppOrder(null)
    } finally { setSaving(false) }
  }

  const reject = async (id: string) => {
    await updateStatus(id, 'recusado')
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#f2d892', letterSpacing: '.08em' }}>Aprovação de Pedidos</h1>
        <p className="section-label mt-1">{pending.length} pedido{pending.length !== 1 ? 's' : ''} aguardando</p>
      </div>

      {/* Approve Modal */}
      <Modal open={!!appOrder} onClose={() => setAppOrder(null)} title="CONFIRMAR APROVAÇÃO">
        {appOrder && (
          <>
            <div style={{ background: 'rgba(240,210,140,.07)', border: '1px solid rgba(240,210,140,.2)', borderRadius: 8, padding: '.85rem 1rem', marginBottom: '1rem' }}>
              <div className="flex justify-between items-center">
                <span style={{ color: '#fffaf4', fontWeight: 600 }}>{fornecedores.find(s => s.id === appOrder.fornecedor_id)?.nome}</span>
                <span className="font-display" style={{ fontSize: '1.4rem', color: '#f2d892' }}>{fmtCur(appOrder.total)}</span>
              </div>
            </div>
            <FieldRow>
              <Field label="Número de Parcelas" half>
                <input className="glass-input" type="number" value={inst} onChange={e => setInst(e.target.value)} min="1" max="60" />
              </Field>
              <Field label="Vencimento da 1ª Parcela" half>
                <input className="glass-input" type="date" value={fdd} onChange={e => setFdd(e.target.value)} />
              </Field>
            </FieldRow>
            {parseInt(inst) > 0 && (
              <div style={{ background: 'rgba(74,222,128,.06)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, padding: '.6rem .85rem', marginBottom: '.75rem' }}>
                <span style={{ color: '#4ade80', fontSize: '.82rem' }}>
                  {inst}× de {fmtCur(appOrder.total / parseInt(inst))} · 1ª: {fmtDate(fdd)} · Última: {fmtDate(addDays(fdd, (parseInt(inst) - 1) * 30))}
                </span>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <button className="btn btn-outline btn-md" onClick={() => setAppOrder(null)}>Cancelar</button>
              <button className="btn btn-gold btn-md" onClick={approve} disabled={saving}>
                {saving ? 'Aprovando...' : '✓ Aprovar e Gerar Parcelas'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Pending orders */}
      {pending.length === 0 ? (
        <div className="glass-card p-8 text-center" style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>✅</div>
          <p style={{ color: '#4ade80', fontWeight: 600 }}>Todos os pedidos foram processados!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {pending.map(o => {
            const sup = fornecedores.find(s => s.id === o.fornecedor_id)
            return (
              <div key={o.id} className="glass-card p-5">
                <div className="flex flex-wrap gap-4 justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-display" style={{ color: '#f2d892', fontSize: '1rem', letterSpacing: '.08em' }}>PEDIDO #{o.id.slice(-6)}</span>
                      <Badge status={o.status} />
                    </div>
                    <p style={{ color: '#fffaf4', fontWeight: 600 }}>{sup?.nome}</p>
                    <p style={{ color: '#edd9c4', fontSize: '.78rem', marginTop: 2 }}>{fmtDate(o.data_pedido)} · {o.movelaria_pedidos_itens?.length ?? 0} item(s)</p>
                  </div>
                  <span className="font-display" style={{ fontSize: '1.8rem', color: '#f2d892' }}>{fmtCur(o.total)}</span>
                </div>
                <div className="divider-gold" />
                <div className="overflow-x-auto mb-4">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
                    <thead><tr>
                      {['Produto', 'Qtd', 'Unit.', 'Total'].map((h, i) => <th key={i} className="section-label text-left py-1 pr-4">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {o.movelaria_pedidos_itens?.map((it, i) => {
                        const pr = produtos.find(p => p.id === it.produto_id) ?? it.movelaria_produtos
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(240,210,140,.07)' }}>
                            <td className="py-1.5 pr-4" style={{ color: '#fffaf4' }}>{pr?.descricao ?? '—'}</td>
                            <td className="py-1.5 pr-4" style={{ color: '#edd9c4' }}>{it.quantidade} {pr?.unidade_medida}</td>
                            <td className="py-1.5 pr-4" style={{ color: '#edd9c4' }}>{fmtCur(it.valor_unitario)}</td>
                            <td className="py-1.5" style={{ color: '#f2d892', fontWeight: 600 }}>{fmtCur(it.valor_total)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2 justify-end">
                  <button className="btn btn-danger btn-md" onClick={() => reject(o.id)}>✗ Recusar</button>
                  <button className="btn btn-success btn-md" onClick={() => { setAppOrder(o); setInst('3'); setFdd(todayISO()) }}>
                    ✓ Aprovar e Parcelar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* History */}
      {processed.length > 0 && (
        <>
          <div className="section-label mb-3 mt-2">HISTÓRICO PROCESSADO</div>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid rgba(240,210,140,.18)' }}>
                  {['#', 'Fornecedor', 'Data', 'Total', 'Status'].map((h, i) => <th key={i} className="section-label text-left px-4 py-3">{h}</th>)}
                </tr></thead>
                <tbody>
                  {processed.map(o => (
                    <tr key={o.id} className="trow">
                      <td className="px-4 py-3" style={{ color: '#f2d892', fontWeight: 600 }}>#{o.id.slice(-6)}</td>
                      <td className="px-4 py-3" style={{ color: '#fffaf4' }}>{fornecedores.find(s => s.id === o.fornecedor_id)?.nome ?? '—'}</td>
                      <td className="px-4 py-3" style={{ color: '#edd9c4' }}>{fmtDate(o.data_pedido)}</td>
                      <td className="px-4 py-3" style={{ color: '#f2d892', fontWeight: 600 }}>{fmtCur(o.total)}</td>
                      <td className="px-4 py-3"><Badge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
