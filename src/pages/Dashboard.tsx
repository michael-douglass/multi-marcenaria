import { TrendingUp, TrendingDown, Clock, Users } from 'lucide-react'
import type { Fornecedor, Produto, Pedido, Cliente, ContaPagar, ContaReceber } from '../types'
import { fmtCur, fmtDate, isOverdue, todayISO } from '../lib/utils'
import { Badge } from '../components/ui/Badge'

interface Props {
  fornecedores: Fornecedor[]
  produtos: Produto[]
  pedidos: Pedido[]
  clientes: Cliente[]
  contasPagar: ContaPagar[]
  contasReceber: ContaReceber[]
}

export function Dashboard({ fornecedores, produtos, pedidos, clientes, contasPagar, contasReceber }: Props) {
  const today = todayISO()

  const toReceive  = contasReceber.filter(r => r.status !== 'recebido').reduce((s, r) => s + r.valor_parcela, 0)
  const toPay      = contasPagar.filter(p => p.status !== 'pago').reduce((s, p) => s + p.valor_parcela, 0)
  const pendOrders = pedidos.filter(p => p.status === 'aguardando_aprovacao').length
  const overdueRec = contasReceber.filter(r => r.status !== 'recebido' && isOverdue(r.data_vencimento)).reduce((s, r) => s + r.valor_parcela, 0)
  const overduePay = contasPagar.filter(p => p.status !== 'pago' && isOverdue(p.data_vencimento)).reduce((s, p) => s + p.valor_parcela, 0)

  const kpis = [
    { label: 'A Receber',          value: fmtCur(toReceive),  color: '#4ade80', border: 'rgba(74,222,128,.28)',  Icon: TrendingUp,   note: `${contasReceber.filter(r => r.status !== 'recebido').length} parcelas` },
    { label: 'A Pagar',            value: fmtCur(toPay),      color: '#fbbf24', border: 'rgba(251,191,36,.28)',  Icon: TrendingDown, note: overduePay > 0 ? `Vencido: ${fmtCur(overduePay)}` : 'Em dia' },
    { label: 'Aguard. Aprovação',  value: pendOrders,         color: '#d4a853', border: 'rgba(212,168,83,.35)',  Icon: Clock,        note: 'pedidos de compra' },
    { label: 'Clientes Ativos',    value: clientes.length,    color: '#93c5fd', border: 'rgba(147,197,253,.25)', Icon: Users,        note: `${fornecedores.length} fornecedores` },
  ]

  const recentActivity = [
    ...pedidos.slice(0, 3).map(o => ({
      text: `Pedido #${o.id.slice(-6)} — ${o.movelaria_fornecedores?.nome ?? '—'}`,
      status: o.status,
      date: o.data_pedido,
    })),
    ...contasReceber.filter(r => r.status === 'recebido').slice(0, 2).map(r => ({
      text: `Recebimento ${r.cliente_nome} ${r.numero_parcela}/${r.total_parcelas}`,
      status: 'recebido',
      date: r.data_recebimento ?? r.data_vencimento,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em', lineHeight: 1 }}>
          Dashboard
        </h1>
        <p className="section-label mt-1">
          Visão geral ·{' '}
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        {kpis.map(({ label, value, color, border, Icon, note }, i) => (
          <div key={i} className="kpi-card" style={{ border: `1px solid ${border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.5rem' }}>
              <div className="section-label">{label}</div>
              <Icon size={20} style={{ color, opacity: .45 }} />
            </div>
            <div className="font-display" style={{ fontSize: '1.85rem', color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '.72rem', color: '#8a6a55', marginTop: '.35rem' }}>{note}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* Activity feed */}
        <div className="glass-card p-5">
          <div className="font-display mb-3" style={{ color: '#d4a853', fontSize: '1rem', letterSpacing: '.1em' }}>
            ATIVIDADE RECENTE
          </div>
          {recentActivity.length === 0
            ? <p style={{ color: '#8a6a55', fontSize: '.83rem', textAlign: 'center', padding: '1.5rem' }}>Sem atividade recente.</p>
            : recentActivity.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.55rem 0', borderBottom: '1px solid rgba(212,168,83,.08)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f4e4d6', fontSize: '.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</div>
                  <div style={{ color: '#8a6a55', fontSize: '.72rem', marginTop: 2 }}>{fmtDate(a.date)}</div>
                </div>
                <Badge status={a.status} />
              </div>
            ))
          }
        </div>

        {/* System summary */}
        <div className="glass-card p-5">
          <div className="font-display mb-3" style={{ color: '#d4a853', fontSize: '1rem', letterSpacing: '.1em' }}>
            RESUMO DO SISTEMA
          </div>
          {[
            { l: 'Fornecedores',           v: fornecedores.length,                                              c: '#c9a07b' },
            { l: 'Produtos',               v: produtos.length,                                                  c: '#c9a07b' },
            { l: 'Pedidos de compra',      v: pedidos.length,                                                   c: '#d4a853' },
            { l: 'Parcelas a pagar',       v: contasPagar.filter(p => p.status !== 'pago').length,              c: '#fbbf24' },
            { l: 'Parcelas a receber',     v: contasReceber.filter(r => r.status !== 'recebido').length,        c: '#4ade80' },
            { l: 'Recebimentos vencidos',  v: contasReceber.filter(r => r.status !== 'recebido' && isOverdue(r.data_vencimento)).length, c: '#f87171' },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.4rem 0', borderBottom: '1px solid rgba(212,168,83,.07)' }}>
              <span style={{ color: '#8a6a55', fontSize: '.83rem' }}>{row.l}</span>
              <span style={{ color: row.c, fontWeight: 700, fontSize: '1.05rem' }}>{row.v}</span>
            </div>
          ))}
        </div>

        {/* Alerts */}
        <div className="glass-card p-5">
          <div className="font-display mb-3" style={{ color: '#d4a853', fontSize: '1rem', letterSpacing: '.1em' }}>
            ALERTAS
          </div>
          {overduePay > 0 && (
            <div style={{ background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.22)', borderRadius: 8, padding: '.65rem .85rem', marginBottom: '.5rem' }}>
              <div style={{ color: '#fbbf24', fontSize: '.8rem', fontWeight: 600 }}>⚠ Contas a pagar vencidas</div>
              <div style={{ color: '#8a6a55', fontSize: '.75rem', marginTop: 2 }}>{fmtCur(overduePay)} em aberto</div>
            </div>
          )}
          {overdueRec > 0 && (
            <div style={{ background: 'rgba(248,113,113,.07)', border: '1px solid rgba(248,113,113,.22)', borderRadius: 8, padding: '.65rem .85rem', marginBottom: '.5rem' }}>
              <div style={{ color: '#f87171', fontSize: '.8rem', fontWeight: 600 }}>⚠ Cobranças vencidas</div>
              <div style={{ color: '#8a6a55', fontSize: '.75rem', marginTop: 2 }}>{fmtCur(overdueRec)} a receber</div>
            </div>
          )}
          {pendOrders > 0 && (
            <div style={{ background: 'rgba(212,168,83,.07)', border: '1px solid rgba(212,168,83,.22)', borderRadius: 8, padding: '.65rem .85rem', marginBottom: '.5rem' }}>
              <div style={{ color: '#d4a853', fontSize: '.8rem', fontWeight: 600 }}>⏳ Pedidos aguardando aprovação</div>
              <div style={{ color: '#8a6a55', fontSize: '.75rem', marginTop: 2 }}>{pendOrders} pedido{pendOrders > 1 ? 's' : ''} pendente{pendOrders > 1 ? 's' : ''}</div>
            </div>
          )}
          {overduePay === 0 && overdueRec === 0 && pendOrders === 0 && (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#4ade80', fontSize: '.85rem' }}>
              ✓ Tudo em dia!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
