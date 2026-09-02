import { useEffect, useId, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Lock, Maximize2, Minimize2, Settings2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SaldoMesInsightAura } from '@/components/dashboard/SaldoMesInsightAura'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FLOATING_SALDO_RIGHT,
  FLOATING_TOP_EDGE,
} from '@/lib/floating-ui-layout'
import { saldoMesInsightClass } from '@/lib/overlay-z-index'
import {
  type SaldoMesForecast,
  type SaldoMesInsightConfig,
  type SaldoMesInsightMessage,
  resolveSaldoMesForecastTone,
  minutesToMs,
  msToMinutes,
  msToSeconds,
  secondsToMs,
} from '@/lib/saldo-mes-insight'
import { cn, fmtCur } from '@/lib/utils'

interface SaldoMesInsightCardProps {
  message: SaldoMesInsightMessage
  proximosMeses: SaldoMesForecast[]
  proximosLoading?: boolean
  config: SaldoMesInsightConfig
  visible: boolean
  exiting?: boolean
  isMobile?: boolean
  onDismiss: () => void
  onLock: () => void
  onSaveConfig: (next: SaldoMesInsightConfig) => void
  onHoldChange?: (holding: boolean) => void
  onForecastOpenChange?: (open: boolean) => void
}

const TONE_STYLES: Record<
  SaldoMesInsightMessage['tone'],
  { bar: string; chip: string; value: string; rowPos: string; rowNeg: string }
> = {
  sucesso: {
    bar: 'linear-gradient(180deg, #059669 0%, rgba(5,150,105,0.12) 100%)',
    chip: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-800',
    value: 'text-emerald-700',
    rowPos: 'text-emerald-700',
    rowNeg: 'text-red-700',
  },
  quase: {
    bar: 'linear-gradient(180deg, #c4963a 0%, rgba(196,150,58,0.12) 100%)',
    chip: 'border-[rgba(196,150,58,0.35)] bg-[rgba(196,150,58,0.12)] text-[#8d5e22]',
    value: 'text-[#8d5e22]',
    rowPos: 'text-emerald-700',
    rowNeg: 'text-[#8d5e22]',
  },
  falta: {
    bar: 'linear-gradient(180deg, #c2410c 0%, rgba(194,65,12,0.12) 100%)',
    chip: 'border-orange-400/30 bg-orange-500/10 text-orange-900',
    value: 'text-orange-800',
    rowPos: 'text-emerald-700',
    rowNeg: 'text-orange-800',
  },
  alerta: {
    bar: 'linear-gradient(180deg, #dc2626 0%, rgba(220,38,38,0.12) 100%)',
    chip: 'border-red-400/30 bg-red-500/10 text-red-700',
    value: 'text-red-700',
    rowPos: 'text-emerald-700',
    rowNeg: 'text-red-700',
  },
}

