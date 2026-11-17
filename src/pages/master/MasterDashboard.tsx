import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Building2, Crown, DollarSign, Plus, Search, Users, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DashboardKpiCard, DashboardCardShell } from '@/components/dashboard/DashboardCardShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { NovaEmpresaModal } from '@/components/master/NovaEmpresaModal'
import {
  brl,
  competenciaBR,
  fimDoMes,
  inicioDoMes,
  SITUACAO_CLASS,
  SITUACAO_LABEL,
  STATUS_EMPRESA_CLASS,
  STATUS_EMPRESA_LABEL,
} from '@/components/master/master-utils'
import { useMasterFaturamentoMensal, useMasterResumo } from '@/hooks/useMaster'
import { cn } from '@/lib/utils'

/** Painel Master: visão de todas as marcenarias da plataforma. */
export default function MasterDashboard() {
  const navigate = useNavigate()
  const [inicio, setInicio] = useState(inicioDoMes())
  const [fim, setFim] = useState(fimDoMes())
  const [busca, setBusca] = useState('')
  const [novaAberta, setNovaAberta] = useState(false)
  const { data: empresas = [], isLoading, error } = useMasterResumo(inicio, fim)
  const { data: mensal = [] } = useMasterFaturamentoMensal(12)

  const kpis = useMemo(() => {
    const ativas = empresas.filter((e) => e.status === 'ativa').length
    const bloqueadas = empresas.filter((e) => e.status === 'bloqueada').length
    const usuarios = empresas.reduce((s, e) => s + e.total_usuarios, 0)
    const faturamento = empresas.reduce((s, e) => s + e.faturamento, 0)
    const mrr = empresas.filter((e) => e.status !== 'inativa').reduce((s, e) => s + (e.valor_mensal ?? 0), 0)
    const vencido = empresas.reduce((s, e) => s + e.valor_vencido, 0)
    return { ativas, bloqueadas, usuarios, faturamento, mrr, vencido }
  }, [empresas])

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return empresas
    return empresas.filter(
      (e) =>
        e.nome.toLowerCase().includes(t) ||
        e.slug.includes(t) ||
        e.admins.some((a) => (a.nome ?? '').toLowerCase().includes(t) || a.email.toLowerCase().includes(t)),
    )
  }, [empresas, busca])

  const grafico = useMemo(() => {
    const porMes = new Map<string, number>()
    for (const r of mensal) porMes.set(r.mes, (porMes.get(r.mes) ?? 0) + r.faturamento)
    return [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, total]) => ({ mes: competenciaBR(mes), total }))
  }, [mensal])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">
            <Crown className="h-3.5 w-3.5" aria-hidden /> Painel Master
          </p>
          <h1 className="font-display text-3xl tracking-[0.02em] text-[#2a1812]">Marcenarias da plataforma</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/master/financeiro">
              <Wallet className="mr-2 h-4 w-4" aria-hidden /> Financeiro Master
            </Link>
          </Button>
          <Button onClick={() => setNovaAberta(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden /> Nova empresa
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="md-inicio" className="text-xs">Faturamento de</Label>
          <Input id="md-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="md-fim" className="text-xs">até</Label>
          <Input id="md-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9 w-40" />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores">
        <DashboardKpiCard title="Empresas" subtitle={`${kpis.ativas} ativas`} value={empresas.length} icon={Building2} />
        <DashboardKpiCard title="Bloqueadas" subtitle="por mensalidade ou manual" value={kpis.bloqueadas} icon={AlertTriangle} accent="rose" />
        <DashboardKpiCard title="Usuários" subtitle="em todas as empresas" value={kpis.usuarios} icon={Users} accent="sky" />
        <DashboardKpiCard title="Faturamento" subtitle="das empresas no período" value={brl(kpis.faturamento)} icon={DollarSign} accent="emerald" />
        <DashboardKpiCard title="MRR" subtitle="mensalidades contratadas" value={brl(kpis.mrr)} icon={Wallet} accent="gold" />
        <DashboardKpiCard title="Inadimplência" subtitle="mensalidades vencidas" value={brl(kpis.vencido)} icon={AlertTriangle} accent="amber" />
      </section>

      <DashboardCardShell accent="emerald" className="p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#6b5244]">
          Faturamento mensal somado (últimos 12 meses)
        </h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grafico} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,24,18,0.08)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b5244' }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b5244' }}
                tickLine={false}
                axisLine={false}
                width={72}
                tickFormatter={(v: number) => brl(v).replace(',00', '')}
              />
              <Tooltip formatter={(v) => brl(Number(v))} labelStyle={{ color: '#2a1812' }} />
              <Bar dataKey="total" name="Faturamento" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </DashboardCardShell>

      <DashboardCardShell className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(42,24,18,0.08)] px-5 py-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b5244]">Empresas</h2>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[#8a7060]" aria-hidden />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa ou administrador"
              className="h-9 pl-8"
              aria-label="Buscar empresa"
            />
          </div>
        </div>
        {isLoading ? (
          <div className="p-6"><LoadingState message="Carregando empresas..." /></div>
        ) : error ? (
          <div className="p-6"><ErrorState message={error instanceof Error ? error.message : 'Erro ao carregar'} /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Administrador</TableHead>
                  <TableHead className="text-right">Usuários</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead>Mensalidade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-[#8a7060]">
                      Nenhuma empresa encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((e) => (
                    <TableRow
                      key={e.empresa_id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/master/empresas/${e.empresa_id}`)}
                    >
                      <TableCell>
                        <div className="font-semibold text-[#2a1812]">{e.nome}</div>
                        <div className="text-[11px] text-[#8a7060]">{e.slug}</div>
                      </TableCell>
                      <TableCell>
                        {e.admins.length === 0 ? (
                          <span className="text-xs text-red-700">Sem administrador</span>
                        ) : (
                          e.admins.map((a) => (
                            <div key={a.id} className="text-sm">
                              {a.nome ?? a.email}
                              <span className="block text-[11px] text-[#8a7060]">{a.email}</span>
                            </div>
                          ))
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{e.total_usuarios}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(e.faturamento)}</TableCell>
                      <TableCell>
                        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold', SITUACAO_CLASS[e.situacao_mensalidade])}>
                          {SITUACAO_LABEL[e.situacao_mensalidade]}
                        </span>
                        {e.valor_mensal !== null ? (
                          <span className="block text-[11px] text-[#8a7060]">
                            {e.plano ? `${e.plano} · ` : ''}{brl(e.valor_mensal)}/mês
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATUS_EMPRESA_CLASS[e.status])}>
                          {STATUS_EMPRESA_LABEL[e.status]}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DashboardCardShell>

      <NovaEmpresaModal
        open={novaAberta}
        onClose={() => setNovaAberta(false)}
        onCriada={(id) => navigate(`/master/empresas/${id}`)}
      />
    </div>
  )
}
