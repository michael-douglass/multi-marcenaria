import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PontuaGarboGanhoMensal } from '@/lib/pontua-garbo';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface PrestadorGanhosChartProps {
  totalComissaoGanha: number;
  ganhoMesAtual: number;
  mediaMensalGanhos: number;
  ganhosPorMes: PontuaGarboGanhoMensal[];
  /** Coluna lateral do portal: métricas empilhadas e gráfico compacto */
  variant?: 'default' | 'sidebar';
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        background: 'rgba(8,8,8,0.95)',
        border: '1px solid rgba(240,210,140,0.35)',
        fontFamily: 'Raleway, sans-serif',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#f2d892', fontWeight: 700 }}>{BRL(Number(payload[0].value))}</p>
    </div>
  );
}

export function PrestadorGanhosChart({
  totalComissaoGanha,
  ganhoMesAtual,
  mediaMensalGanhos,
  ganhosPorMes,
  variant = 'default',
}: PrestadorGanhosChartProps) {
  const isSidebar = variant === 'sidebar';
  const chartData = ganhosPorMes.map((m) => ({
    name: m.label,
    valor: m.valor,
  }));

  const statCards = [
    { label: 'Já ganhou', sub: 'Vendas confirmadas no CRM', value: totalComissaoGanha, color: '#f2d892' },
    { label: 'Este mês', sub: 'Comissão no mês atual', value: ganhoMesAtual, color: '#4ade80' },
    { label: 'Média / mês', sub: 'Média dos meses com venda', value: mediaMensalGanhos, color: 'rgba(168,212,255,0.95)' },
  ];

  return (
    <div className={`flex flex-col ${isSidebar ? 'gap-3' : 'gap-4'}`}>
      <div
        className={
          isSidebar
            ? 'flex flex-col gap-2'
            : 'grid grid-cols-1 sm:grid-cols-3 gap-3'
        }
      >
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className={`rounded-xl flex flex-col gap-0.5 ${isSidebar ? 'p-3' : 'p-4'} ${isSidebar && i === 0 ? 'p-4' : ''}`}
            style={{
              background:
                isSidebar && i === 0
                  ? 'linear-gradient(135deg, rgba(240,210,140,0.12) 0%, rgba(255,255,255,0.02) 100%)'
                  : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isSidebar && i === 0 ? 'rgba(240,210,140,0.28)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <span
              className="text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Raleway, sans-serif' }}
            >
              {card.label}
            </span>
            <p
              className={`font-display ${isSidebar && i === 0 ? 'text-2xl' : 'text-xl md:text-2xl'}`}
              style={{ color: card.color }}
            >
              {BRL(card.value)}
            </p>
            {!isSidebar && (
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {card.sub}
              </span>
            )}
          </div>
        ))}
      </div>

      <div
        className={`rounded-2xl ${isSidebar ? 'p-3' : 'p-4 md:p-5'}`}
        style={{
          background: 'linear-gradient(165deg, rgba(18,16,12,0.9) 0%, rgba(8,8,8,0.95) 100%)',
          border: '1px solid rgba(240,210,140,0.18)',
          boxShadow: 'inset 0 1px 0 rgba(240,210,140,0.08)',
        }}
      >
        <p
          className={`text-[10px] uppercase tracking-widest font-semibold ${isSidebar ? 'mb-2' : 'mb-4'}`}
          style={{ color: 'rgba(240,210,140,0.65)', fontFamily: 'Raleway, sans-serif' }}
        >
          {isSidebar ? 'Por mês' : 'Ganhos por mês (vendas ganhas)'}
        </p>

        {chartData.length === 0 ? (
          <p
            className={`text-sm text-center ${isSidebar ? 'py-6' : 'py-12'}`}
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Raleway, sans-serif' }}
          >
            {isSidebar
              ? 'Sem vendas ganhas ainda.'
              : 'Ainda não há vendas marcadas como ganhas no CRM. Quando houver, o gráfico aparece aqui.'}
          </p>
        ) : (
          <div className={`w-full ${isSidebar ? 'h-[150px]' : 'h-[220px]'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                  }
                  width={48}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(240,210,140,0.08)' }} />
                <Bar
                  dataKey="valor"
                  fill="url(#garboBarGrad)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
                <defs>
                  <linearGradient id="garboBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(240,210,140,0.95)" />
                    <stop offset="100%" stopColor="rgba(240,210,140,0.35)" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
