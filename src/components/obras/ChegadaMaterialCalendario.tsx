import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { ObraMontadorBadge } from '@/components/obras/ObraMontadorBadge'
import { ObraDataEntregaInput } from '@/components/obras/ObraDataEntregaInput'
import { ObraPedidoMaterialToggle } from '@/components/obras/ObraPedidoMaterialToggle'
import {
  addDaysISO,
  addMonthsToDate,
  formatCalendarRangeLabel,
  getChegadaCardColor,
  getMonthGrid,
  getWeekDayISOs,
  obrasParaDiaChegada,
  todayISO,
  toISODate,
} from '@/lib/obra-chegada-material'
import { cn } from '@/lib/utils'
import type { ObraFull } from '@/types'

type CalView = 'week' | 'month'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAYS_LONG = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
]
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTHS_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface ChegadaMaterialCalendarioProps {
  obras: ObraFull[]
  viewDate: Date
  onViewDateChange: (date: Date) => void
  onObraClick: (obra: ObraFull) => void
  canEdit: boolean
  onUpdateDataEntrega: (obra: ObraFull, data: string | null) => void
  updatingDataEntrega: string | null
  onTogglePedido: (obra: ObraFull, feito: boolean) => void
  togglingPedido: string | null
  /** Quando false, oculta título interno (uso em página dedicada). */
  showHeader?: boolean
  /** Estilo embutido abaixo do kanban; false em página só de calendário. */
  embedded?: boolean
}

