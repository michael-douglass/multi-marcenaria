import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  MONTHS_PT,
  WEEKDAYS_PT_SHORT,
  brDateToIso,
  buildCalendarMonthGrid,
  isoToBrDate,
  maskBrDateInput,
  parseIsoDate,
} from '@/lib/date-br'
import { cn, todayISO } from '@/lib/utils'

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string | null | undefined
  onChange: (iso: string | null) => void
}

interface CalendarPosition {
  top: number
  left: number
}

function DatePickerCalendar({
  value,
  onSelect,
  onClose,
  anchorId,
  position,
}: {
  value: string | null | undefined
  onSelect: (iso: string) => void
  onClose: () => void
  anchorId: string
  position: CalendarPosition
}) {
  const parsed = parseIsoDate(value)
  const today = parseIsoDate(todayISO())
  const [viewYear, setViewYear] = useState(parsed?.year ?? today?.year ?? new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today?.month ?? new Date().getMonth())

  useEffect(() => {
    const next = parseIsoDate(value)
    if (!next) return
    setViewYear(next.year)
    setViewMonth(next.month)
  }, [value])

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const cells = buildCalendarMonthGrid(viewYear, viewMonth)
  const selectedIso = value?.slice(0, 10) ?? null

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[340] cursor-default bg-transparent"
        aria-label="Fechar calendário"
        onClick={onClose}
      />
      <div
        id={anchorId}
        role="dialog"
        aria-modal="true"
        aria-label="Selecionar data"
        className="fixed z-[350] w-[min(300px,calc(100vw-1.5rem))] rounded-xl border border-[rgba(240,210,140,0.28)] bg-[rgba(42,28,20,0.98)] p-3 shadow-2xl backdrop-blur-md"
        style={{
          top: position.top,
          left: Math.min(position.left, window.innerWidth - 308),
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-lg p-1.5 text-[#edd9c4] transition hover:bg-[rgba(240,210,140,0.12)] hover:text-[#f2d892]"
            onClick={() => shiftMonth(-1)}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-semibold text-[#fffaf4]">
            {MONTHS_PT[viewMonth]} {viewYear}
          </p>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[#edd9c4] transition hover:bg-[rgba(240,210,140,0.12)] hover:text-[#f2d892]"
            onClick={() => shiftMonth(1)}
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-0.5">
          {WEEKDAYS_PT_SHORT.map(label => (
            <span
              key={label}
              className="py-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-[#d4bc9f]"
            >
              {label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell, index) => {
            if (!cell.day || !cell.iso) {
              return <span key={`empty-${index}`} className="h-9" />
            }

            const isSelected = cell.iso === selectedIso
            const isToday = cell.iso === todayISO()

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => onSelect(cell.iso!)}
                className={cn(
                  'h-9 rounded-lg text-sm font-medium transition',
                  isSelected
                    ? 'bg-[#f2d892] text-[#2a1c14]'
                    : isToday
                      ? 'border border-[#f2d892]/45 text-[#f2d892] hover:bg-[rgba(240,210,140,0.12)]'
                      : 'text-[#fffaf4] hover:bg-[rgba(240,210,140,0.1)]',
                )}
              >
                {cell.day}
              </button>
            )
          })}
        </div>
      </div>
    </>,
    document.body,
  )
}

/** Campo de data no formato brasileiro (dd/mm/aaaa), armazenando ISO (aaaa-mm-dd). */
export function DateInput({ value, onChange, className, disabled, onBlur, ...rest }: DateInputProps) {
  const [display, setDisplay] = useState(() => isoToBrDate(value))
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarPosition, setCalendarPosition] = useState<CalendarPosition>({ top: 0, left: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const calendarId = useId()

  useEffect(() => {
    setDisplay(isoToBrDate(value))
  }, [value])

  useEffect(() => {
    if (!calendarOpen) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCalendarOpen(false)
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [calendarOpen])

  const commit = (nextDisplay: string) => {
    if (!nextDisplay.trim()) {
      onChange(null)
      return
    }
    const iso = brDateToIso(nextDisplay)
    if (iso) {
      onChange(iso)
      setDisplay(isoToBrDate(iso))
      return
    }
    setDisplay(isoToBrDate(value))
  }

  const openCalendar = () => {
    if (disabled) return
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return

    // Garante que o texto do campo reflita a data já salva antes de abrir o calendário.
    const isoFromDisplay = brDateToIso(display)
    if (isoFromDisplay && isoFromDisplay !== value?.slice(0, 10)) {
      onChange(isoFromDisplay)
    }

    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= 320 ? rect.bottom + 6 : Math.max(8, rect.top - 306)

    setCalendarPosition({
      top,
      left: rect.left,
    })
    setCalendarOpen(true)
  }

  const selectFromCalendar = (iso: string) => {
    const br = isoToBrDate(iso)
    onChange(iso)
    setDisplay(br)
    setCalendarOpen(false)
  }

  return (
    <div ref={wrapperRef} className="date-input-group flex w-full min-w-0 items-stretch gap-1.5">
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        className={cn(
          'glass-input min-w-[11rem] flex-[1_1_0] !w-auto text-[0.95rem] tracking-wide',
          className,
        )}
        disabled={disabled}
        value={display}
        onChange={e => setDisplay(maskBrDateInput(e.target.value))}
        onBlur={e => {
          commit(display)
          onBlur?.(e)
        }}
      />
      <button
        type="button"
        className={cn(
          'glass-input flex h-[42px] w-10 shrink-0 items-center justify-center !px-0 transition',
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'text-[#f2d892] hover:border-[rgba(240,210,140,0.45)] hover:bg-[rgba(240,210,140,0.08)]',
          calendarOpen && 'border-[rgba(240,210,140,0.45)] bg-[rgba(240,210,140,0.08)]',
        )}
        disabled={disabled}
        onClick={openCalendar}
        aria-label="Abrir calendário"
        aria-expanded={calendarOpen}
        aria-controls={calendarOpen ? calendarId : undefined}
      >
        <Calendar size={16} />
      </button>

      {calendarOpen && (
        <DatePickerCalendar
          value={value}
          onSelect={selectFromCalendar}
          onClose={() => setCalendarOpen(false)}
          anchorId={calendarId}
          position={calendarPosition}
        />
      )}
    </div>
  )
}
