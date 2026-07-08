import { Check } from 'lucide-react'

interface Props {
  current: number
  total: number
  labels: string[]
}

export function PontoWizardStep({ current, total, labels }: Props) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex justify-between text-[0.65rem] uppercase tracking-widest text-[#b8957f]">
        <span>Passo {current} de {total}</span>
        <span>{Math.round((current / total) * 100)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(212,168,83,0.15)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#c9a045] to-[#f2d892] transition-all duration-500 ease-out"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {labels.map((label, i) => {
          const done = i + 1 < current
          const active = i + 1 === current
          return (
            <span
              key={label}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.65rem] uppercase tracking-wider transition-colors ${
                active
                  ? 'border border-[#f2d892]/50 bg-[#f2d892]/10 text-[#f2d892]'
                  : done
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border border-[rgba(212,168,83,0.2)] text-[#b8957f]'
              }`}
            >
              {done && <Check size={10} />}
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
