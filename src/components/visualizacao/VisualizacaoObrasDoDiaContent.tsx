import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Clock, HardHat, Sun, Sunrise } from 'lucide-react'
import { ObraPedidoMaterialBadge } from '@/components/obras/ObraPedidoMaterialBadge'
import { ObraTempoBar } from '@/components/obras/ObraTempoBar'
import { addDaysISO } from '@/lib/obra-chegada-material'
import { formatObraHorarioRange, obrasParaDiaCalendario } from '@/lib/obra-dias-trabalho'
import { getObraMontadorNomes } from '@/lib/obra-montadores'
import { getStatusEfetivo } from '@/lib/obra-progresso'
import { fmtDate } from '@/lib/utils'
import { listNeedsAutoScroll, useElementAutoScroll } from '@/hooks/useElementAutoScroll'
import type { ObraFull, StatusKanbanObra } from '@/types'

const STATUS_COLORS: Record<StatusKanbanObra, string> = {
  datas_em_aberto: '#9ca3af',
  datas_em_atraso: '#ef4444',
  datas_definidas: '#60a5fa',
  em_andamento: '#f59e0b',
  concluida: '#34d399',
  cancelada: '#6b7280',
}

const STATUS_LABEL: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Em atraso',
  datas_definidas: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

interface DiaColunaProps {
  titulo: string
  subtitulo: string
  icon: ReactNode
  accent: string
  obras: ObraFull[]
  emptyMessage: string
}

function DiaColuna({
  titulo,
  subtitulo,
  icon,
  accent,
  obras,
  emptyMessage,
}: DiaColunaProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(false)

  useEffect(() => {
    const el = listRef.current
    if (!el) return

    const update = () => setAutoScroll(listNeedsAutoScroll(el))
    update()

    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [obras])

  useElementAutoScroll(autoScroll, listRef, obras.length)

  return (
    <section
      className="viz-obras-dia-col viz-obras-dia-col--fs"
      style={{ ['--viz-dia-accent' as string]: accent }}
    >
      <header className="viz-obras-dia-col__head">
        <span className="viz-obras-dia-col__icon" aria-hidden>{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="viz-obras-dia-col__title">{titulo}</h3>
          <p className="viz-obras-dia-col__date">{subtitulo}</p>
        </div>
        <span className="viz-obras-dia-col__count">{obras.length}</span>
      </header>

      <div
        ref={listRef}
        className={
          obras.length === 0
            ? 'viz-obras-dia-col__list'
            : autoScroll
              ? 'viz-obras-dia-col__list viz-obras-dia-col__list--scroll'
              : 'viz-obras-dia-col__list viz-obras-dia-col__list--fill'
        }
      >
        {obras.length === 0 ? (
          <p className="viz-obras-dia-col__empty">{emptyMessage}</p>
        ) : (
          obras.map(obra => {
            const status = getStatusEfetivo(obra)
            const montadores = getObraMontadorNomes(obra)
            const horario = formatObraHorarioRange(obra.horario_inicio, obra.horario_fim)
            return (
              <article
                key={obra.id}
                className="viz-obras-dia-card viz-obras-dia-card--fs"
                style={{ ['--viz-obra-status' as string]: STATUS_COLORS[status] }}
              >
                <div className="viz-obras-dia-card__content">
                  <div className="viz-obras-dia-card__row-main">
                    <p className="viz-obras-dia-card__cliente">{obra.cliente_nome}</p>
                    <span className={horario ? 'viz-obras-dia-card__horario' : 'viz-obras-dia-card__horario viz-obras-dia-card__horario--empty'}>
                      <Clock size={12} strokeWidth={2.25} aria-hidden />
                      {horario ?? '—'}
                    </span>
                    <span className="viz-obras-dia-card__status">{STATUS_LABEL[status]}</span>
                  </div>
                  <div className="viz-obras-dia-card__row-meta">
                    {obra.tipo_obra_nome ? (
                      <span className="viz-obras-dia-card__tipo">{obra.tipo_obra_nome}</span>
                    ) : null}
                    <ObraPedidoMaterialBadge obra={obra} compact />
                    {montadores.length > 0 ? (
                      <div className="viz-obras-dia-card__chips">
                        {montadores.map(nome => (
                          <span key={`${obra.id}-${nome}`} className="viz-obras-dia-chip">
                            <HardHat size={11} aria-hidden />
                            {nome}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="viz-obras-dia-card__sem-montador">Sem montador</span>
                    )}
                  </div>
                </div>
                <div className="viz-obras-dia-card__progress">
                  <ObraTempoBar obra={obra} compact />
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}

interface VisualizacaoObrasDoDiaContentProps {
  obrasCalendario: ObraFull[]
  hoje: string
  diasAtivos?: number[]
}

/** Quadro TV compacto: hoje + amanhã com horários e montadores. */
export function VisualizacaoObrasDoDiaContent({
  obrasCalendario,
  hoje,
  diasAtivos = [1, 2, 3, 4, 5],
}: VisualizacaoObrasDoDiaContentProps) {
  const amanha = addDaysISO(hoje, 1)
  const obrasHoje = obrasParaDiaCalendario(obrasCalendario, hoje, diasAtivos)
  const obrasAmanha = obrasParaDiaCalendario(obrasCalendario, amanha, diasAtivos)

  return (
    <div className="viz-obras-dia viz-obras-dia--fs">
      <div className="viz-obras-dia__board">
        <DiaColuna
          titulo="Hoje"
          subtitulo={fmtDate(hoje)}
          icon={<Sun size={20} strokeWidth={2} />}
          accent="#f2d892"
          obras={obrasHoje}
          emptyMessage="Nenhuma obra hoje."
        />
        <DiaColuna
          titulo="Amanhã"
          subtitulo={fmtDate(amanha)}
          icon={<Sunrise size={20} strokeWidth={2} />}
          accent="#60a5fa"
          obras={obrasAmanha}
          emptyMessage="Nenhuma obra amanhã."
        />
      </div>
    </div>
  )
}
