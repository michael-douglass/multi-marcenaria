import { useMemo } from 'react'
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
import { Gauge, Timer, Trophy } from 'lucide-react'
import { fmtDuracaoHoras } from '@/lib/obra-metricas'
import {
  buildMontadorTempoRanking,
  fmtHorasChart,
  type MontadorTempoResumo,
} from '@/lib/metricas-montador-tempo'
import type { MetricaObraDetalhe } from '@/types'

interface Props {
  porObra: MetricaObraDetalhe[]
  periodoLabel: string
}

interface ChartRow {
  id: string
  nome: string
  nomeCurto: string
  media: number
  total: number
  obras: number
  rank: number
  cor: string
}

const CORES = ['#6ee7b7', '#34d399', '#f2d892', '#fbbf24', '#fb923c', '#f87171']

function truncateNome(nome: string, max = 18): string {
  if (nome.length <= max) return nome
  return `${nome.slice(0, max - 1)}…`
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: ChartRow & { resumo: MontadorTempoResumo } }[]
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row?.resumo) return null

  return (
    <div className="metricas-montador-tooltip">
      <p className="metricas-montador-tooltip__title">{row.nome}</p>
      <p className="metricas-montador-tooltip__meta">
        Média {fmtHorasChart(row.media)} · Total {fmtHorasChart(row.total)} · {row.obras} obra(s)
      </p>
      <ul className="metricas-montador-tooltip__list">
        {row.resumo.obras.map(obra => (
          <li key={obra.obra_id} className="metricas-montador-tooltip__item">
            <span className="metricas-montador-tooltip__cliente">{obra.cliente_nome}</span>
            <span className="metricas-montador-tooltip__duracao">
              {fmtDuracaoHoras(obra.duracao_horas, obra.duracao_em_andamento)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MetricasMontadorTempoChart({ porObra, periodoLabel }: Props) {
  const ranking = useMemo(() => buildMontadorTempoRanking(porObra), [porObra])

  const chartData = useMemo(() =>
    ranking.map((resumo, i) => ({
      id: resumo.montador_id,
      nome: resumo.montador_nome,
      nomeCurto: truncateNome(resumo.montador_nome),
      media: Number(resumo.tempo_medio_horas.toFixed(4)),
      total: Number(resumo.tempo_total_horas.toFixed(4)),
      obras: resumo.obras_com_duracao,
      rank: i + 1,
      cor: CORES[Math.min(i, CORES.length - 1)],
      resumo,
    })),
  [ranking])

  const maxMedia = Math.max(...chartData.map(d => d.media), 0.5)
  const maisRapido = ranking[0]

  if (ranking.length === 0) {
    return (
      <section className="metricas-montador-tempo glass-card mb-8 p-6">
        <p className="text-sm text-[#edd9c4] text-center">
          Nenhuma duração registrada por montador em {periodoLabel}.
        </p>
      </section>
    )
  }

  return (
    <section className="metricas-montador-tempo glass-card mb-8 overflow-hidden">
      <div className="metricas-montador-tempo__glow" aria-hidden />

      <header className="metricas-montador-tempo__header">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Gauge size={15} className="text-[#f2d892]" />
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#edd9c4]">
              Comparativo de execução
            </p>
          </div>
          <h2 className="font-display text-xl sm:text-2xl tracking-wide text-[#f2d892]">
            Tempo médio por montador
          </h2>
          <p className="mt-1 text-xs text-[#edd9c4] max-w-2xl">
            Quem concluiu obras em menos tempo em {periodoLabel} — barras = média por obra;
            detalhes de cada cliente abaixo.
          </p>
        </div>

        {maisRapido && (
          <div className="metricas-montador-tempo__destaque shrink-0">
            <div className="flex items-center gap-1.5 text-[#f2d892]">
              <Trophy size={14} />
              <span className="text-[0.62rem] font-bold uppercase tracking-wider">Menor média</span>
            </div>
            <p className="font-display text-lg text-cream mt-0.5">{maisRapido.montador_nome}</p>
            <p className="font-mono text-sm text-emerald-400">
              {fmtHorasChart(maisRapido.tempo_medio_horas)} / obra
            </p>
          </div>
        )}
      </header>

      <div
        className="metricas-montador-tempo__chart px-4 sm:px-5 pb-2"
        style={{ height: Math.max(200, chartData.length * 52 + 40) }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            barCategoryGap="22%"
          >
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(240,210,140,0.07)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, maxMedia * 1.12]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#c4a882', fontSize: 10 }}
              tickFormatter={v => fmtHorasChart(Number(v))}
            />
            <YAxis
              type="category"
              dataKey="nomeCurto"
              width={108}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#edd9c4', fontSize: 11, fontWeight: 600 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(240,210,140,0.05)' }} />
            <Bar dataKey="media" radius={[0, 6, 6, 0]} barSize={22}>
              {chartData.map(entry => (
                <Cell key={entry.id} fill={entry.cor} fillOpacity={0.9} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="metricas-montador-tempo__detalhe border-t border-[rgba(240,210,140,0.1)]">
        <div className="px-4 sm:px-5 py-3 flex items-center gap-2">
          <Timer size={14} className="text-[#f2d892]" />
          <h3 className="text-[0.7rem] font-bold uppercase tracking-wider text-[#edd9c4]">
            Detalhamento por obra
          </h3>
        </div>

        <div className="metricas-montador-tempo__grid">
          {ranking.map((montador, i) => (
            <article
              key={montador.montador_id}
              className="metricas-montador-tempo__card"
              style={{ ['--rank-cor' as string]: CORES[Math.min(i, CORES.length - 1)] }}
            >
              <header className="metricas-montador-tempo__card-head">
                <span className="metricas-montador-tempo__rank">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-cream truncate">{montador.montador_nome}</p>
                  <p className="text-[0.65rem] text-[#d4bc9f]">
                    Média {fmtHorasChart(montador.tempo_medio_horas)}
                    {' · '}Total {fmtHorasChart(montador.tempo_total_horas)}
                    {' · '}{montador.obras_com_duracao} obra(s)
                  </p>
                </div>
              </header>

              <ul className="metricas-montador-tempo__obras">
                {montador.obras.map(obra => (
                  <li key={obra.obra_id} className="metricas-montador-tempo__obra">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-cream truncate">{obra.cliente_nome}</p>
                      {obra.tipo_obra_nome ? (
                        <p className="text-[0.62rem] text-[#d4bc9f] truncate">{obra.tipo_obra_nome}</p>
                      ) : null}
                    </div>
                    <p className="metricas-montador-tempo__obra-horas shrink-0">
                      {fmtDuracaoHoras(obra.duracao_horas, obra.duracao_em_andamento)}
                    </p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
