interface FilterBarProps {
  options: string[]
  value: string
  onChange: (v: string) => void
  labels?: Record<string, string>
}

export function FilterBar({ options, value, onChange, labels }: FilterBarProps) {
  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '.3rem .9rem',
            borderRadius: '9999px',
            fontSize: '.75rem',
            fontWeight: 600,
            border: value === opt ? '1px solid #d4a853' : '1px solid rgba(212,168,83,.2)',
            background: value === opt ? 'rgba(212,168,83,.14)' : 'transparent',
            color: value === opt ? '#d4a853' : '#8a6a55',
            cursor: 'pointer',
            transition: 'all .15s',
            fontFamily: 'Raleway, sans-serif',
          }}
        >
          {labels?.[opt] ?? opt}
        </button>
      ))}
    </div>
  )
}
