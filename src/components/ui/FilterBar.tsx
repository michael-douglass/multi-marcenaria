interface FilterBarProps {
  options: string[]
  value?: string
  values?: Set<string>
  onChange: (v: string) => void
  labels?: Record<string, string>
  multi?: boolean
  /** Texto curto explicando que dá para combinar filtros (modo multi). */
  multiHint?: string
}

export function FilterBar({
  options,
  value,
  values,
  onChange,
  labels,
  multi,
  multiHint,
}: FilterBarProps) {
  const isActive = (opt: string) => {
    if (!multi) return value === opt
    if (opt === 'Todos') return values?.size === 0
    return values?.has(opt) ?? false
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const active = isActive(opt)
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt)}
              style={{
                padding: '.3rem .9rem',
                borderRadius: '9999px',
                fontSize: '.75rem',
                fontWeight: 600,
                border: active ? '1px solid #f2d892' : '1px solid rgba(240,210,140,.2)',
                background: active ? 'rgba(240,210,140,.14)' : 'transparent',
                color: active ? '#f2d892' : '#edd9c4',
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
      {multi && multiHint ? (
        <p className="mt-1.5 text-[0.68rem] text-[#d4bc9f]">{multiHint}</p>
      ) : null}
    </div>
  )
}
