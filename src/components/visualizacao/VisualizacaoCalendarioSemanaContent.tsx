import { obrasParaDiaCalendario } from '@/lib/obra-dias-trabalho'
import { getStatusEfetivo } from '@/lib/obra-progresso'
import type { ObraFull, StatusKanbanObra } from '@/types'
import { VisualizacaoSemanaDia } from '@/components/visualizacao/VisualizacaoSemanaDia'

const STATUS_COLORS: Record<StatusKanbanObra, string> = {
  datas_em_aberto: '#6b7280',
  datas_em_atraso: '#ef4444',
  datas_definidas: '#3b82f6',
  em_andamento: '#f59e0b',
  concluida: '#10b981',
  cancelada: '#9ca3af',
}

const STATUS_LABEL: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Em atraso',
  datas_definidas: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

interface VisualizacaoCalendarioSemanaContentProps {
  rangeDays: string[]
  obrasCalendario: ObraFull[]
  diasAtivos?: number[]
  variant?: 'embedded' | 'fullscreen'
}

export function VisualizacaoCalendarioSemanaContent({
  rangeDays,
  obrasCalendario,
  diasAtivos = [1, 2, 3, 4, 5],
  variant = 'embedded',
}: VisualizacaoCalendarioSemanaContentProps) {
  return (
    <div className={variant === 'fullscreen' ? 'viz-fs-cal-grid-wrap' : 'viz-week-wrap'}>
      <div className={variant === 'fullscreen' ? 'viz-fs-cal-grid' : 'viz-week-grid'}>
        {rangeDays.map(iso => {
          const dayObras = obrasParaDiaCalendario(obrasCalendario, iso, diasAtivos)
          return (
            <VisualizacaoSemanaDia
              key={iso}
              iso={iso}
              count={dayObras.length}
              className={variant === 'fullscreen' ? 'viz-fs-cal-day' : undefined}
            >
              {dayObras.length === 0 ? (
                <p className="viz-empty">—</p>
              ) : (
                dayObras.map(obra => {
                  const status = getStatusEfetivo(obra)
                  const cor = STATUS_COLORS[status]
                  return (
                    <div
                      key={obra.id}
                      className={variant === 'fullscreen' ? 'viz-fs-mini-card' : 'viz-mini-card'}
                      style={{ borderLeftColor: cor, backgroundColor: `${cor}48` }}
                    >
                      <p className={variant === 'fullscreen' ? 'viz-fs-mini-card__title' : 'viz-mini-card__title'}>
                        {obra.cliente_nome}
                      </p>
                      <p className={variant === 'fullscreen' ? 'viz-fs-mini-card__meta' : 'viz-mini-card__meta'}>
                        {STATUS_LABEL[status]}
                      </p>
                    </div>
                  )
                })
              )}
            </VisualizacaoSemanaDia>
          )
        })}
      </div>
    </div>
  )
}
