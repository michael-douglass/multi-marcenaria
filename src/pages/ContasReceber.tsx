import { useState } from 'react'
import { useContasReceber } from '../hooks/useContasReceber'
import { useOrcamentosFechados } from '../hooks/useOrcamentosFechados'
import { OrcamentosFechados } from '../components/cobrancas/OrcamentosFechados'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field, FieldRow } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { FilterBar } from '../components/ui/FilterBar'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import {
  applyPeriodFilter,
  DEFAULT_PERIOD,
  PeriodFilterBar,
  type PeriodFilter,
} from '../components/ui/PeriodFilterBar'
import { fmtCur, fmtDate, isOverdue, todayISO } from '../lib/utils'
import type { Cliente, ContaReceber, FormaPagamento } from '../types'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'

interface Props { clientes: Cliente[]; readOnly?: boolean }

type Filter = 'Todos' | 'Pendente' | 'Recebido' | 'Vencido'

const PAYMENT_METHODS: FormaPagamento[] = ['pix', 'dinheiro', 'cheque', 'boleto']
const PM_ICON: Record<FormaPagamento, string> = { pix: '⚡', dinheiro: '💵', cheque: '📝', boleto: '🏦', cartao: '💳' }
const PM_LABEL: Record<FormaPagamento, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cheque: 'Cheque', boleto: 'Boleto', cartao: 'Cartão' }

const getStatus = (vencimento: string, status: string): string => {
  if (status === 'recebido') return 'recebido'
  if (isOverdue(vencimento)) return 'vencido'
  return 'pendente'
}

