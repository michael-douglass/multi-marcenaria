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
      nome: comparativo.mesPassadoLabel,
      legenda: 'Recebido mês passado',
      valor: comparativo.recebidoMesPassado,
      cor: '#10b981',
    },
    {
      nome: comparativo.mesAtualLabel,
      legenda: 'A receber este mês',
      valor: comparativo.aReceberEsteMes,
      cor: '#d4a853',
    },
  ]

  const maxValor = Math.max(...chartData.map(d => d.valor), 1)

  return (
    <section
      className="prestador-comparativo-chart relative overflow-hidden rounded-2xl border border-[rgba(212,168,83,0.2)] p-5"
      style={{
        background: 'linear-gradient(145deg, rgba(21,12,9,0.95) 0%, rgba(30,18,10,0.88) 55%, rgba(212,168,83,0.06) 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(212,168,83,0.35) 0%, transparent 70%)' }}
      />

      <div className="relative mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#d4a853]" />
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#8a6a55]">
              Comparativo mensal
            </p>
          </div>
          <h2 className="font-display text-2xl tracking-wide text-[#d4a853]">
            Recebido × A receber
          </h2>
          <p className="mt-1 text-xs text-[#8a6a55]">
            Quanto você já recebeu no mês passado versus o que ainda falta receber neste mês.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-right text-xs">
          <div>
            <span className="text-[#8a6a55]">Recebido ({comparativo.mesPassadoLabel})</span>
            <p className="font-mono text-lg font-semibold text-emerald-400">
              {fmtCur(comparativo.recebidoMesPassado)}
            </p>
          </div>
          <div>
            <span className="text-[#8a6a55]">A receber ({comparativo.mesAtualLabel})</span>
            <p className="font-mono text-lg font-semibold text-[#d4a853]">
              {fmtCur(comparativo.aReceberEsteMes)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(212,168,83,0.06)" vertical={false} />
            <XAxis
              dataKey="nome"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#c4a882', fontSize: 12, fontWeight: 600 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8a6a55', fontSize: 10 }}
              tickFormatter={v => (v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`)}
              domain={[0, maxValor * 1.15]}
            />
            <Tooltip
              cursor={{ fill: 'rgba(212,168,83,0.06)' }}
              contentStyle={{
                backgroundColor: '#150c09',
                border: '1px solid rgba(212,168,83,0.25)',
                borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              }}
              labelStyle={{ color: '#8a6a55', fontSize: 11, marginBottom: 4 }}
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
