import { useState, useMemo } from 'react'
import {
  Users,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calendar,
  BarChart3,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Search,
  Copy,
  Download,
  Info,
  FileText
} from 'lucide-react'
import {
  useFinanceiroStats,
  useGraficoReceitasMensal,
  useGraficoDespesasMensal
} from '@/hooks/useFinanceiroDashboard'
import { useReciboConfig } from '@/hooks/useReciboConfig'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { fmtCur, fmtDate } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  ComposedChart,
  Line
} from 'recharts'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useFinanceiroStats()
  const [anoReceitas, setAnoReceitas] = useState(new Date().getFullYear())
  const [anoDespesas, setAnoDespesas] = useState(new Date().getFullYear())
  const [anoComparativo, setAnoComparativo] = useState(new Date().getFullYear())

  const { data: receitasMensais, isLoading: receitasLoading } = useGraficoReceitasMensal(anoReceitas)
  const { data: despesasMensais, isLoading: despesasLoading } = useGraficoDespesasMensal(anoDespesas)

  const comparativoData = useMemo(() => {
    if (!receitasMensais || !despesasMensais) return []
    // Assuming same months order
    return receitasMensais.map((r, i) => ({
      mes: r.mes,
      receitas: r.valor,
      despesas: despesasMensais[i]?.valor ?? 0
    }))
  }, [receitasMensais, despesasMensais])

  const anosDisponiveis = useMemo(() => {
    const atual = new Date().getFullYear()
    return [atual - 2, atual - 1, atual, atual + 1]
  }, [])

  if (statsLoading) {
    return (
      <div className="space-y-6 fade-in p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    )
  }

  const kpis = [
    {
      title: 'Clientes Ativos',
      value: stats?.clientesAtivos ?? 0,
      subtitle: `${stats?.clientesPendentesContrato ?? 0} pendentes plano`,
      icon: Users,
      color: 'text-blue-400',
      format: 'number'
    },
    {
      title: 'A Receber Este Mês',
      value: stats?.totalAReceber ?? 0,
      subtitle: 'Parcelas vencendo no mês',
      icon: TrendingUp,
      color: 'text-emerald-400',
      format: 'currency'
    },
    {
      title: 'Recebido Este Mês',
      value: stats?.totalRecebidoMes ?? 0,
      subtitle: 'Pagamentos confirmados',
      icon: ArrowUpRight,
      color: 'text-emerald-500',
      format: 'currency'
    },
    {
      title: 'Atrasado',
      value: stats?.totalAtrasado ?? 0,
      subtitle: 'Total vencido e não pago',
      icon: AlertCircle,
      color: 'text-red-400',
      format: 'currency'
    },
    {
      title: 'Previsão Próx. Mês',
      value: stats?.previsaoProximoMes ?? 0,
      subtitle: 'Recebíveis agendados',
      icon: Calendar,
      color: 'text-purple-400',
      format: 'currency'
    },
    {
      title: 'Previsão Ano',
      value: stats?.previsaoAno ?? 0,
      subtitle: 'Projeção baseada na média',
      icon: BarChart3,
      color: 'text-amber-400',
      format: 'currency'
    },
    {
      title: 'Despesas Próx. Mês',
      value: stats?.despesasProximoMes ?? 0,
      subtitle: 'Contas a pagar agendadas',
      icon: TrendingDown,
      color: 'text-orange-400',
      format: 'currency'
    },
    {
      title: 'Receita Líquida Ano',
      value: stats?.receitaLiquidaAno ?? 0,
      subtitle: 'Recebido - Pago (Jan-Hoje)',
      icon: ArrowDownRight,
      color: stats?.receitaLiquidaAno && stats.receitaLiquidaAno >= 0 ? 'text-emerald-400' : 'text-red-400',
      format: 'currency'
    }
  ]

  return (
    <div className="space-y-6 fade-in p-2 sm:p-4 lg:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-widest text-[#f2d892]">DASHBOARD FINANCEIRO</h1>
        <p className="section-label">Visão geral do desempenho da marcenaria</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="overflow-hidden border-[rgba(240,210,140,0.15)] bg-[rgba(15,8,5,0.6)] backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#edd9c4]">
                {kpi.title}
              </CardTitle>
              <kpi.icon className={cn("h-4 w-4 opacity-70", kpi.color)} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold tracking-tight", kpi.color)}>
                {kpi.format === 'currency' ? fmtCur(kpi.value as number) : kpi.value}
              </div>
              <p className="text-[10px] text-[#edd9c4] mt-1 font-medium opacity-80 uppercase tracking-wider">
                {kpi.subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <NovosClientesCard
          count={stats?.novosClientesMes ?? 0}
          ticketMedio={stats?.ticketMedio ?? 0}
        />
        <ReciboConfigCard />
        <ResumoFinanceiroCard stats={stats} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Receitas Mensais */}
        <Card className="border-[rgba(240,210,140,0.15)] bg-[rgba(15,8,5,0.6)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Receitas Mensais</CardTitle>
              <CardDescription>Total recebido por mês</CardDescription>
            </div>
            <select
              value={anoReceitas}
              onChange={(e) => setAnoReceitas(Number(e.target.value))}
              className="bg-transparent text-xs text-[#f2d892] border border-[rgba(240,210,140,0.3)] rounded px-2 py-1 outline-none"
            >
              {anosDisponiveis.map(a => <option key={a} value={a} className="bg-[#2a1812]">{a}</option>)}
            </select>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={receitasMensais}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,210,140,0.05)" vertical={false} />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#edd9c4', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#edd9c4', fontSize: 10 }} tickFormatter={(v) => `R$${v/1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#2a1812', border: '1px solid rgba(240,210,140,0.2)', borderRadius: '8px' }}
                  itemStyle={{ color: '#f2d892', fontSize: '12px' }}
                  labelStyle={{ color: '#edd9c4', fontSize: '10px', marginBottom: '4px' }}
                  formatter={(v: number) => [fmtCur(v), 'Recebido']}
                />
                <Bar dataKey="valor" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30}>
                  {receitasMensais?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Faturado x Gastos */}
        <Card className="border-[rgba(240,210,140,0.15)] bg-[rgba(15,8,5,0.6)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Faturado x Gastos</CardTitle>
              <CardDescription>Comparativo mensal</CardDescription>
            </div>
            <select
              value={anoComparativo}
              onChange={(e) => setAnoComparativo(Number(e.target.value))}
              className="bg-transparent text-xs text-[#f2d892] border border-[rgba(240,210,140,0.3)] rounded px-2 py-1 outline-none"
            >
              {anosDisponiveis.map(a => <option key={a} value={a} className="bg-[#2a1812]">{a}</option>)}
            </select>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,210,140,0.05)" vertical={false} />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#edd9c4', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#edd9c4', fontSize: 10 }} tickFormatter={(v) => `R$${v/1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#2a1812', border: '1px solid rgba(240,210,140,0.2)', borderRadius: '8px' }}
                  formatter={(v: number) => fmtCur(v)}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }} />
                <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#f87171" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Despesas Mensais */}
        <Card className="border-[rgba(240,210,140,0.15)] bg-[rgba(15,8,5,0.6)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Despesas Mensais</CardTitle>
              <CardDescription>Total pago por mês</CardDescription>
            </div>
            <select
              value={anoDespesas}
              onChange={(e) => setAnoDespesas(Number(e.target.value))}
              className="bg-transparent text-xs text-[#f2d892] border border-[rgba(240,210,140,0.3)] rounded px-2 py-1 outline-none"
            >
              {anosDisponiveis.map(a => <option key={a} value={a} className="bg-[#2a1812]">{a}</option>)}
            </select>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={despesasMensais}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,210,140,0.05)" vertical={false} />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#edd9c4', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#edd9c4', fontSize: 10 }} tickFormatter={(v) => `R$${v/1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#2a1812', border: '1px solid rgba(240,210,140,0.2)', borderRadius: '8px' }}
                  formatter={(v: number) => [fmtCur(v), 'Pago']}
                />
                <Bar dataKey="valor" fill="#f87171" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Alertas e Observações */}
        <Card className="border-[rgba(240,210,140,0.15)] bg-[rgba(15,8,5,0.6)]">
          <CardHeader>
            <CardTitle>Análise de Performance</CardTitle>
            <CardDescription>Dicas e alertas automáticos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats?.totalAtrasado && stats.totalAtrasado > 0 ? (
              <div className="flex items-start gap-3 rounded-lg border border-red-900/30 bg-red-950/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-red-500" />
                <div>
                  <p className="text-xs font-semibold text-red-400">Parcelas em Atraso</p>
                  <p className="text-[10px] text-red-400/70">Você possui {fmtCur(stats.totalAtrasado)} em cobranças vencidas. Verifique o módulo de cobranças.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-3">
                <Info className="mt-0.5 h-4 w-4 text-emerald-500" />
                <div>
                  <p className="text-xs font-semibold text-emerald-400">Tudo em Dia</p>
                  <p className="text-[10px] text-emerald-400/70">Nenhuma cobrança em atraso no momento. Excelente gestão!</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 rounded-lg border border-[rgba(240,210,140,0.1)] bg-[rgba(240,210,140,0.02)] p-3">
              <TrendingUp className="mt-0.5 h-4 w-4 text-emerald-400" />
              <div>
                <p className="text-xs font-semibold text-cream">Ticket Médio</p>
                <p className="text-[10px] text-[#edd9c4]">O ticket médio geral deste mês é de {fmtCur(stats?.ticketMedioGeral ?? 0)} por parcela.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-[rgba(240,210,140,0.1)] bg-[rgba(240,210,140,0.02)] p-3">
              <Calendar className="mt-0.5 h-4 w-4 text-purple-400" />
              <div>
                <p className="text-xs font-semibold text-cream">Previsão Próximo Mês</p>
                <p className="text-[10px] text-[#edd9c4]">Projeção de recebimento: {fmtCur(stats?.previsaoProximoMes ?? 0)}. Despesas previstas: {fmtCur(stats?.despesasProximoMes ?? 0)}.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function NovosClientesCard({ count, ticketMedio }: { count: number; ticketMedio: number }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card
        className="cursor-pointer border-cyan-900/30 bg-cyan-950/10 transition-all hover:bg-cyan-950/20"
        onClick={() => setOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-cyan-400">Novos Clientes Mês</CardTitle>
          <UserPlus className="h-4 w-4 text-cyan-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-cyan-400">{count}</div>
          <p className="text-[10px] text-cyan-400/70 mt-1 font-medium">
            Ticket médio: {fmtCur(ticketMedio)}
          </p>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Novos Clientes do Mês" wide>
        <div className="space-y-4">
          <p className="text-sm text-[#edd9c4]">Detalhes dos novos contratos fechados no mês atual.</p>
          {/* Aqui entraria a lista de clientes, busca, etc. conforme a Seção 2 */}
          <div className="rounded-lg border border-[rgba(240,210,140,0.1)] p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-[#edd9c4] opacity-20" />
            <p className="mt-2 text-xs text-[#edd9c4]">Funcionalidade de listagem detalhada em desenvolvimento.</p>
          </div>
        </div>
      </Modal>
    </>
  )
}

function ResumoFinanceiroCard({ stats }: { stats: any }) {
  return (
    <Card className="border-[rgba(240,210,140,0.15)] bg-[rgba(15,8,5,0.6)] md:col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-[#f2d892]">Resumo Estratégico</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-widest text-[#edd9c4]">Ticket Médio</p>
          <p className="text-sm font-bold text-cream">{fmtCur(stats?.ticketMedioGeral ?? 0)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-widest text-[#edd9c4]">Rec. Líquida</p>
          <p className={cn("text-sm font-bold", stats?.receitaLiquidaAno >= 0 ? "text-emerald-400" : "text-red-400")}>
            {fmtCur(stats?.receitaLiquidaAno ?? 0)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ReciboConfigCard() {
  const { config, loading } = useReciboConfig()

  return (
    <Card className="border-[rgba(240,210,140,0.15)] bg-[rgba(15,8,5,0.6)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-[#f2d892] text-[10px] font-bold uppercase tracking-[0.2em]">Config de Recibo</CardTitle>
        <FileText className="h-4 w-4 text-[#f2d892] opacity-70" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-6 w-24" />
        ) : config ? (
          <>
            <div className="text-xl font-bold tracking-tight text-emerald-400">CONFIGURADO</div>
            <p className="text-[10px] text-[#edd9c4] mt-1 font-medium opacity-80 uppercase tracking-wider">
              CNPJ: {config.cnpj}
            </p>
          </>
        ) : (
          <>
            <div className="text-xl font-bold tracking-tight text-red-400">PENDENTE</div>
            <p className="text-[10px] text-[#edd9c4] mt-1 font-medium opacity-80 uppercase tracking-wider">
              Configure em Cobranças &gt; ⚙️
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}