function DayPopup({
  date,
  obras,
  onClose,
  onObraClick,
  canEdit,
  onUpdateDataEntrega,
  updatingDataEntrega,
  onTogglePedido,
  togglingPedido,
}: {
  date: Date
  obras: ObraFull[]
  onClose: () => void
  onObraClick: (obra: ObraFull) => void
  canEdit: boolean
  onUpdateDataEntrega: (obra: ObraFull, data: string | null) => void
  updatingDataEntrega: string | null
  onTogglePedido: (obra: ObraFull, feito: boolean) => void
  togglingPedido: string | null
}) {
  const hoje = todayISO()

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="glass-panel rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(212,168,83,0.18)]">
          <div>
            <p className="font-display text-lg text-[#d4a853] tracking-widest">
              {WEEKDAYS_LONG[date.getDay()]}, {date.getDate()} de {MONTHS_FULL[date.getMonth()]}
            </p>
            <p className="text-xs text-[#8a6a55]">
              {obras.length} chegada{obras.length !== 1 ? 's' : ''} programada{obras.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-outline btn-sm !px-2">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {obras.length === 0 ? (
            <p className="text-center text-sm text-[#8a6a55] py-6">Nenhuma chegada neste dia.</p>
          ) : (
            obras.map(obra => {
              const cor = getChegadaCardColor(obra, hoje)
              return (
                <div
                  key={obra.id}
                  className="rounded-lg overflow-hidden transition-all hover:brightness-110"
                  style={{ backgroundColor: `${cor}14`, border: `1px solid ${cor}33` }}
                >
                  <button
                    type="button"
                    onClick={() => onObraClick(obra)}
                    className="w-full text-left p-3"
                  >
                    <p className="font-semibold text-cream text-sm leading-tight break-words">{obra.cliente_nome}</p>
                    {obra.lousa && <p className="text-xs text-[#8a6a55] mt-0.5">{obra.lousa}</p>}
                    <ObraMontadorBadge obra={obra} compact />
                    {obra.numero_pedido_cort_claud && (
                      <p className="text-xs text-[#8a6a55] mt-1">Pedido: {obra.numero_pedido_cort_claud}</p>
                    )}
                  </button>
                  <div className="px-3 pb-3 flex flex-col gap-1.5">
                    <ObraPedidoMaterialToggle
                      obra={obra}
                      canEdit={canEdit}
                      loading={togglingPedido === obra.id}
                      onChange={feito => onTogglePedido(obra, feito)}
                      compact
                    />
                    <ObraDataEntregaInput
                      obra={obra}
                      canEdit={canEdit}
                      loading={updatingDataEntrega === obra.id}
                      onChange={data => onUpdateDataEntrega(obra, data)}
                      compact
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function ChegadaMaterialCalendario({
  obras,
  viewDate,
  onViewDateChange,
  onObraClick,
  canEdit,
  onUpdateDataEntrega,
  updatingDataEntrega,
  onTogglePedido,
  togglingPedido,
  showHeader = true,
  embedded = true,
}: ChegadaMaterialCalendarioProps) {
  const [calView, setCalView] = useState<CalView>('week')
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const hoje = todayISO()
  const weekDays = useMemo(() => getWeekDayISOs(viewDate).map(iso => new Date(`${iso}T12:00:00`)), [viewDate])
  const weekDayISOs = useMemo(() => getWeekDayISOs(viewDate), [viewDate])
  const monthGrid = useMemo(() => getMonthGrid(viewDate), [viewDate])
  const rangeLabel = useMemo(
    () => formatCalendarRangeLabel(calView, viewDate, weekDayISOs),
    [calView, viewDate, weekDayISOs],
  )

  const navigate = (dir: -1 | 1) => {
    if (calView === 'week') {
      onViewDateChange(new Date(addDaysISO(toISODate(viewDate), dir * 7) + 'T12:00:00'))
      return
    }
    onViewDateChange(addMonthsToDate(viewDate, dir))
  }

  const selectedDayObras = selectedDay
    ? obrasParaDiaChegada(obras, toISODate(selectedDay))
    : []

  return (
    <section
      className={[
        'chegada-material-calendario shrink-0',
        embedded
          ? 'border-t-2 border-[rgba(212,168,83,0.28)] bg-[rgba(10,4,2,0.55)] px-4 py-5 sm:px-6'
          : 'flex flex-1 flex-col min-h-0 px-4 py-4 sm:px-6',
      ].join(' ')}
    >
      <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', showHeader ? 'mb-4' : 'mb-3')}>
        {showHeader ? (
          <div>
            <h2 className="font-display text-lg text-[#d4a853] tracking-widest">Calendário de Chegadas</h2>
            <p className="text-xs text-[#8a6a55] mt-0.5">Materiais com data de chegada definida</p>
          </div>
        ) : (
          <div className="min-w-0" />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="obra-page-view-tabs">
            {(['week', 'month'] as CalView[]).map(view => (
              <button
                key={view}
                type="button"
                onClick={() => setCalView(view)}
                className="obra-page-view-tab"
                data-active={calView === view ? 'true' : undefined}
              >
                {view === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>

          <button type="button" className="btn btn-outline btn-sm whitespace-nowrap" onClick={() => onViewDateChange(new Date())}>
            Hoje
          </button>

          <div className="flex min-w-0 items-center gap-1">
            <button type="button" className="btn btn-outline btn-sm shrink-0 p-2" onClick={() => navigate(-1)} aria-label="Período anterior">
              <ChevronLeft size={15} />
            </button>
            <span className="obra-page-nav-label text-sm font-semibold text-[#d4a853] px-2 text-center min-w-[9rem]" title={rangeLabel}>
              {rangeLabel}
            </span>
            <button type="button" className="btn btn-outline btn-sm shrink-0 p-2" onClick={() => navigate(1)} aria-label="Próximo período">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {calView === 'week' && (
        <div className="cal-week-wrap">
          <div className="cal-week-grid">
            {weekDays.map(day => {
              const iso = toISODate(day)
              const isToday = iso === hoje
              const dayObras = obrasParaDiaChegada(obras, iso)
              const hasObras = dayObras.length > 0

              return (
                <div
                  key={iso}
                  onClick={() => hasObras && setSelectedDay(day)}
                  className={[
                    'cal-week-day glass-card p-2 flex flex-col min-h-[180px] transition-all',
                    isToday ? 'ring-1 ring-[#d4a853]/40' : '',
                    hasObras ? 'cursor-pointer hover:brightness-110' : '',
                  ].join(' ')}
                >
                  <div className="cal-week-day__header">
                    <div className={`cal-week-day__title-row ${isToday ? 'text-[#d4a853]' : 'text-[#8a6a55]'}`}>
                      <span className="cal-week-day__label">
                        {WEEKDAYS[day.getDay()]}
                        {isToday && (
                          <span className="ml-1 text-[0.55rem] bg-[#d4a853]/20 text-[#d4a853] rounded px-1 align-middle">
                            hoje
                          </span>
                        )}
                      </span>
                      {hasObras && (
                        <span className="shrink-0 rounded-full w-4 h-4 flex items-center justify-center text-[0.55rem] font-bold bg-[rgba(52,211,153,0.2)] text-[#34d399]">
                          {dayObras.length}
                        </span>
                      )}
                    </div>
                    <span className="cal-week-day__date">{day.getDate()}/{MONTHS[day.getMonth()]}</span>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    {dayObras.length === 0 ? (
                      <p className="text-[0.62rem] text-[#4a3328] mt-2 text-center">—</p>
                    ) : (
                      dayObras.slice(0, 3).map(obra => {
                        const cor = getChegadaCardColor(obra, hoje)
                        return (
                          <div
                            key={obra.id}
                            className="cal-week-card"
                            style={{ backgroundColor: `${cor}18`, borderLeft: `2px solid ${cor}` }}
                          >
                            <p className="font-semibold text-cream leading-tight truncate">{obra.cliente_nome}</p>
                            {obra.lousa && <p className="text-[0.62rem] text-[#8a6a55] truncate">{obra.lousa}</p>}
                            <ObraMontadorBadge obra={obra} compact />
                          </div>
                        )
                      })
                    )}
                    {dayObras.length > 3 && (
                      <p className="text-[0.62rem] text-[#d4a853] text-center">+{dayObras.length - 3} mais</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {calView === 'month' && (
        <div className="cal-month-wrap">
          <div className="cal-month-grid">
            <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {WEEKDAYS.map(wd => (
                <div key={wd} className="text-center text-[0.65rem] font-bold py-1 uppercase tracking-widest text-[#8a6a55]">
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {monthGrid.map((day, idx) => {
                const iso = toISODate(day)
                const isToday = iso === hoje
                const isThisMonth = day.getMonth() === viewDate.getMonth()
                const dayObras = obrasParaDiaChegada(obras, iso)
                const hasObras = dayObras.length > 0

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (!isThisMonth) {
                        onViewDateChange(day)
                        return
                      }
                      if (hasObras) setSelectedDay(day)
                    }}
                    className={[
                      'rounded-lg p-1.5 flex flex-col transition-all',
                      isThisMonth ? 'glass-card' : 'opacity-30',
                      isToday ? 'ring-1 ring-[#d4a853]/50' : '',
                      hasObras || !isThisMonth ? 'cursor-pointer hover:brightness-110' : '',
                    ].join(' ')}
                    style={{ minHeight: '72px' }}
                  >
                    <span className={[
                      'text-[0.7rem] font-bold self-start w-5 h-5 flex items-center justify-center rounded-full mb-1',
                      isToday
                        ? 'bg-[#d4a853] text-[#1a0f0a]'
                        : isThisMonth ? 'text-[#a08040]' : 'text-[#4a3328]',
                    ].join(' ')}>
                      {day.getDate()}
                    </span>
                    <div className="flex flex-wrap gap-0.5">
                      {dayObras.slice(0, 4).map((obra, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getChegadaCardColor(obra, hoje) }}
                          title={obra.cliente_nome}
                        />
                      ))}
                      {dayObras.length > 4 && (
                        <span className="text-[0.55rem] text-[#d4a853] font-bold leading-none self-center">
                          +{dayObras.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {[
          { cor: '#34d399', label: 'Programada' },
          { cor: '#ef4444', label: 'Atrasada' },
          { cor: '#10b981', label: 'Obra concluída' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5 text-[0.7rem] text-[#8a6a55]">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.cor }} />
            {item.label}
          </div>
        ))}
      </div>

      {selectedDay && (
        <DayPopup
          date={selectedDay}
          obras={selectedDayObras}
          onClose={() => setSelectedDay(null)}
          onObraClick={obra => { setSelectedDay(null); onObraClick(obra) }}
          canEdit={canEdit}
          onUpdateDataEntrega={onUpdateDataEntrega}
          updatingDataEntrega={updatingDataEntrega}
          onTogglePedido={onTogglePedido}
          togglingPedido={togglingPedido}
        />
      )}
    </section>
  )
}
