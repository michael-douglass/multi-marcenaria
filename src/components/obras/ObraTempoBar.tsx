import { calcObraProgresso } from '@/lib/obra-progresso'
import type { ObraFull } from '@/types'

interface ObraTempoBarProps {
  obra: ObraFull
  compact?: boolean
}

export function ObraTempoBar({ obra, compact = false }: ObraTempoBarProps) {
  const progresso = calcObraProgresso(obra)
  const showPercent =
    progresso.variant !== 'no-dates' &&
    progresso.variant !== 'cancelled'

  return (
    <div className={compact ? 'mt-1' : 'mt-2.5'}>
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <span
          className={[
            'font-semibold leading-tight',
            compact ? 'text-[0.58rem]' : 'text-xs',
            progresso.variant === 'overdue' ? 'animate-pulse' : '',
          ].join(' ')}
          style={{ color: progresso.barColor }}
        >
          {progresso.label}
        </span>
        {showPercent && (
          <span
            className={[
              'tabular-nums text-[#8a6a55]',
              compact ? 'text-[0.55rem]' : 'text-[0.65rem]',
            ].join(' ')}
          >
            {progresso.percentElapsed}%
          </span>
        )}
      </div>

      <div
        className={[
          'rounded-full overflow-hidden',
          compact ? 'h-1' : 'h-1.5',
        ].join(' ')}
        style={{ backgroundColor: 'rgba(212,168,83,0.12)' }}
        role="progressbar"
        aria-valuenow={progresso.percentElapsed}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={progresso.label}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progresso.percentElapsed}%`,
            backgroundColor: progresso.barColor,
            boxShadow:
              progresso.variant === 'overdue'
                ? `0 0 8px ${progresso.barColor}88`
                : progresso.variant === 'running'
                  ? `0 0 6px ${progresso.barColor}66`
                  : undefined,
          }}
        />
      </div>

      {!compact && progresso.sublabel && (
        <p className="text-[0.62rem] text-[#8a6a55] mt-0.5">{progresso.sublabel}</p>
      )}
    </div>
  )
}