function ForecastRow({
  mes,
  index,
  styles,
  animate = true,
}: {
  mes: SaldoMesForecast
  index: number
  styles: (typeof TONE_STYLES)[SaldoMesInsightMessage['tone']]
  animate?: boolean
}) {
  const tone = resolveSaldoMesForecastTone(mes.saldo)
  const positivo = mes.saldo >= 0

  return (
    <li
      className={cn(
        'rounded-lg border border-[rgba(42,24,18,0.08)] bg-[rgba(42,24,18,0.03)] px-3 py-2.5',
        animate && 'saldo-mes-insight-forecast-row',
      )}
      style={animate ? { animationDelay: `${index * 70}ms` } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b5244]">
          {mes.label}
        </span>
        <span
          className={cn(
            'font-display text-sm tabular-nums tracking-[0.03em]',
            positivo ? styles.rowPos : styles.rowNeg,
          )}
        >
          {fmtCur(mes.saldo)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.12em] text-[#8a7060]">
        <span>Receber {fmtCur(mes.totalAReceber)}</span>
        <span>Pagar {fmtCur(mes.totalAPagarMes)}</span>
      </div>
      {tone === 'alerta' ? (
        <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-red-700/80">
          Atenção: buraco acima de 60 mil
        </p>
      ) : null}
    </li>
  )
}

export function SaldoMesInsightCard({
  message,
  proximosMeses,
  proximosLoading = false,
  config,
  visible,
  exiting = false,
  isMobile = false,
  onDismiss,
  onLock,
  onSaveConfig,
  onHoldChange,
  onForecastOpenChange,
}: SaldoMesInsightCardProps) {
  const navigate = useNavigate()
  const titleId = useId()
  const forecastId = useId()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [intervalMin, setIntervalMin] = useState(msToMinutes(config.intervalMs))
  const [durationSec, setDurationSec] = useState(msToSeconds(config.durationMs))
  const [enabled, setEnabled] = useState(config.enabled)

  const forecastOpen = !minimized && ((!isMobile && hovering) || pinned)
  const holding = settingsOpen || forecastOpen || minimized

  useEffect(() => {
    setIntervalMin(msToMinutes(config.intervalMs))
    setDurationSec(msToSeconds(config.durationMs))
    setEnabled(config.enabled)
  }, [config.durationMs, config.enabled, config.intervalMs])

  useEffect(() => {
    onHoldChange?.(holding)
  }, [holding, onHoldChange])

  useEffect(() => {
    onForecastOpenChange?.(forecastOpen)
  }, [forecastOpen, onForecastOpenChange])

  useEffect(() => {
    return () => {
      onHoldChange?.(false)
      onForecastOpenChange?.(false)
    }
  }, [onForecastOpenChange, onHoldChange])

  useEffect(() => {
    if (!visible) {
      setHovering(false)
      setPinned(false)
      setSettingsOpen(false)
      setMinimized(false)
    }
  }, [visible])

  if (!visible || typeof document === 'undefined') return null

  const tone = TONE_STYLES[message.tone]

  const goDashboard = () => {
    onDismiss()
    navigate('/dashboard')
  }

  const stop = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const saveSettings = (e: MouseEvent) => {
    e.stopPropagation()
    onSaveConfig({
      intervalMs: minutesToMs(intervalMin),
      durationMs: secondsToMs(durationSec),
      enabled,
    })
    setSettingsOpen(false)
  }

  const minimize = (e?: MouseEvent) => {
    e?.stopPropagation()
    setMinimized(true)
    setPinned(false)
    setHovering(false)
    setSettingsOpen(false)
  }

  const expand = (e?: MouseEvent) => {
    e?.stopPropagation()
    setMinimized(false)
  }

  const handleCardClick = () => {
    if (settingsOpen || minimized) return
    setPinned(open => !open)
  }

  const handleCardPointerEnter = () => {
    if (!isMobile && !minimized) setHovering(true)
  }

  const handleCardPointerLeave = () => {
    if (!isMobile) setHovering(false)
  }

  const actionBtnClass = cn(
    'inline-flex items-center justify-center rounded-md',
    'border border-[rgba(42,24,18,0.12)] bg-[rgba(42,24,18,0.04)] text-[#6b5244]',
    'transition-colors hover:bg-[rgba(42,24,18,0.08)]',
    isMobile ? 'h-9 w-9' : 'h-7 w-7',
  )

  return createPortal(
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={cn(
        'saldo-mes-insight fixed touch-manipulation',
        saldoMesInsightClass,
        FLOATING_TOP_EDGE,
        FLOATING_SALDO_RIGHT,
        minimized
          ? 'w-auto max-w-[min(calc(100vw-5.5rem),18rem)]'
          : forecastOpen
            ? 'w-[min(100vw-5.5rem,26rem)]'
            : 'w-[min(calc(100vw-5.5rem),22rem)]',
        !isMobile && 'transition-[width] duration-300 ease-out',
        exiting ? 'saldo-mes-insight-exit' : 'saldo-mes-insight-enter',
      )}
      onPointerEnter={handleCardPointerEnter}
      onPointerLeave={handleCardPointerLeave}
    >
      {minimized ? (
        <article
          role="button"
          tabIndex={0}
          onClick={() => expand()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              expand()
            }
          }}
          aria-expanded={false}
          className={cn(
            'group relative flex cursor-pointer items-center gap-2 overflow-hidden rounded-xl border border-[rgba(42,24,18,0.12)]',
            'bg-[#fffcf8] px-3 py-2 text-[#2a1812] shadow-[0_12px_32px_rgba(42,24,18,0.14)]',
            'outline-none focus-visible:ring-2 focus-visible:ring-[#c4963a]/60 focus-visible:ring-offset-2',
            '-webkit-tap-highlight-color-transparent',
          )}
        >
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ background: tone.bar }}
          />
          <span
            id={titleId}
            className={cn(
              'ml-1 inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]',
              tone.chip,
            )}
          >
            Saldo
          </span>
          {message.valorDestaque != null ? (
            <span className={cn('truncate font-display text-sm tabular-nums', tone.value)}>
              {fmtCur(message.valorDestaque)}
            </span>
          ) : (
            <span className="truncate text-xs text-[#6b5244]">{message.headline}</span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              className={cn(
                actionBtnClass,
                'hover:border-[#c4963a]/45 hover:bg-[rgba(196,150,58,0.12)] hover:text-[#8d5e22]',
              )}
              aria-label="Travar saldo no cabeçalho"
              title="Travar no topo"
              onClick={e => {
                stop(e)
                onLock()
              }}
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={actionBtnClass}
              aria-label="Expandir saldo do mês"
              title="Expandir"
              onClick={e => expand(e)}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={cn(
                actionBtnClass,
                'hover:border-red-300/50 hover:bg-red-500/10 hover:text-red-700',
              )}
              aria-label="Fechar lembrete de saldo"
              title="Fechar"
              onClick={e => {
                stop(e)
                onDismiss()
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </article>
      ) : (
      <article
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleCardClick()
          }
        }}
        aria-expanded={forecastOpen}
        aria-controls={forecastId}
        className={cn(
          'group relative cursor-pointer overflow-hidden rounded-xl border border-[rgba(42,24,18,0.12)]',
          'bg-[#fffcf8] text-[#2a1812] shadow-[0_18px_48px_rgba(42,24,18,0.16)]',
          'outline-none',
          !isMobile && 'transition-[box-shadow,transform] duration-300 hover:shadow-[0_22px_56px_rgba(42,24,18,0.2)]',
          'focus-visible:ring-2 focus-visible:ring-[#c4963a]/60 focus-visible:ring-offset-2',
          '-webkit-tap-highlight-color-transparent',
        )}
      >
        <SaldoMesInsightAura
          tone={message.tone}
          reveal={forecastOpen ? 1 : 0}
          lite={isMobile}
        />
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: tone.bar }}
        />

        <div className="relative flex items-start justify-between gap-2 px-4 pb-1 pt-3">
          <span
            className={cn(
              'inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
              tone.chip,
            )}
          >
            Saldo do mês
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className={cn(
                actionBtnClass,
                'hover:border-[#c4963a]/45 hover:bg-[rgba(196,150,58,0.12)] hover:text-[#8d5e22]',
              )}
              aria-label="Travar saldo no cabeçalho"
              title="Travar no topo"
              onClick={e => {
                stop(e)
                onLock()
              }}
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={actionBtnClass}
              aria-label="Minimizar saldo do mês"
              title="Minimizar"
              onClick={e => minimize(e)}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={actionBtnClass}
              aria-label="Configurar lembrete de saldo"
              aria-expanded={settingsOpen}
              onClick={e => {
                stop(e)
                setSettingsOpen(open => !open)
              }}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={cn(
                actionBtnClass,
                'hover:border-red-300/50 hover:bg-red-500/10 hover:text-red-700',
              )}
              aria-label="Fechar lembrete de saldo"
              onClick={e => {
                stop(e)
                onDismiss()
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative space-y-2 px-4 pb-4 pt-1">
          <h2 id={titleId} className="font-display text-[1.35rem] leading-tight tracking-[0.03em]">
            {message.headline}
          </h2>

          {message.valorDestaque != null ? (
            <p
              className={cn(
                'font-display text-[1.85rem] leading-none tracking-[0.03em] tabular-nums',
                tone.value,
              )}
              aria-label={
                message.tone === 'sucesso'
                  ? `Previsão de faturamento ${fmtCur(message.valorDestaque)}`
                  : `Falta ${fmtCur(message.valorDestaque)} para fechar o mês`
              }
            >
              {fmtCur(message.valorDestaque)}
            </p>
          ) : null}

          <p className="text-sm leading-snug text-[#6b5244]">{message.detail}</p>

          {!forecastOpen ? (
            <p className="pt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#8a7060]">
              {isMobile
                ? 'Toque para ver os próximos 3 meses'
                : 'Passe o mouse ou clique para ver os próximos 3 meses'}
            </p>
          ) : null}

          {forecastOpen ? (
            <div id={forecastId} className="saldo-mes-insight-forecast pt-2">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b5244]">
                Próximos 3 meses
              </p>
              {proximosLoading ? (
                <p className="text-xs text-[#8a7060]">Carregando previsão…</p>
              ) : (
                <ul className="space-y-2" aria-label="Previsão dos próximos três meses">
                  {proximosMeses.map((mes, index) => (
                    <ForecastRow
                      key={mes.label}
                      mes={mes}
                      index={index}
                      styles={tone}
                      animate={!isMobile}
                    />
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div id={forecastId} className="hidden" aria-hidden />
          )}

          <button
            type="button"
            className={cn(
              'mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]',
              'text-[#8d5e22] transition-colors hover:text-[#6b4520]',
            )}
            onClick={e => {
              stop(e)
              goDashboard()
            }}
          >
            Abrir dashboard
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>

          {settingsOpen ? (
            <div
              className="mt-2 space-y-3 rounded-lg border border-[rgba(42,24,18,0.10)] bg-[rgba(42,24,18,0.03)] p-3"
              onClick={stop}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b5244]">
                Frequência do lembrete
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="saldo-insight-interval" className="text-[10px] text-[#6b5244]">
                    A cada (min)
                  </Label>
                  <Input
                    id="saldo-insight-interval"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={intervalMin}
                    onChange={e => setIntervalMin(Number(e.target.value) || 1)}
                    className="h-8 bg-[#fffcf8]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="saldo-insight-duration" className="text-[10px] text-[#6b5244]">
                    Fica (seg)
                  </Label>
                  <Input
                    id="saldo-insight-duration"
                    type="number"
                    min={2}
                    max={60}
                    step={1}
                    value={durationSec}
                    onChange={e => setDurationSec(Number(e.target.value) || 2)}
                    className="h-8 bg-[#fffcf8]"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#6b5244]">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e => setEnabled(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[rgba(42,24,18,0.25)]"
                />
                Mostrar lembrete automaticamente
              </label>
              <Button type="button" size="sm" className="w-full" onClick={saveSettings}>
                Salvar ajustes
              </Button>
            </div>
          ) : null}
        </div>
      </article>
      )}
    </aside>,
    document.body,
  )
}
