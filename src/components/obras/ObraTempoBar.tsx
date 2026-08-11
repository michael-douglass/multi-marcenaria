import { calcObraProgresso } from '@/lib/obra-progresso'
import type { ObraFull } from '@/types'

interface ObraTempoBarProps {
  obra: ObraFull
  compact?: boolean
  /** Uma linha só — ideal para cards da visão semana */
  micro?: boolean
}

export function ObraTempoBar({ obra, compact = false, micro = false }: ObraTempoBarProps) {
  const progresso = calcObraProgresso(obra)
  const showPercent =
    progresso.variant !== 'no-dates' &&
    progresso.variant !== 'cancelled'

  if (micro) {
    return (
      <div
        className="mt-0.5 flex w-full max-w-full min-w-0 items-center gap-1"
        title={[progresso.label, progresso.sublabel].filter(Boolean).join(' · ')}
      >
        <div
          className="h-0.5 min-w-0 flex-1 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgba(240,210,140,0.12)' }}
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
            }}
          />
        </div>
        <span
          className={[
            'shrink-0 max-w-[55%] truncate font-semibold leading-none text-[0.48rem]',
            progresso.variant === 'overdue' ? 'animate-pulse' : '',
          ].join(' ')}
          style={{ color: progresso.barColor }}
        >
          {progresso.label}
        </span>
      </div>
    )
  }

  return (
    <div className={`w-full max-w-full min-w-0 ${compact ? 'mt-1' : 'mt-2.5'}`}>
      <div className="mb-1 flex min-w-0 items-center justify-between gap-1.5">
        <span
          className={[
            'min-w-0 flex-1 font-semibold leading-tight',
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
              'tabular-nums text-[#edd9c4]',
              compact ? 'text-[0.55rem]' : 'text-[0.65rem]',
            ].join(' ')}
          >
            {progresso.percentElapsed}%
          </span>
        )}
      </div>

      <div
        className={[
          'w-full max-w-full min-w-0 rounded-full overflow-hidden',
          compact ? 'h-1' : 'h-1.5',
        ].join(' ')}
        style={{ backgroundColor: 'rgba(240,210,140,0.12)' }}
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
        <p className="text-[0.62rem] text-[#edd9c4] mt-0.5">{progresso.sublabel}</p>
      )}
    </div>
  )
}
