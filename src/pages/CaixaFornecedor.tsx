import { useState, useMemo } from 'react'
import { History, Pencil, PlusCircle, Search, Trash2 } from 'lucide-react'
import { useCaixaFornecedor } from '../hooks/useCaixaFornecedor'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field } from '../components/ui/Field'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import { fmtCur, fmtDate, parseMoneyBr } from '../lib/utils'
import type { Fornecedor, FormaPagamentoCaixa, TransacaoCaixaFornecedor, UserRole } from '../types'

const FORMAS: { value: FormaPagamentoCaixa; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cartao', label: 'Cartão' },
]

interface CreditoForm {
  fornecedorId: string
  valor: string
  formaPagamento: FormaPagamentoCaixa
  descricao: string
}

interface EditTxForm {
  valor: string
  formaPagamento: FormaPagamentoCaixa
  descricao: string
}

interface Props {
  fornecedores: Fornecedor[]
  roles?: UserRole[]
  readOnly?: boolean
}

export function CaixaFornecedor({ fornecedores, roles = [], readOnly }: Props) {
  const {
    caixas,
    loading,
    error,
    getSaldoFornecedor,
    adicionarCredito,
    loadTransacoes,
    editarTransacao,
    excluirTransacao,
  } = useCaixaFornecedor()

  const isAdmin = roles.includes('Administrador')

  // --- Estado: Adicionar Crédito ---
  const [creditoOpen, setCreditoOpen] = useState(false)
  const [creditoForm, setCreditoForm] = useState<CreditoForm>({
    fornecedorId: '',
    valor: '',
    formaPagamento: 'pix',
    descricao: '',
  })
  const [creditoSaving, setCreditoSaving] = useState(false)
  const [creditoError, setCreditoError] = useState<string | null>(null)

  // --- Estado: Histórico ---
  const [histOpen, setHistOpen] = useState(false)
  const [histFornecedor, setHistFornecedor] = useState<Fornecedor | null>(null)
  const [histTransacoes, setHistTransacoes] = useState<TransacaoCaixaFornecedor[]>([])
  const [histLoading, setHistLoading] = useState(false)

  // --- Estado: Busca ---
  const [busca, setBusca] = useState('')

  // --- Estado: Editar Transação ---
  const [editTxOpen, setEditTxOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<TransacaoCaixaFornecedor | null>(null)
  const [editTxForm, setEditTxForm] = useState<EditTxForm>({ valor: '', formaPagamento: 'pix', descricao: '' })
  const [editTxSaving, setEditTxSaving] = useState(false)
  const [editTxError, setEditTxError] = useState<string | null>(null)

  // --- Helpers ---
  const cf = (k: keyof CreditoForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setCreditoForm(p => ({ ...p, [k]: e.target.value }))

  const etf = (k: keyof EditTxForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setEditTxForm(p => ({ ...p, [k]: e.target.value }))

  // --- Ações: Adicionar Crédito ---
  const openCredito = (fornecedorId = '') => {
    setCreditoForm({ fornecedorId, valor: '', formaPagamento: 'pix', descricao: '' })
    setCreditoError(null)
    setCreditoOpen(true)
  }

  const saveCredito = async () => {
    if (!creditoForm.fornecedorId) { setCreditoError('Selecione um fornecedor.'); return }
    const valor = parseMoneyBr(creditoForm.valor)
    if (!valor || valor <= 0) { setCreditoError('Informe um valor válido.'); return }
    setCreditoSaving(true)
    setCreditoError(null)
    try {
      await adicionarCredito(creditoForm.fornecedorId, valor, creditoForm.formaPagamento, creditoForm.descricao || undefined)
      setCreditoOpen(false)
    } catch (e) {
      setCreditoError(e instanceof Error ? e.message : 'Erro ao salvar crédito.')
    } finally {
      setCreditoSaving(false)
    }
  }

  // --- Ações: Histórico ---
  const openHistorico = async (fornecedor: Fornecedor) => {
    setHistFornecedor(fornecedor)
    setHistTransacoes([])
    setHistLoading(true)
    setHistOpen(true)
    try {
      const txs = await loadTransacoes(fornecedor.id)
      setHistTransacoes(txs)
    } finally {
      setHistLoading(false)
    }
  }

  const reloadHistorico = async () => {
    if (!histFornecedor) return
    setHistLoading(true)
    try {
      const txs = await loadTransacoes(histFornecedor.id)
      setHistTransacoes(txs)
    } finally {
      setHistLoading(false)
    }
  }

  // --- Ações: Editar Transação ---
  const openEditTx = (tx: TransacaoCaixaFornecedor) => {
    setEditingTx(tx)
    setEditTxForm({
      valor: String(tx.valor),
      formaPagamento: tx.forma_pagamento ?? 'pix',
      descricao: tx.descricao ?? '',
    })
    setEditTxError(null)
    setEditTxOpen(true)
  }

  const saveEditTx = async () => {
    if (!editingTx) return
    const valor = parseMoneyBr(editTxForm.valor)
    if (!valor || valor <= 0) { setEditTxError('Informe um valor válido.'); return }
    setEditTxSaving(true)
    setEditTxError(null)
    try {
      await editarTransacao(editingTx, {
        valor,
        forma_pagamento: editTxForm.formaPagamento,
        descricao: editTxForm.descricao || undefined,
      })
      setEditTxOpen(false)
      await reloadHistorico()
    } catch (e) {
      setEditTxError(e instanceof Error ? e.message : 'Erro ao editar transação.')
    } finally {
      setEditTxSaving(false)
    }
  }

  // --- Ações: Excluir Transação ---
  const handleExcluirTx = async (tx: TransacaoCaixaFornecedor) => {
    if (!confirm('Deseja realmente apagar esta transação? O saldo do fornecedor será recalculado.')) return
    try {
      await excluirTransacao(tx)
      await reloadHistorico()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao excluir transação.')
    }
  }

  const fornecedoresFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return fornecedores
    return fornecedores.filter(f =>
      f.nome.toLowerCase().includes(q) ||
      (f.cnpj_cpf ?? '').toLowerCase().replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
      (f.cnpj_cpf ?? '').toLowerCase().includes(q),
    )
  }, [fornecedores, busca])

  const totalSaldo = caixas.reduce((s, c) => s + c.saldo_atual, 0)

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#f2d892', letterSpacing: '.08em' }}>
            Caixa Fornecedor
          </h1>
          <p className="section-label mt-1">Créditos e saldos por fornecedor</p>
        </div>
        {!readOnly && (
          <button type="button" className="btn btn-gold btn-md" onClick={() => openCredito()}>
            + Adicionar Crédito
          </button>
        )}
      </div>

      <div className="glass-card p-4 mb-5 inline-block">
        <div className="section-label mb-1">Total em Caixa</div>
        <div className="font-display" style={{ fontSize: '1.5rem', color: '#4ade80' }}>{fmtCur(totalSaldo)}</div>
      </div>

      {/* Modal — Adicionar Crédito */}
      <Modal
        open={creditoOpen}
        onClose={() => setCreditoOpen(false)}
        title="ADICIONAR CRÉDITO AO FORNECEDOR"
        wide
        closeOnBackdrop={false}
      >
        <Field label="Fornecedor">
          <select className="glass-input" value={creditoForm.fornecedorId} onChange={cf('fornecedorId')}>
            <option value="">Selecionar...</option>
            {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </Field>
        <Field label="Valor (R$)">
          <input
            className="glass-input"
            type="number"
            min="0.01"
            step="0.01"
            value={creditoForm.valor}
            onChange={cf('valor')}
            placeholder="0,00"
          />
        </Field>
        <Field label="Forma de Pagamento">
          <select className="glass-input" value={creditoForm.formaPagamento} onChange={cf('formaPagamento')}>
            {FORMAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </Field>
        <Field label="Descrição (opcional)">
          <input
            className="glass-input"
            value={creditoForm.descricao}
            onChange={cf('descricao')}
            placeholder="Ex: Adiantamento para pedido X"
          />
        </Field>
        {creditoError && <p className="mb-2 text-sm text-red-400">{creditoError}</p>}
        <ModalFormFooter
          onCancel={() => setCreditoOpen(false)}
          onSubmit={saveCredito}
          submitLabel="Salvar Crédito"
          submittingLabel="Salvando..."
          submitting={creditoSaving}
        />
      </Modal>

      {/* Modal — Editar Transação (somente Administrador) */}
      <Modal
        open={editTxOpen}
        onClose={() => setEditTxOpen(false)}
        title="EDITAR TRANSAÇÃO"
        wide
        closeOnBackdrop={false}
      >
        {editingTx && (
          <>
            <div className="mb-3 rounded-lg border border-[rgba(240,210,140,0.2)] bg-[rgba(240,210,140,0.06)] px-3 py-2 text-xs text-[#f2d892]">
              Tipo: <strong>{editingTx.tipo === 'credito' ? 'Crédito' : 'Débito'}</strong>
              {editingTx.conta_pagar_id && ' · vinculado a uma conta a pagar'}
            </div>
            <Field label="Valor (R$)">
              <input
                className="glass-input"
                type="number"
                min="0.01"
                step="0.01"
                value={editTxForm.valor}
                onChange={etf('valor')}
              />
            </Field>
            {editingTx.tipo === 'credito' && (
              <Field label="Forma de Pagamento">
                <select className="glass-input" value={editTxForm.formaPagamento} onChange={etf('formaPagamento')}>
                  {FORMAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Field>
            )}
            <Field label="Descrição (opcional)">
              <input
                className="glass-input"
                value={editTxForm.descricao}
                onChange={etf('descricao')}
                placeholder="Descrição da transação"
              />
            </Field>
            {editTxError && <p className="mb-2 text-sm text-red-400">{editTxError}</p>}
            <ModalFormFooter
              onCancel={() => setEditTxOpen(false)}
              onSubmit={saveEditTx}
              submitLabel="Salvar alterações"
              submittingLabel="Salvando..."
              submitting={editTxSaving}
            />
          </>
        )}
      </Modal>

      {/* Modal — Histórico de Transações */}
      <Modal
        open={histOpen}
        onClose={() => setHistOpen(false)}
        title={`HISTÓRICO — ${histFornecedor?.nome ?? ''}`}
        wide
      >
        {histLoading ? (
          <LoadingState />
        ) : histTransacoes.length === 0 ? (
          <EmptyState message="Nenhuma transação registrada para este fornecedor." />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(240,210,140,.18)' }}>
                  {['Data', 'Tipo', 'Valor', 'Forma', 'Saldo Anterior', 'Saldo Posterior', 'Descrição', ...(isAdmin ? [''] : [])].map((h, i) => (
                    <th key={i} className="section-label text-left px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {histTransacoes.map(tx => (
                  <tr key={tx.id} className="trow">
                    <td className="px-3 py-2 text-sm text-[#edd9c4]">{fmtDate(tx.criado_em ?? '')}</td>
                    <td className="px-3 py-2">
                      <span style={{ color: tx.tipo === 'credito' ? '#4ade80' : '#f87171', fontSize: '.82rem', fontWeight: 600 }}>
                        {tx.tipo === 'credito' ? '▲ Crédito' : '▼ Débito'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold" style={{ color: tx.tipo === 'credito' ? '#4ade80' : '#f87171' }}>
                      {fmtCur(tx.valor)}
                    </td>
                    <td className="px-3 py-2 text-sm text-[#edd9c4] capitalize">
                      {tx.forma_pagamento ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-[#edd9c4]">{fmtCur(tx.saldo_anterior)}</td>
                    <td className="px-3 py-2 text-sm" style={{ color: '#f2d892' }}>{fmtCur(tx.saldo_posterior)}</td>
                    <td className="px-3 py-2 text-sm text-[#edd9c4]">{tx.descricao ?? '—'}</td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm !px-2"
                            title="Editar transação"
                            onClick={() => openEditTx(tx)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm !px-2"
                            title="Apagar transação"
                            onClick={() => void handleExcluirTx(tx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Campo de busca */}
      <div className="relative mb-4" style={{ maxWidth: 380 }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#edd9c4] pointer-events-none" />
        <input
          className="glass-input pl-9"
          placeholder="Buscar por nome ou CNPJ/CPF..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Tabela de fornecedores e saldos */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(240,210,140,.18)' }}>
                  {['Fornecedor', 'Saldo Disponível', ''].map((h, i) => (
                    <th key={i} className="section-label text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fornecedoresFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-[#edd9c4]">
                      {busca ? 'Nenhum fornecedor encontrado para essa busca.' : 'Nenhum fornecedor cadastrado.'}
                    </td>
                  </tr>
                ) : (
                  fornecedoresFiltrados.map(f => {
                    const saldo = getSaldoFornecedor(f.id)
                    return (
                      <tr key={f.id} className="trow">
                        <td className="px-4 py-3" style={{ color: '#fffaf4' }}>
                          <div>{f.nome}</div>
                          {f.cnpj_cpf && <div className="text-xs text-[#edd9c4]">{f.cnpj_cpf}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-display" style={{ fontSize: '1.1rem', color: saldo > 0 ? '#4ade80' : '#edd9c4' }}>
                            {fmtCur(saldo)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm flex items-center gap-1"
                              onClick={() => openHistorico(f)}
                            >
                              <History className="h-3.5 w-3.5" /> Histórico
                            </button>
                            {!readOnly && (
                              <button
                                type="button"
                                className="btn btn-gold btn-sm flex items-center gap-1"
                                onClick={() => openCredito(f.id)}
                              >
                                <PlusCircle className="h-3.5 w-3.5" /> Crédito
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
