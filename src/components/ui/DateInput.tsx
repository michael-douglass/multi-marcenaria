import { useEffect, useState } from 'react'
import { brDateToIso, isoToBrDate, maskBrDateInput } from '@/lib/date-br'

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string | null | undefined
  onChange: (iso: string | null) => void
}

/** Campo de data no formato brasileiro (dd/mm/aaaa), armazenando ISO (aaaa-mm-dd). */
export function DateInput({ value, onChange, className, disabled, onBlur, ...rest }: DateInputProps) {
  const [display, setDisplay] = useState(() => isoToBrDate(value))

  useEffect(() => {
    setDisplay(isoToBrDate(value))
  }, [value])

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

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      className={className}
      disabled={disabled}
      value={display}
      onChange={e => setDisplay(maskBrDateInput(e.target.value))}
      onBlur={e => {
        commit(display)
        onBlur?.(e)
      }}
    />
  )
}
