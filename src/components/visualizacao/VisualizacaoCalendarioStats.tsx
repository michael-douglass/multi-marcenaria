import { CalendarRange, CheckCircle2, Layers3 } from 'lucide-react'
import { formatObraMesAnoLabel } from '@/lib/obra-mes-filtro'
import type { VisualizacaoObrasMesStats } from '@/lib/visualizacao-obras-stats'

interface Props {
  stats: VisualizacaoObrasMesStats
  mes: number
  ano: number
}

interface StatItemProps {
  icon: React.ReactNode
  value: number
  label: string
  title: string
  tone: 'total' | 'mes' | 'feitas'
}

function StatItem({ icon, value, label, title, tone }: StatItemProps) {
  return (
    <div
      className={`viz-panel__stat viz-panel__stat--${tone}`}
      title={title}
      aria-label={`${label}: ${value}`}
    >
      <span className="viz-panel__stat-icon" aria-hidden>{icon}</span>
      <span className="viz-panel__stat-value">{value}</span>
      <span className="viz-panel__stat-label">{label}</span>
    </div>
  )
}

export function VisualizacaoCalendarioStats({ stats, mes, ano }: Props) {
  const mesLabel = formatObraMesAnoLabel(mes, ano)

  return (
    <div className="viz-panel__stats" role="group" aria-label="Resumo de obras do mês">
      <StatItem
        tone="total"
        icon={<Layers3 size={13} strokeWidth={2.25} />}
        value={stats.total}
        label="Total"
        title={`${stats.total} obra(s) ativa(s) no sistema (exceto canceladas)`}
      />
      <StatItem
        tone="mes"
        icon={<CalendarRange size={13} strokeWidth={2.25} />}
        value={stats.aFinalizarMes}
        label="Este mês"
        title={`${stats.aFinalizarMes} obra(s) com entrega prevista em ${mesLabel}`}
      />
      <StatItem
        tone="feitas"
        icon={<CheckCircle2 size={13} strokeWidth={2.25} />}
        value={stats.concluidasMes}
        label="Feitas"
        title={`${stats.concluidasMes} obra(s) concluída(s) entre as previstas para ${mesLabel}`}
      />
    </div>
  )
}
