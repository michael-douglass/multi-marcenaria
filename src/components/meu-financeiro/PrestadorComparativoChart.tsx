import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { fmtCur } from '@/lib/utils'
import type { PrestadorComparativoMes } from '@/hooks/usePrestadorFinanceiro'

interface PrestadorComparativoChartProps {
  comparativo: PrestadorComparativoMes
}

export function PrestadorComparativoChart({ comparativo }: PrestadorComparativoChartProps) {
  const chartData = [
    {
      nome: 'Recebido',
      legenda: `Recebido em ${comparativo.periodoLabel}`,
      valor: comparativo.recebidoPeriodo,
      cor: '#10b981',
    },
    {
      nome: 'A receber',
      legenda: `A receber em ${comparativo.periodoLabel}`,
      valor: comparativo.aReceberPeriodo,
      cor: '#f2d892',
    },
  ]

  const maxValor = Math.max(...chartData.map(d => d.valor), 1)

  return (
    <section
      className="prestador-comparativo-chart relative overflow-hidden rounded-2xl border border-[rgba(240,210,140,0.2)] p-5"
      style={{
        background: 'linear-gradient(145deg, rgba(21,12,9,0.95) 0%, rgba(30,18,10,0.88) 55%, rgba(240,210,140,0.06) 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(240,210,140,0.35) 0%, transparent 70%)' }}
      />

      <div className="relative mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#f2d892]" />
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#edd9c4]">
              Comparativo mensal
            </p>
          </div>
          <h2 className="font-display text-2xl tracking-wide text-[#f2d892]">
            Recebido × A receber
          </h2>
          <p className="mt-1 text-xs text-[#edd9c4]">
            Quanto você já recebeu e o que ainda falta receber em {comparativo.periodoLabel}.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-right text-xs">
          <div>
            <span className="text-[#edd9c4]">Recebido ({comparativo.periodoLabel})</span>
            <p className="font-mono text-lg font-semibold text-emerald-400">
              {fmtCur(comparativo.recebidoPeriodo)}
            </p>
          </div>
          <div>
            <span className="text-[#edd9c4]">A receber ({comparativo.periodoLabel})</span>
            <p className="font-mono text-lg font-semibold text-[#f2d892]">
              {fmtCur(comparativo.aReceberPeriodo)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(240,210,140,0.06)" vertical={false} />
            <XAxis
              dataKey="nome"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#c4a882', fontSize: 12, fontWeight: 600 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#edd9c4', fontSize: 10 }}
              tickFormatter={v => (v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`)}
              domain={[0, maxValor * 1.15]}
            />
            <Tooltip
              cursor={{ fill: 'rgba(240,210,140,0.06)' }}
              contentStyle={{
                backgroundColor: '#2a1812',
                border: '1px solid rgba(240,210,140,0.25)',
                borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              }}
              labelStyle={{ color: '#edd9c4', fontSize: 11, marginBottom: 4 }}
              formatter={(v: number, _n, props) => [
                fmtCur(v),
                (props?.payload as { legenda?: string })?.legenda ?? '',
              ]}
            />
            <Bar dataKey="valor" radius={[6, 6, 0, 0]} barSize={56}>
              {chartData.map(entry => (
                <Cell key={entry.nome} fill={entry.cor} fillOpacity={0.88} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
