interface FilterBarProps {
  options: string[]
  value?: string
  values?: Set<string>
  onChange: (v: string) => void
  labels?: Record<string, string>
  multi?: boolean
}

export function FilterBar({ options, value, values, onChange, labels, multi }: FilterBarProps) {
  const isActive = (opt: string) => {
    if (!multi) return value === opt
    if (opt === 'Todos') return values?.size === 0
    return values?.has(opt) ?? false
  }

  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {options.map(opt => {
        const active = isActive(opt)
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: '.3rem .9rem',
              borderRadius: '9999px',
              fontSize: '.75rem',
              fontWeight: 600,
              border: active ? '1px solid #d4a853' : '1px solid rgba(212,168,83,.2)',
              background: active ? 'rgba(212,168,83,.14)' : 'transparent',
              color: active ? '#d4a853' : '#8a6a55',
              cursor: 'pointer',
              transition: 'all .15s',
              fontFamily: 'Raleway, sans-serif',
            }}
          >
            {labels?.[opt] ?? opt}
          </button>
        )
      })}
    </div>
  )
}
