import { AlertTriangle, CalendarCheck, CalendarClock } from 'lucide-react'
import type { CSSProperties } from 'react'
import { AgendaEntregaShaderBackdrop } from '@/components/obras/AgendaEntregaShaderBackdrop'
import {
  type AgendaEntregaDestaque,
  type AgendaEntregaResumo,
} from '@/lib/agenda-entrega-resumo'
import { formatObraMesAnoLabel } from '@/lib/obra-mes-filtro'
import { cn } from '@/lib/utils'

interface AgendaEntregaKpiStripProps {
  resumo: AgendaEntregaResumo
  active: AgendaEntregaDestaque | null
  onSelect: (destaque: AgendaEntregaDestaque) => void
}

const ACTIVE_INDEX: Record<AgendaEntregaDestaque, number> = {
  mes: 1,
  atraso: 2,
  proximo: 3,
}

interface KpiCardDef {
  key: AgendaEntregaDestaque
  value: number
  kicker: string
  title: string
  hint: string
  accent: string
  icon: typeof CalendarCheck
}

/** Três medidores de entrega: este mês, atraso e mês seguinte. Clique filtra o quadro. */
export function AgendaEntregaKpiStrip({
  resumo,
  active,
  onSelect,
}: AgendaEntregaKpiStripProps) {
  const mesLabel = formatObraMesAnoLabel(resumo.mesAtual.mes, resumo.mesAtual.ano)
  const proximoLabel = formatObraMesAnoLabel(resumo.mesProximo.mes, resumo.mesProximo.ano)

  const cards: KpiCardDef[] = [
    {
      key: 'mes',
      value: resumo.entregarMes,
      kicker: mesLabel,
      title: 'A entregar este mês',
      hint: 'Obras abertas com prazo neste mês. Clique para ver só elas.',
      accent: '#f2d892',
      icon: CalendarCheck,
    },
    {
      key: 'atraso',
      value: resumo.emAtraso,
      kicker: resumo.emAtraso > 0 ? 'prazo vencido' : 'em dia',
      title: 'Em atraso',
      hint: 'Obras cujo prazo já passou e ainda não foram concluídas. Clique para ver só elas.',
      accent: '#f87171',
      icon: AlertTriangle,
    },
    {
      key: 'proximo',
      value: resumo.entregarProximo,
      kicker: proximoLabel,
      title: 'A entregar no próximo mês',
      hint: 'Obras abertas com prazo no mês seguinte. Clique para ver só elas.',
      accent: '#7dd3fc',
      icon: CalendarClock,
    },
  ]

  return (
    <div className="agenda-entrega-kpi" role="group" aria-label="Resumo de entregas — clique para filtrar o quadro">
      <AgendaEntregaShaderBackdrop
        active={active ? ACTIVE_INDEX[active] : 0}
        atrasoHeat={resumo.emAtraso > 0 ? 1 : 0}
      />
      <div className="agenda-entrega-kpi__grain" aria-hidden />
      <div className="agenda-entrega-kpi__grid">
        {cards.map(card => {
          const pressed = active === card.key
          const Icon = card.icon
          return (
            <button
              key={card.key}
              type="button"
              className={cn(
                'agenda-entrega-kpi__card',
                pressed && 'agenda-entrega-kpi__card--active',
                card.key === 'atraso' && card.value > 0 && 'agenda-entrega-kpi__card--alert',
              )}
              style={{ '--kpi-accent': card.accent } as CSSProperties}
              aria-pressed={pressed}
              title={pressed ? `${card.hint} Clique de novo para limpar o filtro.` : card.hint}
              onClick={() => onSelect(card.key)}
            >
              <span className="agenda-entrega-kpi__kicker">
                <Icon size={13} aria-hidden />
                {card.kicker}
              </span>
              <span className="agenda-entrega-kpi__value">
                {card.value}
              </span>
              <span className="agenda-entrega-kpi__title">{card.title}</span>
              {pressed ? (
                <span className="agenda-entrega-kpi__stamp">Filtrando</span>
              ) : (
                <span className="agenda-entrega-kpi__cta">Clique para filtrar</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
