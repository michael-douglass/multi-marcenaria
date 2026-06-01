import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useObras } from '../hooks/useObras'
import { useApp } from '../context/AppContext'
import { LoadingState, ErrorState } from '../components/ui/EmptyState'
import type { ObraFull, StatusKanbanObra } from '../types'

const STATUS_COLORS: Record<StatusKanbanObra, string> = {
  datas_em_aberto: '#6b7280',
  datas_em_atraso: '#ef4444',
  datas_definidas: '#3b82f6',
  em_andamento:    '#f59e0b',
  concluida:       '#10b981',
  cancelada:       '#9ca3af',
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function fmtDay(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()}/${MONTHS[date.getMonth()]}`
}

function obrasForDay(obras: ObraFull[], dayISO: string): ObraFull[] {
  return obras.filter(o => {
    const inicio = o.data_prevista_inicio
    const fim = o.data_prevista_fim
    if (!inicio && !fim) return false
    const s = inicio ?? dayISO
    const e = fim ?? dayISO
    return dayISO >= s && dayISO <= e
  })
}

export function CalendarioObras() {
  const { role } = useApp()
  const { data: obras, loading, error } = useObras()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const prevWeek = () => setWeekStart(d => addDays(d, -7))
  const nextWeek = () => setWeekStart(d => addDays(d, 7))
  const goToday = () => setWeekStart(startOfWeek(new Date()))

  const todayISO = toISO(new Date())
  const weekLabel = `${days[0].getDate()}/${MONTHS[days[0].getMonth()]} — ${days[6].getDate()}/${MONTHS[days[6].getMonth()]} ${days[6].getFullYear()}`

  const isMontador = role === 'Montador'
  const _ = isMontador // suprime warning — filtro é feito via RLS no hook

  return (
    <div className="fade-in">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>Calendário de Obras</h1>
          <p className="section-label mt-1">Visão semanal de obras programadas</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-outline btn-md" onClick={goToday}>Hoje</button>
          <button type="button" className="btn btn-outline btn-md p-2" onClick={prevWeek}><ChevronLeft size={16} /></button>
          <span className="text-sm text-[#d4a853] font-semibold min-w-[190px] text-center">{weekLabel}</span>
          <button type="button" className="btn btn-outline btn-md p-2" onClick={nextWeek}><ChevronRight size={16} /></button>
        </div>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {days.map(day => {
            const iso = toISO(day)
            const isToday = iso === todayISO
            const dayObras = obrasForDay(obras, iso)

            return (
              <div key={iso} className={`glass-card p-2 flex flex-col min-h-[200px] ${isToday ? 'ring-1 ring-[#d4a853]/40' : ''}`}>
                {/* Header do dia */}
                <div className={`text-[0.72rem] font-bold mb-2 pb-1.5 border-b border-[rgba(212,168,83,0.12)] ${isToday ? 'text-[#d4a853]' : 'text-[#8a6a55]'}`}>
                  {fmtDay(day)}
                  {isToday && <span className="ml-1 text-[0.6rem] bg-[#d4a853]/20 text-[#d4a853] rounded px-1">hoje</span>}
                </div>

                {/* Obras do dia */}
                <div className="flex flex-col gap-1.5 flex-1">
                  {dayObras.length === 0 ? (
                    <p className="text-[0.65rem] text-[#4a3328] mt-2 text-center">—</p>
                  ) : (
                    dayObras.map(o => (
                      <div
                        key={o.id}
                        className="rounded p-1.5 text-[0.65rem]"
                        style={{
                          backgroundColor: `${STATUS_COLORS[o.status_kanban]}18`,
                          borderLeft: `2px solid ${STATUS_COLORS[o.status_kanban]}`,
                        }}
                      >
                        <p className="font-semibold text-cream leading-tight truncate">{o.cliente_nome}</p>
                        {o.montador_nome && (
                          <p className="text-[#8a6a55] truncate">{o.montador_nome}</p>
                        )}
                        {o.tipo_obra_nome && (
                          <p className="text-[#8a6a55] truncate">{o.tipo_obra_nome}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legenda */}
      {!loading && !error && (
        <div className="mt-6 flex flex-wrap gap-3">
          {Object.entries(STATUS_COLORS).map(([key, cor]) => (
            <div key={key} className="flex items-center gap-1.5 text-[0.7rem] text-[#8a6a55]">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} />
              {key.replace(/_/g, ' ')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
