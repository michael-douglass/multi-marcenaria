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
  filterObrasTerminoNoMes,
  fmtHorasChart,
  type MetricasTempoPeriodo,
  type MontadorTempoResumo,
} from '@/lib/metricas-montador-tempo'
import type { MetricaObraDetalhe } from '@/types'

interface Props {
  porObra: MetricaObraDetalhe[]
  periodo: MetricasTempoPeriodo
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

const CORES = ['#047857', '#059669', '#8d5e22', '#b45309', '#c2410c', '#b91c1c']

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

export function MetricasMontadorTempoChart({ porObra, periodo, periodoLabel }: Props) {
  const obrasFiltradas = useMemo(
    () => filterObrasTerminoNoMes(porObra, periodo),
    [porObra, periodo.mes, periodo.ano],
  )
  const ranking = useMemo(() => buildMontadorTempoRanking(obrasFiltradas), [obrasFiltradas])

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
        <p className="metricas-montador-tempo__muted text-center text-sm">
          Nenhuma obra finalizada por montador em {periodoLabel}.
        </p>
      </section>
    )
  }

  return (
    <section className="metricas-montador-tempo glass-card mb-8 overflow-hidden">
      <div className="metricas-montador-tempo__glow" aria-hidden />

      <header className="metricas-montador-tempo__header">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <Gauge size={15} className="metricas-montador-tempo__accent" />
            <p className="metricas-montador-tempo__eyebrow">
              Comparativo de execução
            </p>
          </div>
          <h2 className="metricas-montador-tempo__title font-display text-xl tracking-wide sm:text-2xl">
            Tempo médio por montador
          </h2>
          <p className="metricas-montador-tempo__muted mt-1 max-w-2xl text-xs">
            Obras finalizadas em {periodoLabel} — barras = tempo médio por obra;
            detalhes de cada cliente abaixo.
          </p>
        </div>

        {maisRapido && (
          <div className="metricas-montador-tempo__destaque shrink-0">
            <div className="metricas-montador-tempo__accent flex items-center gap-1.5">
              <Trophy size={14} />
              <span className="text-[0.62rem] font-bold uppercase tracking-wider">Menor média</span>
            </div>
            <p className="metricas-montador-tempo__ink font-display mt-0.5 text-lg">{maisRapido.montador_nome}</p>
            <p className="metricas-montador-tempo__ok font-mono text-sm">
              {fmtHorasChart(maisRapido.tempo_medio_horas)} / obra
            </p>
          </div>
        )}
      </header>

      <div
        className="metricas-montador-tempo__chart px-4 pb-2 sm:px-5"
        style={{ height: Math.max(200, chartData.length * 52 + 40) }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            barCategoryGap="22%"
          >
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(42,24,18,0.1)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, maxMedia * 1.12]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#3d261c', fontSize: 11, fontWeight: 500 }}
              tickFormatter={v => fmtHorasChart(Number(v))}
            />
            <YAxis
              type="category"
              dataKey="nomeCurto"
              width={108}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#2a1812', fontSize: 12, fontWeight: 700 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(42,24,18,0.05)' }} />
            <Bar dataKey="media" radius={[0, 6, 6, 0]} barSize={22}>
              {chartData.map(entry => (
                <Cell key={entry.id} fill={entry.cor} fillOpacity={0.92} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="metricas-montador-tempo__detalhe border-t border-[rgba(42,24,18,0.1)]">
        <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
          <Timer size={14} className="metricas-montador-tempo__accent" />
          <h3 className="metricas-montador-tempo__eyebrow">
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
                  <p className="metricas-montador-tempo__ink truncate font-semibold">{montador.montador_nome}</p>
                  <p className="metricas-montador-tempo__muted text-[0.65rem]">
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
                      <p className="metricas-montador-tempo__ink truncate text-sm">{obra.cliente_nome}</p>
                      {obra.tipo_obra_nome ? (
                        <p className="metricas-montador-tempo__muted truncate text-[0.62rem]">{obra.tipo_obra_nome}</p>
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
