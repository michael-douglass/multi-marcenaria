import { useEffect, useState } from 'react'
import { maskTime24Input, normalizeTime24, parseTime24Input } from '@/lib/time-24'

interface TimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string | null | undefined
  onChange: (time: string | null) => void
}

/** Campo de horário no formato 24h (hh:mm). */
export function TimeInput({ value, onChange, className, disabled, onBlur, ...rest }: TimeInputProps) {
  const [display, setDisplay] = useState(() => normalizeTime24(value))

  useEffect(() => {
    setDisplay(normalizeTime24(value))
  }, [value])

  const commit = (nextDisplay: string) => {
    if (!nextDisplay.trim()) {
      onChange(null)
      return
    }
    const time = parseTime24Input(nextDisplay)
    if (time) {
      onChange(time)
      setDisplay(time)
      return
    }
    setDisplay(normalizeTime24(value))
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="hh:mm"
      className={className}
      disabled={disabled}
      value={display}
      onChange={e => setDisplay(maskTime24Input(e.target.value))}
      onBlur={e => {
        commit(e.currentTarget.value)
        onBlur?.(e)
      }}
    />
  )
}
