import { useState, useMemo, type ReactNode } from 'react'
import {
  Users,
  AlertCircle,
  BarChart3,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  useFinanceiroStats,
  useGraficoReceitasMensal,
  useGraficoDespesasMensal,
  useSimuladorCaixaMensal,
} from '@/hooks/useFinanceiroDashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/Modal'
import { cn, fmtCur } from '@/lib/utils'
import { SaldoMesReceberCard, PrevisaoProximoMesCard } from '@/components/dashboard/SaldoMesReceberCard'
import { DashboardCardShell, DashboardKpiCard } from '@/components/dashboard/DashboardCardShell'
import { FaturadoGastosAnotacoes } from '@/components/dashboard/FaturadoGastosAnotacoes'
import { ReceitasMensaisAnotacoes, DespesasMensaisAnotacoes } from '@/components/dashboard/ReceitasMensaisAnotacoes'
import { SimuladorCaixaCard } from '@/components/dashboard/SimuladorCaixaCard'
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
} from 'recharts'

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#1a100c',
  border: '1px solid rgba(240,210,140,0.22)',
  borderRadius: '10px',
  fontFamily: 'Raleway, sans-serif',
  boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
} as const

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useFinanceiroStats()
  const [anoReceitas, setAnoReceitas] = useState(new Date().getFullYear())
  const [anoDespesas, setAnoDespesas] = useState(new Date().getFullYear())
  const [anoComparativo, setAnoComparativo] = useState(new Date().getFullYear())
  const [anoSimulador, setAnoSimulador] = useState(new Date().getFullYear())

  const { data: receitasMensais } = useGraficoReceitasMensal(anoReceitas)
  const { data: despesasMensais } = useGraficoDespesasMensal(anoDespesas)
  const { data: receitasComparativo } = useGraficoReceitasMensal(anoComparativo)
  const { data: despesasComparativo } = useGraficoDespesasMensal(anoComparativo)
  const { data: simuladorMensal } = useSimuladorCaixaMensal(anoSimulador)

  const comparativoData = useMemo(() => {
    if (!receitasComparativo || !despesasComparativo) return []
    return receitasComparativo.map((r, i) => ({
      mes: r.mes,
      receitas: r.valor,
      despesas: despesasComparativo[i]?.valor ?? 0,
    }))
  }, [receitasComparativo, despesasComparativo])

  const simuladorDataOriginal = useMemo(() => {
    return (simuladorMensal ?? []).map(m => ({
      mes: m.mes,
      receitas: m.receitas,
      despesas: m.despesas,
      temPrevisao: m.temPrevisao,
    }))
  }, [simuladorMensal])

  /** Valores do próximo mês civil dentro do ano do simulador (já com contas em aberto). */
  const previsaoProximoNoSimulador = useMemo(() => {
    const agora = new Date()
    const prox = new Date(agora.getFullYear(), agora.getMonth() + 1, 1)
    if (prox.getFullYear() !== anoSimulador) return null
    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return simuladorDataOriginal.find(m => m.mes === labels[prox.getMonth()]) ?? null
  }, [anoSimulador, simuladorDataOriginal])

  const anosDisponiveis = useMemo(() => {
    const atual = new Date().getFullYear()
    return [atual - 2, atual - 1, atual, atual + 1]
  }, [])

  if (statsLoading) {
    return (
      <div className="fade-in space-y-8 p-2 sm:p-4 lg:p-6">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const receitaLiquida = stats?.receitaLiquidaAno ?? 0

  const kpis = [
    {
      title: 'Clientes Ativos',
      value: stats?.clientesAtivos ?? 0,
      subtitle: `${stats?.clientesPendentesContrato ?? 0} pendentes plano`,
      icon: Users,
      accent: 'sky' as const,
    },
    {
      title: 'Recebido Este Mês',
      value: fmtCur(stats?.totalRecebidoMes ?? 0),
      subtitle: 'Pagamentos confirmados',
      icon: ArrowUpRight,
      accent: 'emerald' as const,
    },
    {
      title: 'Atrasado',
      value: fmtCur(stats?.totalAtrasado ?? 0),
      subtitle: 'Total vencido e não pago',
      icon: AlertCircle,
      accent: 'rose' as const,
    },
    {
      title: 'Previsão Ano',
      value: fmtCur(stats?.previsaoAno ?? 0),
      subtitle: 'Projeção baseada na média',
      icon: BarChart3,
      accent: 'amber' as const,
    },
    {
      title: 'Receita Líquida Ano',
      value: fmtCur(receitaLiquida),
      subtitle: 'Recebido − pago (Jan–hoje)',
      icon: ArrowDownRight,
      accent: (receitaLiquida >= 0 ? 'emerald' : 'rose') as 'emerald' | 'rose',
    },
  ]

  return (
    <div className="fade-in mx-auto max-w-[1600px] space-y-8 p-2 sm:p-4 lg:p-6">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl border border-[rgba(240,210,140,0.16)] bg-[rgba(12,7,5,0.7)] px-5 py-6 sm:px-8 sm:py-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 100% at 0% -20%, rgba(242,216,146,0.16), transparent 55%), radial-gradient(ellipse 60% 80% at 100% 120%, rgba(242,216,146,0.07), transparent 50%), linear-gradient(135deg, rgba(242,216,146,0.04) 0%, transparent 40%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(242,216,146,0.45), transparent)',
          }}
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-label mb-1.5">Painel financeiro</p>
            <h1 className="font-display text-4xl tracking-[0.2em] text-[#f2d892] sm:text-5xl">
              DASHBOARD
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#edd9c4]/70">
              Saldos do mês, indicadores e movimento de caixa da marcenaria.
            </p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#edd9c4]/45">
            Movelaria Garbo
          </p>
        </div>
      </header>

      {/* Saldos em destaque */}
      <DashboardSection
        title="Saldos"
        hint="Entradas − saídas"
      >
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          <SaldoMesReceberCard
            totalAReceber={stats?.totalAReceber ?? 0}
            totalAPagarMes={stats?.totalAPagarMes ?? 0}
            style={{ animationDelay: '40ms' }}
            className="dash-card-enter"
          />
          <PrevisaoProximoMesCard
            previsaoRecebimento={stats?.previsaoProximoMes ?? 0}
            previsaoDespesas={stats?.despesasProximoMes ?? 0}
            style={{ animationDelay: '90ms' }}
            className="dash-card-enter"
          />
        </div>
      </DashboardSection>

      {/* Indicadores */}
      <DashboardSection title="Indicadores" hint="Visão rápida">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi, i) => (
            <DashboardKpiCard
              key={kpi.title}
              title={kpi.title}
              subtitle={kpi.subtitle}
              value={kpi.value}
              icon={kpi.icon}
              accent={kpi.accent}
              className="dash-card-enter"
              style={{ animationDelay: `${100 + i * 40}ms` }}
            />
          ))}
          <NovosClientesCard
            count={stats?.novosClientesMes ?? 0}
            ticketMedio={stats?.ticketMedio ?? 0}
          />
        </div>
      </DashboardSection>

      {/* Receitas × Despesas */}
      <DashboardSection title="Movimento mensal" hint="Receitas e despesas">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <DashboardChartCard
            title="Receitas Mensais"
            description="Total recebido por mês"
            ano={anoReceitas}
            onAnoChange={setAnoReceitas}
            anos={anosDisponiveis}
          >
            <div className="h-[260px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={receitasMensais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,210,140,0.06)" vertical={false} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#edd9c4', fontSize: 10, fontFamily: 'Raleway' }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#edd9c4', fontSize: 10, fontFamily: 'Raleway' }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    itemStyle={{ color: '#f2d892', fontSize: '12px', fontWeight: 600 }}
                    labelStyle={{ color: '#edd9c4', fontSize: '10px', marginBottom: '4px' }}
                    formatter={(v: number) => [fmtCur(v), 'Recebido']}
                  />
                  <Bar dataKey="valor" fill="#34d399" radius={[4, 4, 0, 0]} barSize={28}>
                    {receitasMensais?.map((_, index) => (
                      <Cell key={`r-${index}`} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ReceitasMensaisAnotacoes ano={anoReceitas} data={receitasMensais ?? []} />
          </DashboardChartCard>

          <DashboardChartCard
            title="Despesas Mensais"
            description="Pago das contas com vencimento no mês"
            ano={anoDespesas}
            onAnoChange={setAnoDespesas}
            anos={anosDisponiveis}
          >
            <div className="h-[260px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={despesasMensais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,210,140,0.06)" vertical={false} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#edd9c4', fontSize: 10, fontFamily: 'Raleway' }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#edd9c4', fontSize: 10, fontFamily: 'Raleway' }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v: number) => [fmtCur(v), 'Pago']}
                  />
                  <Bar dataKey="valor" fill="#f87171" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DespesasMensaisAnotacoes ano={anoDespesas} data={despesasMensais ?? []} />
          </DashboardChartCard>
        </div>
      </DashboardSection>

      {/* Comparativo */}
      <DashboardSection title="Comparativo" hint="Faturado × gastos do ano">
        <DashboardChartCard
          title="Faturado x Gastos"
          description="Recebido no mês × pago das contas com vencimento no mês"
          ano={anoComparativo}
          onAnoChange={setAnoComparativo}
          anos={anosDisponiveis}
        >
          <div className="h-[280px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,210,140,0.06)" vertical={false} />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#edd9c4', fontSize: 10, fontFamily: 'Raleway' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#edd9c4', fontSize: 11, fontFamily: 'Raleway' }}
                  tickFormatter={(v) =>
                    v >= 1000 ? `R$ ${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : fmtCur(v)
                  }
                  width={64}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: '#f2d892', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}
                  itemStyle={{ color: '#fffaf4', fontSize: '12px', fontWeight: 600 }}
                  formatter={(v: number, name: string) => [fmtCur(v), name === 'receitas' ? 'Faturado' : 'Gastos']}
                  labelFormatter={(label) => `Mês: ${label}`}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{
                    paddingTop: '16px',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontFamily: 'Raleway, sans-serif',
                    color: '#edd9c4',
                  }}
                />
                <Bar dataKey="receitas" name="Faturado" fill="#34d399" radius={[3, 3, 0, 0]} />
                <Bar dataKey="despesas" name="Gastos" fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <FaturadoGastosAnotacoes
            ano={anoComparativo}
            data={comparativoData}
            previsaoRecebimento={stats?.previsaoProximoMes ?? 0}
            previsaoDespesas={stats?.despesasProximoMes ?? 0}
          />
        </DashboardChartCard>
      </DashboardSection>

      <DashboardSection title="Simulador" hint="Projeção editável do caixa">
        <SimuladorCaixaCard
          ano={anoSimulador}
          onAnoChange={setAnoSimulador}
          anos={anosDisponiveis}
          dataOriginal={simuladorDataOriginal}
          previsaoRecebimentoOriginal={
            previsaoProximoNoSimulador?.receitas ?? stats?.previsaoProximoMes ?? 0
          }
          previsaoDespesasOriginal={
            previsaoProximoNoSimulador?.despesas ?? stats?.despesasProximoMes ?? 0
          }
        />
      </DashboardSection>
    </div>
  )
}

function DashboardSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 border-b border-[rgba(240,210,140,0.1)] pb-2">
        <h2 className="font-display text-xl tracking-[0.16em] text-[#f2d892]">
          {title.toUpperCase()}
        </h2>
        {hint && (
          <span className="pb-0.5 text-[10px] uppercase tracking-[0.18em] text-[#edd9c4]/50">
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

function DashboardChartCard({
  title,
  description,
  ano,
  onAnoChange,
  anos,
  children,
}: {
  title: string
  description: string
  ano: number
  onAnoChange: (ano: number) => void
  anos: number[]
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden border-[rgba(240,210,140,0.16)] bg-[rgba(12,7,5,0.65)] backdrop-blur-md">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-[rgba(240,210,140,0.08)] px-5 py-4">
        <div className="min-w-0">
          <CardTitle className="font-display text-lg tracking-[0.12em] text-[#f2d892]">
            {title}
          </CardTitle>
          <CardDescription className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#edd9c4]/60">
            {description}
          </CardDescription>
        </div>
        <AnoSelect value={ano} onChange={onAnoChange} anos={anos} />
      </CardHeader>
      <CardContent className="px-5 py-5">{children}</CardContent>
    </Card>
  )
}

function AnoSelect({
  value,
  onChange,
  anos,
}: {
  value: number
  onChange: (ano: number) => void
  anos: number[]
}) {
  return (
    <label className="flex shrink-0 flex-col items-end gap-1">
      <span className="text-[9px] uppercase tracking-[0.16em] text-[#edd9c4]/45">Ano</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          'rounded-md border border-[rgba(240,210,140,0.28)] bg-[rgba(0,0,0,0.35)]',
          'px-2.5 py-1.5 text-xs font-semibold tracking-wide text-[#f2d892] outline-none',
          'transition-colors hover:border-[rgba(240,210,140,0.45)] focus:border-[#f2d892]',
        )}
      >
        {anos.map(a => (
          <option key={a} value={a} className="bg-[#2a1812]">
            {a}
          </option>
        ))}
      </select>
    </label>
  )
}

function NovosClientesCard({ count, ticketMedio }: { count: number; ticketMedio: number }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <DashboardCardShell
        accent="sky"
        onClick={() => setOpen(true)}
        className="dash-card-enter"
        style={{ animationDelay: '340ms' }}
      >
        <CardHeader className="relative flex flex-row items-start justify-between space-y-0 px-5 pb-2 pt-5">
          <CardTitle className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#edd9c4]">
            Novos Clientes Mês
          </CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(240,210,140,0.18)] bg-[rgba(0,0,0,0.2)]">
            <UserPlus className="h-3.5 w-3.5 text-cyan-300" />
          </div>
        </CardHeader>
        <CardContent className="relative space-y-2 px-5 pb-5 pt-0">
          <div className="font-display text-[1.7rem] leading-none tracking-[0.04em] text-cyan-300">
            {count}
          </div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#edd9c4]/70">
            Ticket médio: {fmtCur(ticketMedio)}
          </p>
        </CardContent>
      </DashboardCardShell>

      <Modal open={open} onClose={() => setOpen(false)} title="Novos Clientes do Mês" wide>
        <div className="space-y-4">
          <p className="text-sm text-[#edd9c4]">Detalhes dos novos contratos fechados no mês atual.</p>
          <div className="rounded-lg border border-[rgba(240,210,140,0.1)] p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-[#edd9c4] opacity-20" />
            <p className="mt-2 text-xs text-[#edd9c4]">Funcionalidade de listagem detalhada em desenvolvimento.</p>
          </div>
        </div>
      </Modal>
    </>
  )
}