export function ContasReceber({ clientes, readOnly }: Props) {
  const { role } = useApp()
  const isAdmin = role === 'Administrador'
  const { data, loading, error, gerarCobranca, marcarRecebido, atualizarTransacao, atualizarParcelasEmLote, removerTransacao } = useContasReceber()
  const orcamentos = useOrcamentosFechados()
  const [filter, setFilter] = useState<Filter>('Todos')
  const [search, setSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(DEFAULT_PERIOD)
  const [open, setOpen] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [openBulkEdit, setOpenBulkEdit] = useState(false)
  const [selectedConta, setSelectedConta] = useState<ContaReceber | null>(null)
  const [bulkParcelas, setBulkParcelas] = useState<ContaReceber[]>([])
  const [form, setForm] = useState({ clienteId: '', total: '', inst: '1', fdd: todayISO(), pm: 'pix' as FormaPagamento })
  const [editForm, setEditForm] = useState({
    valor_parcela: '',
    data_vencimento: todayISO(),
    forma_pagamento: 'pix' as FormaPagamento,
    status: 'pendente' as 'pendente' | 'recebido',
    data_recebimento: todayISO(),
  })
  const [saving, setSaving] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [savingBulk, setSavingBulk] = useState(false)
  const [openHistory, setOpenHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyRows, setHistoryRows] = useState<Array<{
    id: string
    acao: 'insert' | 'update' | 'delete'
    usuario_email: string | null
    criado_em: string
  }>>([])

  const openBulkEditModal = (conta: ContaReceber) => {
    // Busca todas as parcelas da mesma venda
    const related = data.filter(item => {
      if (conta.origem_lead_id) return item.origem_lead_id === conta.origem_lead_id
      return item.cliente_nome === conta.cliente_nome && item.valor_total === conta.valor_total
    }).sort((a, b) => a.numero_parcela - b.numero_parcela)

    setBulkParcelas(related)
    setOpenBulkEdit(true)
  }

  const updateBulkParcela = (index: number, field: 'valor_parcela' | 'data_vencimento', value: string | number) => {
    const newParcelas = [...bulkParcelas]
    const p = { ...newParcelas[index] }

    if (field === 'valor_parcela') {
      const newVal = parseFloat(value as string) || 0
      p.valor_parcela = newVal
      newParcelas[index] = p

      // Recalcula as próximas (apenas se não foram recebidas)
      const totalVenda = p.valor_total
      const jaPago = newParcelas.slice(0, index + 1).reduce((sum, item) => sum + item.valor_parcela, 0)
      const restante = totalVenda - jaPago
      
      const restGrid = newParcelas.slice(index + 1).filter(x => x.status !== 'recebido')
      const nRestantes = restGrid.length

      if (nRestantes > 0) {
        const valorRestUnit = restante / nRestantes
        let currentRest = 0
        for (let i = index + 1; i < newParcelas.length; i++) {
          if (newParcelas[i].status !== 'recebido') {
            currentRest++
            newParcelas[i] = {
              ...newParcelas[i],
              valor_parcela:
                currentRest === nRestantes
                  ? parseFloat((restante - valorRestUnit * (nRestantes - 1)).toFixed(2))
                  : parseFloat(valorRestUnit.toFixed(2)),
            }
          }
        }
      }
    } else if (field === 'data_vencimento') {
      p.data_vencimento = value as string
      newParcelas[index] = p
    }

    setBulkParcelas(newParcelas)
  }

  const saveBulkEdit = async () => {
    if (bulkParcelas.length === 0) return
    const totalVenda = bulkParcelas[0].valor_total
    const sum = bulkParcelas.reduce((acc, p) => acc + p.valor_parcela, 0)
    
    if (Math.abs(sum - totalVenda) > 0.01) {
      alert(`A soma das parcelas (${fmtCur(sum)}) deve ser igual ao valor total (${fmtCur(totalVenda)}).`)
      return
    }

    setSavingBulk(true)
    try {
      await atualizarParcelasEmLote(
        bulkParcelas.map(p => ({
          id: p.id,
          valor_parcela: p.valor_parcela,
          data_vencimento: p.data_vencimento,
        })),
        totalVenda,
      )
      setOpenBulkEdit(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao salvar alterações.')
    } finally {
      setSavingBulk(false)
    }
  }

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const dataComReferenciaPeriodo = data.map(item => ({
    ...item,
    // Regra financeira: quando já recebeu, o período deve usar a data de recebimento.
    data_vencimento: item.status === 'recebido' && item.data_recebimento
      ? item.data_recebimento
      : item.data_vencimento,
  }))
  const idsNoPeriodo = new Set(applyPeriodFilter(dataComReferenciaPeriodo, periodFilter).map(item => item.id))
  const periodBase = data.filter(item => idsNoPeriodo.has(item.id))
  const periodFiltered =
    periodFilter.mode === 'next-month'
      ? periodBase.filter(r => r.status !== 'recebido')
      : periodBase

  const totPend = periodFiltered.filter(r => r.status !== 'recebido').reduce((s, r) => s + r.valor_parcela, 0)
  const totRec  = periodFiltered.filter(r => r.status === 'recebido').reduce((s, r) => s + r.valor_parcela, 0)
  const totOver = periodFiltered.filter(r => r.status !== 'recebido' && isOverdue(r.data_vencimento)).reduce((s, r) => s + r.valor_parcela, 0)
  const totalLiquidoPeriodo = periodFiltered.reduce((s, r) => s + r.valor_parcela, 0)
  const totalBrutoViaOrcamentos = applyPeriodFilter(
    orcamentos.fechados.map(item => ({
      ...item,
      // fallback para manter o item no período mesmo quando o banco retornar data nula/incompleta
      data_vencimento: (item.criado_em ?? item.atualizado_em ?? `${todayISO()}T00:00:00`).slice(0, 10),
      valor_total_num: Number(item.valor_total ?? 0),
    })),
    periodFilter,
  ).reduce((s, item) => s + item.valor_total_num, 0)

  // Fallback robusto: reconstrói o bruto pelos lançamentos de orçamentos fechados no contas_receber.
  const brutoPorLead = new Map<string, number>()
  for (const row of periodFiltered) {
    if (row.origem_tipo !== 'orcamento_fechado') continue
    const chave = row.origem_lead_id ?? row.id
    const brutoAtual = brutoPorLead.get(chave) ?? 0
    const brutoLinha = Number(row.valor_total ?? 0)
    if (brutoLinha > brutoAtual) brutoPorLead.set(chave, brutoLinha)
  }
  const totalBrutoViaContas = Array.from(brutoPorLead.values()).reduce((s, v) => s + v, 0)

  const totalBrutoServicos = totalBrutoViaOrcamentos > 0 ? totalBrutoViaOrcamentos : totalBrutoViaContas

  const filtered = periodFiltered.filter(r => {
    // 1. Filtro de Status
    if (filter !== 'Todos') {
      if (getStatus(r.data_vencimento, r.status) !== filter.toLowerCase()) return false
    }

    // 2. Filtro de Busca (Nome, Telefone, Forma, Valores)
    if (search.trim()) {
      const term = search.toLowerCase().replace(/[\s\.\,]/g, '')
      
      const nome = (r.cliente_nome || '').toLowerCase().replace(/[\s\.\,]/g, '')
      const telefone = (r.cliente_telefone || '').replace(/[\s\.\,\-\(\)]/g, '')
      const valor = String(r.valor_parcela).replace(/[\s\.\,]/g, '')
      const total = String(r.valor_total).replace(/[\s\.\,]/g, '')
      const forma = PM_LABEL[r.forma_pagamento as FormaPagamento]?.toLowerCase() || ''

      const match = nome.includes(term) || 
                    telefone.includes(term) || 
                    valor.includes(term) || 
                    total.includes(term) || 
                    forma.includes(term)

      if (!match) return false
    }

    return true
  })

  const save = async () => {
    const tot = parseFloat(form.total)
    const cl = clientes.find(c => c.id === form.clienteId)
    if (!cl || !tot || tot <= 0) return
    setSaving(true)
    try {
      await gerarCobranca({
        cliente_id: cl.id,
        cliente_nome: cl.nome,
        valor_total: tot,
        num_parcelas: parseInt(form.inst) || 1,
        primeiro_vencimento: form.fdd,
        forma_pagamento: form.pm,
      })
      setForm({ clienteId: '', total: '', inst: '1', fdd: todayISO(), pm: 'pix' })
      setOpen(false)
    } finally { setSaving(false) }
  }

  const openEditModal = (conta: ContaReceber) => {
    setSelectedConta(conta)
    setEditForm({
      valor_parcela: String(conta.valor_parcela),
      data_vencimento: conta.data_vencimento,
      forma_pagamento: conta.forma_pagamento,
      status: conta.status,
      data_recebimento: conta.data_recebimento ?? todayISO(),
    })
    setOpenEdit(true)
  }

  const saveEdit = async () => {
    if (!selectedConta) return
    const valor = parseFloat(editForm.valor_parcela)
    if (!valor || valor <= 0) return
    setSavingEdit(true)
    try {
      await atualizarTransacao(selectedConta.id, {
        valor_parcela: valor,
        data_vencimento: editForm.data_vencimento,
        forma_pagamento: editForm.forma_pagamento,
        status: editForm.status,
        data_recebimento: editForm.status === 'recebido' ? editForm.data_recebimento : null,
      })
      setOpenEdit(false)
      setSelectedConta(null)
    } finally {
      setSavingEdit(false)
    }
  }

  const excluirTransacao = async (conta: ContaReceber) => {
    const ok = window.confirm(`Apagar a transação ${conta.numero_parcela}/${conta.total_parcelas} de ${conta.cliente_nome}?`)
    if (!ok) return
    await removerTransacao(conta.id)
    // Recarrega orçamentos para refletir retorno ao card de "aguardando lançamento"
    // e recalcular KPIs dependentes de orçamentos fechados.
    await orcamentos.reload()
  }

  const verHistorico = async (conta: ContaReceber) => {
    setSelectedConta(conta)
    setOpenHistory(true)
    setHistoryLoading(true)
    try {
      const { data: rows, error: histErr } = await supabase
        .from('movelaria_transacoes_historico')
        .select('id, acao, usuario_email, criado_em')
        .eq('tabela_origem', 'movelaria_contas_receber')
        .eq('registro_id', conta.id)
        .order('criado_em', { ascending: false })
      if (histErr) throw histErr
      setHistoryRows((rows ?? []) as Array<{
        id: string
        acao: 'insert' | 'update' | 'delete'
        usuario_email: string | null
        criado_em: string
      }>)
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>Cobranças & Contas a Receber</h1>
          <p className="section-label mt-1">
            {periodFiltered.length} parcela{periodFiltered.length !== 1 ? 's' : ''} no período
          </p>
        </div>
        {!readOnly && (
          <button type="button" className="btn btn-gold btn-md" onClick={() => setOpen(true)}>
            + Nova Cobrança
          </button>
        )}
      </div>

      {/* Orçamentos ganhos aguardando entrada no caixa */}
      <OrcamentosFechados
        leads={orcamentos.leads}
        loading={orcamentos.loading}
        error={orcamentos.error}
        onDarEntrada={orcamentos.darEntrada}
        onLoadHistorico={orcamentos.carregarHistoricoCliente}
      />

      {/* New Billing Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="NOVA COBRANÇA">
        <Field label="Cliente *">
          <select className="glass-input" value={form.clienteId} onChange={f('clienteId')}>
            <option value="">Selecionar cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
        <Field label="Valor Total da Venda (R$) *">
          <input className="glass-input" type="number" value={form.total} onChange={f('total')} placeholder="0,00" min="0" step="0.01" />
        </Field>
        <FieldRow>
          <Field label="Nº de Parcelas" half>
            <input className="glass-input" type="number" value={form.inst} onChange={f('inst')} min="1" max="60" />
          </Field>
          <Field label="1ª Parcela" half>
            <input className="glass-input" type="date" value={form.fdd} onChange={f('fdd')} />
          </Field>
        </FieldRow>
        <Field label="Forma de Pagamento">
          <select className="glass-input" value={form.pm} onChange={f('pm')}>
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>{PM_ICON[m]} {PM_LABEL[m]}</option>
            ))}
          </select>
        </Field>
        {form.total && parseInt(form.inst) > 0 && (
          <div style={{ background: 'rgba(74,222,128,.06)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, padding: '.6rem .85rem', marginBottom: '.5rem' }}>
            <span style={{ color: '#4ade80', fontSize: '.82rem' }}>
              {form.inst}× de {fmtCur(parseFloat(form.total) / parseInt(form.inst))} via {PM_LABEL[form.pm]} · 1ª: {fmtDate(form.fdd)}
            </span>
          </div>
        )}
        <ModalFormFooter
          onCancel={() => setOpen(false)}
          onSubmit={save}
          submitLabel="Emitir Cobrança"
          submittingLabel="Emitindo..."
          submitting={saving}
          submitDisabled={!form.clienteId || !form.total}
        />
      </Modal>

      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="EDITAR TRANSAÇÃO">
        <Field label="Valor da Parcela (R$) *">
          <input
            className="glass-input"
            type="number"
            min="0"
            step="0.01"
            value={editForm.valor_parcela}
            onChange={e => setEditForm(p => ({ ...p, valor_parcela: e.target.value }))}
          />
        </Field>
        <FieldRow>
          <Field label="Vencimento" half>
            <input
              className="glass-input"
              type="date"
              value={editForm.data_vencimento}
              onChange={e => setEditForm(p => ({ ...p, data_vencimento: e.target.value }))}
            />
          </Field>
          <Field label="Forma de Pagamento" half>
            <select
              className="glass-input"
              value={editForm.forma_pagamento}
              onChange={e => setEditForm(p => ({ ...p, forma_pagamento: e.target.value as FormaPagamento }))}
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{PM_ICON[m]} {PM_LABEL[m]}</option>
              ))}
              <option value="cartao">{PM_ICON.cartao} {PM_LABEL.cartao}</option>
            </select>
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Status" half>
            <select
              className="glass-input"
              value={editForm.status}
              onChange={e => setEditForm(p => ({ ...p, status: e.target.value as 'pendente' | 'recebido' }))}
            >
              <option value="pendente">Pendente</option>
              <option value="recebido">Recebido</option>
            </select>
          </Field>
          <Field label="Data de Recebimento" half>
            <input
              className="glass-input"
              type="date"
              value={editForm.data_recebimento}
              onChange={e => setEditForm(p => ({ ...p, data_recebimento: e.target.value }))}
              disabled={editForm.status !== 'recebido'}
            />
          </Field>
        </FieldRow>
        <ModalFormFooter
          onCancel={() => setOpenEdit(false)}
          onSubmit={saveEdit}
          submitLabel="Salvar Alterações"
          submitting={savingEdit}
          submitDisabled={!editForm.valor_parcela}
        />
      </Modal>

      <Modal open={openBulkEdit} onClose={() => setOpenBulkEdit(false)} title="EDITAR PARCELAMENTO">
        <div className="mb-4">
          <div className="section-label mb-2" style={{ color: '#d4a853', fontWeight: 600 }}>
            {bulkParcelas[0]?.cliente_nome} — Total: {fmtCur(bulkParcelas[0]?.valor_total)}
          </div>
          <div
            style={{
              display: 'grid',
              gap: '.5rem',
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '.5rem',
              background: 'rgba(212,168,83,.03)',
              border: '1px solid rgba(212,168,83,.1)',
              borderRadius: 8,
            }}
          >
            {bulkParcelas.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 1.2fr 80px',
                  gap: '.5rem',
                  alignItems: 'center',
                  padding: '.25rem',
                  borderRadius: 6,
                  background: p.status === 'recebido' ? 'rgba(74,222,128,.05)' : 'rgba(255,255,255,.02)',
                  opacity: p.status === 'recebido' ? 0.8 : 1,
                }}
              >
                <span className="section-label" style={{ textAlign: 'center', fontSize: '.75rem' }}>
                  {p.numero_parcela}/{p.total_parcelas}
                </span>
                <input
                  className="glass-input"
                  style={{ padding: '.35rem .5rem', fontSize: '.82rem' }}
                  type="number"
                  value={p.valor_parcela}
                  onChange={e => updateBulkParcela(i, 'valor_parcela', e.target.value)}
                  step="0.01"
                  disabled={p.status === 'recebido'}
                />
                <input
                  className="glass-input"
                  style={{ padding: '.35rem .5rem', fontSize: '.82rem' }}
                  type="date"
                  value={p.data_vencimento}
                  onChange={e => updateBulkParcela(i, 'data_vencimento', e.target.value)}
                  disabled={p.status === 'recebido'}
                />
                <div style={{ textAlign: 'center' }}>
                  <Badge status={p.status === 'recebido' ? 'recebido' : isOverdue(p.data_vencimento) ? 'vencido' : 'pendente'} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between px-1">
            <span className="section-label" style={{ fontSize: '.75rem' }}>
              Soma: {fmtCur(bulkParcelas.reduce((acc, p) => acc + p.valor_parcela, 0))}
            </span>
            {Math.abs(bulkParcelas.reduce((acc, p) => acc + p.valor_parcela, 0) - (bulkParcelas[0]?.valor_total || 0)) > 0.01 && (
              <span className="text-red-400" style={{ fontSize: '.75rem' }}>
                Diferença: {fmtCur((bulkParcelas[0]?.valor_total || 0) - bulkParcelas.reduce((acc, p) => acc + p.valor_parcela, 0))}
              </span>
            )}
          </div>
        </div>
        <ModalFormFooter
          onCancel={() => setOpenBulkEdit(false)}
          onSubmit={saveBulkEdit}
          submitLabel="Salvar Parcelamento"
          submitting={savingBulk}
          submittingLabel="Salvando..."
          submitDisabled={
            bulkParcelas.length === 0 ||
            Math.abs(bulkParcelas.reduce((acc, p) => acc + p.valor_parcela, 0) - (bulkParcelas[0]?.valor_total || 0)) > 0.01
          }
        />
      </Modal>

      <Modal open={openHistory} onClose={() => setOpenHistory(false)} title="HISTÓRICO DA TRANSAÇÃO">
        {historyLoading ? (
          <LoadingState />
        ) : historyRows.length === 0 ? (
          <EmptyState message="Sem eventos históricos para esta transação." />
        ) : (
          <div style={{ display: 'grid', gap: '.5rem' }}>
            {historyRows.map(row => (
              <div
                key={row.id}
                style={{
                  border: '1px solid rgba(212,168,83,.18)',
                  borderRadius: 8,
                  padding: '.55rem .7rem',
                }}
              >
                <div className="section-label" style={{ marginBottom: '.15rem' }}>
                  {row.acao.toUpperCase()} · {new Date(row.criado_em).toLocaleString('pt-BR')}
                </div>
                <div className="section-label">
                  Usuário: {row.usuario_email ?? 'não identificado'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <PeriodFilterBar value={periodFilter} onChange={setPeriodFilter} />

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { l: 'A Receber', v: totPend, c: '#4ade80' },
          { l: 'Recebido',  v: totRec,  c: '#d4a853' },
          { l: 'Vencido',   v: totOver, c: '#f87171' },
          { l: 'Serviços Fechados (Bruto)', v: totalBrutoServicos, c: '#f4e4d6' },
          { l: 'Líquido no Período', v: totalLiquidoPeriodo, c: '#60a5fa' },
        ].map((x, i) => (
          <div key={i} className="glass-card p-4 text-center">
            <div className="section-label mb-1">{x.l}</div>
            <div className="font-display" style={{ fontSize: '1.35rem', color: x.c }}>{fmtCur(x.v)}</div>
          </div>
        ))}
      </div>

      <FilterBar options={['Todos', 'Pendente', 'Recebido', 'Vencido']} value={filter} onChange={v => setFilter(v as Filter)} />

      <div className="mb-4">
        <input
          type="text"
          className="glass-input w-full"
          placeholder="Buscar por nome, telefone, forma de pagamento ou valor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}
        />
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? <LoadingState /> : error ? <ErrorState message={error} /> : filtered.length === 0 ? (
          <EmptyState message="Nenhuma cobrança para este filtro." />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid rgba(212,168,83,.18)' }}>
                {['Cliente', 'Parcela', 'Valor', 'Vencimento', 'Pagamento', 'Status', ''].map((h, i) => (
                  <th key={i} className="section-label text-left px-4 py-3">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(r => {
                  const s = getStatus(r.data_vencimento, r.status)
                  const pm = r.forma_pagamento as FormaPagamento
                  return (
                    <tr key={r.id} className="trow">
                      <td className="px-4 py-3" style={{ color: '#f4e4d6', fontWeight: 500 }}>{r.cliente_nome}</td>
                      <td className="px-4 py-3" style={{ color: '#8a6a55', fontSize: '.85rem' }}>{r.numero_parcela}/{r.total_parcelas}</td>
                      <td className="px-4 py-3" style={{ color: '#4ade80', fontWeight: 600 }}>{fmtCur(r.valor_parcela)}</td>
                      <td className="px-4 py-3" style={{ color: s === 'vencido' ? '#f87171' : '#8a6a55', fontSize: '.85rem' }}>{fmtDate(r.data_vencimento)}</td>
                      <td className="px-4 py-3" style={{ color: '#8a6a55', fontSize: '.85rem' }}>{PM_ICON[pm]} {PM_LABEL[pm]}</td>
                      <td className="px-4 py-3"><Badge status={s} /></td>
                      <td className="px-4 py-3 text-right">
                        {!readOnly && s !== 'recebido' ? (
                          <button className="btn btn-success btn-sm" onClick={() => marcarRecebido(r.id)}>✓ Recebido</button>
                        ) : s === 'recebido' ? (
                          <span style={{ color: '#4ade80', fontSize: '.75rem' }}>✓ {fmtDate(r.data_recebimento)}</span>
                        ) : null}
                        {isAdmin && (
                          <div className="mt-2 flex justify-end gap-2 flex-wrap">
                            <button className="btn btn-outline btn-sm" onClick={() => void verHistorico(r)}>Histórico</button>
                            <button className="btn btn-outline btn-sm" onClick={() => openEditModal(r)}>Editar Única</button>
                            <button className="btn btn-gold btn-sm" onClick={() => openBulkEditModal(r)}>Editar Parcelamento</button>
                            <button className="btn btn-danger btn-sm" onClick={() => void excluirTransacao(r)}>Apagar</button>
                          </div>
                        )}
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
