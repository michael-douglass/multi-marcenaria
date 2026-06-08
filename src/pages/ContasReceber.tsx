import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { useContasReceber } from '../hooks/useContasReceber'
import { useOrcamentosFechados } from '../hooks/useOrcamentosFechados'
import { useTemplatesCobranca } from '../hooks/useTemplatesCobranca'
import { usePixConfig } from '../hooks/usePixConfig'
import { useReciboConfig } from '../hooks/useReciboConfig'
import { OrcamentosFechados } from '../components/cobrancas/OrcamentosFechados'
import { CobrancaCopyButton } from '../components/cobrancas/CobrancaCopyButton'
import { TemplatesConfigButton } from '../components/cobrancas/TemplatesConfigModal'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field, FieldRow } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { FilterBar } from '../components/ui/FilterBar'
import { EmptyState, LoadingState, ErrorState } from '../components/ui/EmptyState'
import {
  applyPeriodFilter,
  PeriodFilterBar,
  type PeriodFilter,
} from '../components/ui/PeriodFilterBar'
import { fmtCur, fmtDate, isOverdue, todayISO, addMonths } from '../lib/utils'
import type { Cliente, ContaReceber, FormaPagamento, TipoRecebimento } from '../types'
import type { ParcelaInput } from '../hooks/useContasReceber'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'

interface Props { clientes: Cliente[]; readOnly?: boolean }

type Filter = 'Todos' | 'Pendente' | 'Recebido' | 'Vencido'

const PAYMENT_METHODS: FormaPagamento[] = ['pix', 'dinheiro', 'cheque', 'boleto']
const PM_ICON: Record<FormaPagamento, string> = { pix: '⚡', dinheiro: '💵', cheque: '📝', boleto: '🏦', cartao: '💳' }
const PM_LABEL: Record<FormaPagamento, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cheque: 'Cheque', boleto: 'Boleto', cartao: 'Cartão' }

const TIPO_LABELS: Record<TipoRecebimento, string> = {
  a_vista: 'À Vista',
  cartao_parcelado: 'Cartão Parcelado',
  nosso_parcelamento: 'Nosso Parcelamento',
}

const TIPO_ICONS: Record<TipoRecebimento, string> = {
  a_vista: '💵',
  cartao_parcelado: '💳',
  nosso_parcelamento: '📝',
}

const TIPOS: TipoRecebimento[] = ['a_vista', 'cartao_parcelado', 'nosso_parcelamento']

const getStatus = (vencimento: string, status: string): string => {
  if (status === 'recebido') return 'recebido'
  if (isOverdue(vencimento)) return 'vencido'
  return 'pendente'
}

