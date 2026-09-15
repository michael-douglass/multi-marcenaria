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
      cor: '#34d399',
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
      className="prestador-comparativo-chart relative overflow-hidden rounded-2xl border border-[rgba(242,216,146,0.35)] p-5"
      style={{
        background: 'linear-gradient(145deg, #1a100c 0%, #241610 55%, #2a1c12 100%)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(242,216,146,0.12)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, rgba(242,216,146,0.4) 0%, transparent 70%)' }}
      />

      <div className="relative mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#f2d892]" />
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#f5ebe0]">
              Comparativo mensal
            </p>
          </div>
          <h2 className="font-display text-2xl tracking-wide text-[#f2d892]">
            Recebido × A receber
          </h2>
          <p className="mt-1 text-sm text-[#f5ebe0]/90">
            Quanto você já recebeu e o que ainda falta receber em {comparativo.periodoLabel}.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-right text-xs">
          <div>
            <span className="text-[#f5ebe0]/90">Recebido ({comparativo.periodoLabel})</span>
            <p className="font-mono text-lg font-semibold text-emerald-300">
              {fmtCur(comparativo.recebidoPeriodo)}
            </p>
          </div>
          <div>
            <span className="text-[#f5ebe0]/90">A receber ({comparativo.periodoLabel})</span>
            <p className="font-mono text-lg font-semibold text-[#f2d892]">
              {fmtCur(comparativo.aReceberPeriodo)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(242,216,146,0.12)" vertical={false} />
            <XAxis
              dataKey="nome"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#f5ebe0', fontSize: 12, fontWeight: 600 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#f5ebe0', fontSize: 10 }}
              tickFormatter={v => (v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`)}
              domain={[0, maxValor * 1.15]}
            />
            <Tooltip
              cursor={{ fill: 'rgba(242,216,146,0.08)' }}
              contentStyle={{
                backgroundColor: '#1a100c',
                border: '1px solid rgba(242,216,146,0.35)',
                borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                color: '#f5ebe0',
              }}
              labelStyle={{ color: '#f5ebe0', fontSize: 11, marginBottom: 4 }}
              formatter={(v: number, _n, props) => [
                fmtCur(v),
                (props?.payload as { legenda?: string })?.legenda ?? '',
              ]}
            />
            <Bar dataKey="valor" radius={[6, 6, 0, 0]} barSize={56}>
              {chartData.map(entry => (
                <Cell key={entry.nome} fill={entry.cor} fillOpacity={0.95} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