export function ContasReceber({ clientes, readOnly }: Props) {
  const { role, roles } = useApp()
  const isAdmin = role === 'Administrador'
  const isFinanceiroOnly = roles.includes('Financeiro') && !roles.includes('Administrador')
  const { data, loading, error, gerarCobranca, marcarRecebido, atualizarTransacao, atualizarParcelasEmLote, removerTransacao } = useContasReceber()
  const orcamentos = useOrcamentosFechados()
  const templatesHook = useTemplatesCobranca()
  const pixHook = usePixConfig()
  const reciboHook = useReciboConfig()
  const [filter, setFilter] = useState<Filter>('Todos')
  const [search, setSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({ mode: 'all' })
  const [isDefaultView, setIsDefaultView] = useState(true)
  const [open, setOpen] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [openBulkEdit, setOpenBulkEdit] = useState(false)
  const [selectedConta, setSelectedConta] = useState<ContaReceber | null>(null)
  const [bulkParcelas, setBulkParcelas] = useState<ContaReceber[]>([])
  const [form, setForm] = useState({
    clienteId: '',
    total: '',
    inst: '1',
    fdd: todayISO(),
    pm: 'pix' as FormaPagamento,
    tipo: 'a_vista' as TipoRecebimento,
    descontoCartao: '0',
    entradaAtiva: false,
    entradaValor: '',
    entradaData: todayISO(),
    entradaForma: 'pix' as FormaPagamento,
  })
  const [billingParcelas, setBillingParcelas] = useState<ParcelaInput[]>([])

  useEffect(() => {
    if (form.tipo === 'nosso_parcelamento') {
      const tot = parseFloat(form.total) || 0
      const ent = form.entradaAtiva ? parseFloat(form.entradaValor) || 0 : 0
      const val = tot - ent
      const n = parseInt(form.inst) || 1
      const start = form.fdd || todayISO()

      const valorUnit = val / n
      const newParcelas: ParcelaInput[] = Array.from({ length: n }, (_, i) => ({
        numero: i + 1,
        valor:
          i === n - 1
            ? parseFloat((val - valorUnit * (n - 1)).toFixed(2))
            : parseFloat(valorUnit.toFixed(2)),
        vencimento: addMonths(start, i),
      }))
      setBillingParcelas(newParcelas)
    } else {
      setBillingParcelas([])
    }
  }, [form.total, form.inst, form.fdd, form.tipo, form.entradaAtiva, form.entradaValor])

  const updateBillingParcela = (index: number, field: keyof ParcelaInput, value: string | number) => {
    const newParcelas = [...billingParcelas]
    const p = { ...newParcelas[index] }

    if (field === 'valor') {
      const newVal = parseFloat(value as string) || 0
      p.valor = newVal
      newParcelas[index] = p

      const tot = parseFloat(form.total) || 0
      const ent = form.entradaAtiva ? parseFloat(form.entradaValor) || 0 : 0
      const totalRestante = tot - ent
      
      const jaPago = newParcelas.slice(0, index + 1).reduce((sum, item) => sum + item.valor, 0)
      const restante = totalRestante - jaPago
      const nRestantes = newParcelas.length - (index + 1)

      if (nRestantes > 0) {
        const valorRestUnit = restante / nRestantes
        for (let i = index + 1; i < newParcelas.length; i++) {
          newParcelas[i] = {
            ...newParcelas[i],
            valor:
              i === newParcelas.length - 1
                ? parseFloat((restante - valorRestUnit * (nRestantes - 1)).toFixed(2))
                : parseFloat(valorRestUnit.toFixed(2)),
          }
        }
      }
    } else if (field === 'vencimento') {
      p.vencimento = value as string
      newParcelas[index] = p
    }

    setBillingParcelas(newParcelas)
  }

  const selectTipo = (tipo: TipoRecebimento) =>
    setForm(p => ({
      ...p,
      tipo,
      pm: tipo === 'a_vista' ? 'pix' : tipo === 'cartao_parcelado' ? 'cartao' : p.pm,
      inst: tipo === 'a_vista' ? '1' : p.inst === '1' ? '2' : p.inst,
    }))

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

  const filtered = (() => {
    const base = periodFiltered.filter(r => {
      // 1. Filtro de Status / Modo Padrão
      if (isDefaultView) {
        if (getStatus(r.data_vencimento, r.status) === 'recebido') return false
      } else if (filter !== 'Todos') {
        if (getStatus(r.data_vencimento, r.status) !== filter.toLowerCase()) return false
      }

      // 2. Filtro de Busca (Nome, Telefone, Forma, Valores, Data)
      if (search.trim()) {
        const term = search.toLowerCase().replace(/[\s\.\,]/g, '')

        const nome = (r.cliente_nome || '').toLowerCase().replace(/[\s\.\,]/g, '')
        const telefone = (r.cliente_telefone || '').replace(/[\s\.\,\-\(\)]/g, '')
        const valor = String(r.valor_parcela).replace(/[\s\.\,]/g, '')
        const total = String(r.valor_total).replace(/[\s\.\,]/g, '')
        const forma = PM_LABEL[r.forma_pagamento as FormaPagamento]?.toLowerCase() || ''
        const dataVenc = fmtDate(r.data_vencimento).replace(/[\s\.\,\/]/g, '')

        const match = nome.includes(term) ||
                      telefone.includes(term) ||
                      valor.includes(term) ||
                      total.includes(term) ||
                      forma.includes(term) ||
                      dataVenc.includes(term)

        if (!match) return false
      }

      return true
    })

    if (!isDefaultView) return base

    // Modo padrão: vencidos primeiro (mais antigos no topo), depois pendentes
    return [...base].sort((a, b) => {
      const sa = getStatus(a.data_vencimento, a.status)
      const sb = getStatus(b.data_vencimento, b.status)
      if (sa === 'vencido' && sb !== 'vencido') return -1
      if (sa !== 'vencido' && sb === 'vencido') return 1
      return a.data_vencimento.localeCompare(b.data_vencimento)
    })
  })()

  // Cards: mês atual no estado padrão sem busca; ao interagir seguem os filtros ativos
  const kpiBase = (!isDefaultView || search.trim())
    ? filtered
    : (() => {
        const idsThisMonth = new Set(
          applyPeriodFilter(dataComReferenciaPeriodo, { mode: 'month' }).map(item => item.id),
        )
        return data.filter(item => idsThisMonth.has(item.id))
      })()

  const kpiAReceber = kpiBase
    .filter(r => r.status !== 'recebido')
    .reduce((s, r) => s + r.valor_parcela, 0)

  const kpiRecebido = kpiBase
    .filter(r => r.status === 'recebido')
    .reduce((s, r) => s + r.valor_parcela, 0)

  const kpiEmAtraso = kpiBase
    .filter(r => r.status !== 'recebido' && isOverdue(r.data_vencimento))
    .reduce((s, r) => s + r.valor_parcela, 0)

  const kpiFechadoBruto = (() => {
    // Vendas futuras não existem: nenhum orçamento pode ser fechado no próximo mês.
    if (periodFilter.mode === 'next-month') return 0
    
    // Filtro a ser usado para os KPIs: segue o filtro de período ativo ou 'month' por padrão
    const kpiFiltro = (!isDefaultView || search.trim()) ? periodFilter : { mode: 'month' as const }
    
    // Helper para converter ISO UTC para YYYY-MM-DD Local
    const toLocalDate = (iso?: string | null) => {
      if (!iso) return '1900-01-01'
      const d = new Date(iso)
      if (isNaN(d.getTime())) return '1900-01-01'
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    // 1. Bruto de Orçamentos Fechados
    const brutoOrcamentos = applyPeriodFilter(
      orcamentos.fechados.map(item => ({
        ...item,
        data_vencimento: toLocalDate(item.criado_em),
        valor_total_num: Number(item.valor_total ?? 0),
      })),
      kpiFiltro,
    ).reduce((s, item) => s + item.valor_total_num, 0)

    // 2. Bruto de Lançamentos Manuais
    // Agrupamos por grupo_id para não duplicar o valor_total em cada parcela
    const manualGroups = new Map<string, { valor_total: number; criado_em_local: string }>()
    for (const row of data) {
      if (row.origem_tipo !== 'manual') continue
      // Usamos grupo_id se houver (vendas parceladas), senão o id da parcela única
      const grupoId = (row as any).grupo_id ?? row.id
      if (!manualGroups.has(grupoId)) {
        manualGroups.set(grupoId, {
          valor_total: Number(row.valor_total ?? 0),
          criado_em_local: toLocalDate(row.criado_em),
        })
      }
    }
    
    const brutoManual = applyPeriodFilter(
      Array.from(manualGroups.values()).map(g => ({
        data_vencimento: g.criado_em_local,
        valor_total: g.valor_total,
      })),
      kpiFiltro,
    ).reduce((s, g) => s + g.valor_total, 0)

    return brutoOrcamentos + brutoManual
  })()

  const save = async () => {
    const tot = parseFloat(form.total)
    const cl = clientes.find(c => c.id === form.clienteId)
    if (!cl || !tot || tot <= 0) return
    
    if (form.tipo !== 'a_vista' && parseInt(form.inst) < 2) {
      alert('Informe ao menos 2 parcelas para recebimento parcelado.')
      return
    }

    if (form.tipo === 'nosso_parcelamento') {
      const ent = form.entradaAtiva ? parseFloat(form.entradaValor) || 0 : 0
      const sum = billingParcelas.reduce((acc, p) => acc + p.valor, 0) + ent
      if (Math.abs(sum - tot) > 0.01) {
        alert(`A soma das parcelas (${fmtCur(sum)}) deve ser igual ao valor total (${fmtCur(tot)}).`)
        return
      }
    }

    setSaving(true)
    try {
      await gerarCobranca({
        cliente_id: cl.id,
        cliente_nome: cl.nome,
        valor_total: tot,
        tipo_recebimento: form.tipo,
        forma_pagamento: form.pm,
        total_parcelas: form.tipo === 'a_vista' ? 1 : parseInt(form.inst) || 1,
        primeiro_vencimento: form.fdd,
        entrada: form.entradaAtiva ? {
          valor: parseFloat(form.entradaValor) || 0,
          data: form.entradaData,
          forma_pagamento: form.entradaForma,
        } : undefined,
        parcelas_detalhadas: form.tipo === 'nosso_parcelamento' ? billingParcelas : undefined,
        desconto_cartao_percentual: form.tipo === 'cartao_parcelado' ? parseFloat(form.descontoCartao) || 0 : undefined,
      })
      setForm({
        clienteId: '',
        total: '',
        inst: '1',
        fdd: todayISO(),
        pm: 'pix',
        tipo: 'a_vista',
        descontoCartao: '0',
        entradaAtiva: false,
        entradaValor: '',
        entradaData: todayISO(),
        entradaForma: 'pix',
      })
      setOpen(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao emitir cobrança.')
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

  const gerarRecibo = (conta: ContaReceber) => {
    if (!reciboHook.config) {
      alert('Configuração de recibo não encontrada. Configure em Cobranças > ⚙️')
      return
    }

    const { cnpj, template_texto } = reciboHook.config
    const vencimento = conta.data_vencimento ?? ''
    const [ano, mes] = vencimento ? vencimento.split('-').map(Number) : [0, 0]
    const MESES_PT = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ]

    const vars: Record<string, string> = {
      nome_cliente: conta.cliente_nome ?? '',
      valor_fatura: fmtCur(conta.valor_parcela),
      data_vencimento: fmtDate(conta.data_vencimento),
      mes_referencia: mes ? MESES_PT[mes - 1] : '',
      ano_referencia: ano ? String(ano) : '',
      numero_parcela: String(conta.numero_parcela),
      total_parcelas: String(conta.total_parcelas),
      descricao_cobranca: conta.total_parcelas > 1 ? `Parcela ${conta.numero_parcela}/${conta.total_parcelas}` : 'Pagamento à vista',
      data_hoje: new Date().toLocaleDateString('pt-BR'),
      cnpj: cnpj,
      nome_empresa: 'GARBO MOVELARIA',
    }

    let texto = template_texto
    for (const [key, val] of Object.entries(vars)) {
      texto = texto.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val)
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <html>
        <head>
          <title>Recibo - ${conta.cliente_nome}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: #333; }
            .recibo-box { border: 2px solid #333; padding: 30px; max-width: 800px; margin: 0 auto; white-space: pre-wrap; }
            .header { text-align: center; border-bottom: 1px solid #ccc; margin-bottom: 20px; padding-bottom: 10px; }
            .footer { margin-top: 50px; text-align: center; }
            .assinatura { border-top: 1px solid #333; display: inline-block; min-width: 300px; margin-top: 40px; padding-top: 10px; }
            @media print {
              body { padding: 0; }
              .recibo-box { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="recibo-box">
            <div class="header">
              <h2 style="margin:0">GARBO MOVELARIA</h2>
              <div style="font-size: 12px">Móveis Planejados de Alta Qualidade</div>
            </div>
            <div>${texto}</div>
            <div class="footer">
              <div class="assinatura">GARBO MOVELARIA</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>Cobranças & Contas a Receber</h1>
          <p className="section-label mt-1">
            {filtered.length} parcela{filtered.length !== 1 ? 's' : ''} exibida{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <TemplatesConfigButton templatesHook={templatesHook} pixHook={pixHook} />
          )}
          {!readOnly && (
            <button type="button" className="btn btn-gold btn-md" onClick={() => setOpen(true)}>
              + Nova Cobrança
            </button>
          )}
        </div>
      </div>

      {/* Orçamentos ganhos aguardando entrada no caixa */}
      <OrcamentosFechados
        leads={orcamentos.leads}
        loading={orcamentos.loading}
        error={orcamentos.error}
        onDarEntrada={orcamentos.darEntrada}
        onLoadHistorico={orcamentos.carregarHistoricoCliente}
        onRemoverLead={orcamentos.removerLead}
        isAdmin={isAdmin}
        readOnly={readOnly}
      />

      {/* New Billing Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="NOVA COBRANÇA" wide>
        <Field label="Cliente *">
          <select className="glass-input" value={form.clienteId} onChange={f('clienteId')}>
            <option value="">Selecionar cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
        
        <Field label="Valor Total da Venda (R$) *">
          <input className="glass-input" type="number" value={form.total} onChange={f('total')} placeholder="0,00" min="0" step="0.01" />
        </Field>

        <Field label="Como será recebido?">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.5rem' }}>
            {TIPOS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => selectTipo(t)}
                style={{
                  padding: '.65rem .4rem',
                  borderRadius: 8,
                  border: form.tipo === t ? '1.5px solid #d4a853' : '1px solid rgba(212,168,83,.2)',
                  background: form.tipo === t ? 'rgba(212,168,83,.12)' : 'transparent',
                  color: form.tipo === t ? '#d4a853' : '#8a6a55',
                  cursor: 'pointer',
                  fontSize: '.7rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  fontFamily: 'Raleway, sans-serif',
                  lineHeight: 1.4,
                  transition: 'all .15s',
                }}
              >
                <div style={{ fontSize: '1.15rem', marginBottom: '.2rem' }}>{TIPO_ICONS[t]}</div>
                {TIPO_LABELS[t]}
              </button>
            ))}
          </div>
        </Field>

        {/* Opção de Entrada */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer section-label" style={{ color: '#d4a853' }}>
            <input
              type="checkbox"
              checked={form.entradaAtiva}
              onChange={e => setForm(p => ({ ...p, entradaAtiva: e.target.checked }))}
            />
            Houve uma entrada?
          </label>
        </div>

        {form.entradaAtiva && (
          <div
            style={{
              padding: '.75rem',
              borderRadius: 8,
              border: '1px solid rgba(212,168,83,.2)',
              background: 'rgba(212,168,83,.04)',
              marginBottom: '1rem',
            }}
          >
            <FieldRow>
              <Field label="Valor da Entrada" half>
                <input
                  className="glass-input"
                  type="number"
                  value={form.entradaValor}
                  onChange={e => setForm(p => ({ ...p, entradaValor: e.target.value }))}
                  placeholder="0,00"
                />
              </Field>
              <Field label="Forma" half>
                <select
                  className="glass-input"
                  value={form.entradaForma}
                  onChange={e => setForm(p => ({ ...p, entradaForma: e.target.value as FormaPagamento }))}
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{PM_LABEL[m]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Data" half>
                <input
                  className="glass-input"
                  type="date"
                  value={form.entradaData}
                  onChange={e => setForm(p => ({ ...p, entradaData: e.target.value }))}
                />
              </Field>
            </FieldRow>
          </div>
        )}

        {form.tipo === 'a_vista' ? (
          <FieldRow>
            <Field label="Forma" half>
              <select className="glass-input" value={form.pm} onChange={f('pm')}>
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{PM_ICON[m]} {PM_LABEL[m]}</option>
                ))}
              </select>
            </Field>
            <Field label="Vencimento" half>
              <input className="glass-input" type="date" value={form.fdd} onChange={f('fdd')} />
            </Field>
          </FieldRow>
        ) : form.tipo === 'cartao_parcelado' ? (
          <>
            <FieldRow>
              <Field label="% Desconto Cartão" half>
                <input
                  className="glass-input"
                  type="number"
                  value={form.descontoCartao}
                  onChange={f('descontoCartao')}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </Field>
              <Field label="Parcelas no Cartão" half>
                <input
                  className="glass-input"
                  type="number"
                  value={form.inst}
                  onChange={f('inst')}
                  min="2"
                  max="24"
                />
              </Field>
            </FieldRow>
          </>
        ) : (
          <>
            <FieldRow>
              <Field label="Forma" half>
                <select className="glass-input" value={form.pm} onChange={f('pm')}>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{PM_ICON[m]} {PM_LABEL[m]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nº de Parcelas" half>
                <input className="glass-input" type="number" value={form.inst} onChange={f('inst')} min="2" max="60" />
              </Field>
              <Field label="1ª Parcela" half>
                <input className="glass-input" type="date" value={form.fdd} onChange={f('fdd')} />
              </Field>
            </FieldRow>

            {billingParcelas.length > 0 && (
              <div className="mb-4">
                <div className="section-label mb-2" style={{ color: '#d4a853', fontWeight: 600 }}>
                  Detalhamento do Parcelamento
                </div>
                <div
                  style={{
                    display: 'grid',
                    gap: '.5rem',
                    maxHeight: '250px',
                    overflowY: 'auto',
                    padding: '.5rem',
                    background: 'rgba(212,168,83,.03)',
                    border: '1px solid rgba(212,168,83,.1)',
                    borderRadius: 8,
                  }}
                >
                  {billingParcelas.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 1.2fr',
                        gap: '.5rem',
                        alignItems: 'center',
                        padding: '.25rem',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,.02)',
                      }}
                    >
                      <span className="section-label" style={{ textAlign: 'center', fontSize: '.75rem' }}>
                        {p.numero}
                      </span>
                      <input
                        className="glass-input"
                        style={{ padding: '.35rem .5rem', fontSize: '.82rem' }}
                        type="number"
                        value={p.valor}
                        onChange={e => updateBillingParcela(i, 'valor', e.target.value)}
                        step="0.01"
                      />
                      <input
                        className="glass-input"
                        style={{ padding: '.35rem .5rem', fontSize: '.82rem' }}
                        type="date"
                        value={p.vencimento}
                        onChange={e => updateBillingParcela(i, 'vencimento', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between px-1">
                  <span className="section-label" style={{ fontSize: '.72rem' }}>
                    Soma Restante: {fmtCur(billingParcelas.reduce((acc, p) => acc + p.valor, 0))}
                  </span>
                  {Math.abs(billingParcelas.reduce((acc, p) => acc + p.valor, 0) - (parseFloat(form.total) - (form.entradaAtiva ? parseFloat(form.entradaValor) || 0 : 0))) > 0.01 && (
                    <span className="text-red-400" style={{ fontSize: '.72rem' }}>
                      Diferença: {fmtCur((parseFloat(form.total) - (form.entradaAtiva ? parseFloat(form.entradaValor) || 0 : 0)) - billingParcelas.reduce((acc, p) => acc + p.valor, 0))}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
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

      <PeriodFilterBar
        value={periodFilter}
        onChange={v => {
          setIsDefaultView(false)
          setPeriodFilter(v)
        }}
      />

      {/* KPI strip — acompanha o filtro de período */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          !isFinanceiroOnly && { l: 'A Receber',     v: kpiAReceber,    c: '#4ade80' },
          !isFinanceiroOnly && { l: 'Recebido',       v: kpiRecebido,    c: '#d4a853' },
          { l: 'Em Atraso',       v: kpiEmAtraso,    c: '#f87171' },
          !isFinanceiroOnly && { l: 'Fechado Bruto',  v: kpiFechadoBruto, c: '#f4e4d6' },
        ].filter(Boolean).map((x, i) => {
          const kpi = x as { l: string; v: number; c: string }
          return (
            <div key={i} className="glass-card p-4 text-center">
              <div className="section-label mb-1">{kpi.l}</div>
              <div className="font-display" style={{ fontSize: '1.35rem', color: kpi.c }}>{fmtCur(kpi.v)}</div>
            </div>
          )
        })}
      </div>

      <FilterBar
        options={['Todos', 'Pendente', 'Recebido', 'Vencido']}
        value={filter}
        onChange={v => {
          setIsDefaultView(false)
          setFilter(v as Filter)
        }}
      />

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
                {['Cliente', 'Parcela', 'Valor', 'Vencimento', 'Pagamento', 'Status', 'Recibo', ''].map((h, i) => (
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
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm !p-1.5"
                          title="Gerar Recibo"
                          onClick={() => gerarRecibo(r)}
                        >
                          <FileText className="h-4 w-4 text-[#d4a853]" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <CobrancaCopyButton
                            conta={r}
                            templates={templatesHook.templates}
                            pixConfig={pixHook.config}
                          />
                          {!readOnly && s !== 'recebido' ? (
                            <button className="btn btn-success btn-sm" onClick={() => marcarRecebido(r.id)}>✓ Recebido</button>
                          ) : s === 'recebido' ? (
                            <span style={{ color: '#4ade80', fontSize: '.75rem' }}>✓ {fmtDate(r.data_recebimento)}</span>
                          ) : null}
                        </div>
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
