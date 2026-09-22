import { useId, type MouseEvent } from 'react'
import { Unlock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SaldoMesInsightAura } from '@/components/dashboard/SaldoMesInsightAura'
import { useSaldoMesInsightOptional } from '@/context/SaldoMesInsightContext'
import { cn, fmtCur } from '@/lib/utils'
import type { SaldoMesInsightMessage } from '@/lib/saldo-mes-insight'

const TONE_BAR: Record<SaldoMesInsightMessage['tone'], string> = {
  sucesso: 'linear-gradient(180deg, #34d399 0%, rgba(52,211,153,0.2) 100%)',
  quase: 'linear-gradient(180deg, #f2d892 0%, rgba(242,216,146,0.2) 100%)',
  falta: 'linear-gradient(180deg, #fb923c 0%, rgba(251,146,60,0.2) 100%)',
  alerta: 'linear-gradient(180deg, #f87171 0%, rgba(248,113,113,0.2) 100%)',
}

const TONE_VALUE: Record<SaldoMesInsightMessage['tone'], string> = {
  sucesso: 'text-[#86efac]',
  quase: 'text-[#f5e0a8]',
  falta: 'text-[#fdba74]',
  alerta: 'text-[#fca5a5]',
}

/**
 * Chip compacto no NavigationHeader enquanto o saldo está travado.
 * Visual madeira/ouro do cabeçalho + aura (shader leve / CSS no mobile).
 * No celular ocupa a faixa central do header para não ser esmagado.
 */
export function SaldoMesInsightHeaderDock() {
  const ctx = useSaldoMesInsightOptional()
  const navigate = useNavigate()
  const titleId = useId()

  if (!ctx?.enabled || !ctx.locked || !ctx.message) return null

  const { message, isMobile, unlock } = ctx
  const stop = (e: MouseEvent) => e.stopPropagation()

  return (
    <div
      role="status"
      aria-labelledby={titleId}
      className={cn(
        'saldo-mes-header-dock group relative flex h-9 w-full min-w-0 max-w-none items-center gap-1 overflow-hidden sm:gap-2 md:max-w-[18rem]',
        'rounded-lg border border-[rgba(240,210,140,0.34)]',
        'bg-[rgba(28,16,12,0.72)] pl-1.5 pr-0.5 shadow-[0_0_0_1px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.28)] sm:pl-2.5 sm:pr-1',
        'backdrop-blur-sm',
      )}
    >
      <SaldoMesInsightAura tone={message.tone} reveal={1} lite={isMobile} className="opacity-80" />
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-[2px]"
        style={{ background: TONE_BAR[message.tone] }}
      />

      <button
        type="button"
        id={titleId}
        className="relative z-[1] flex min-w-0 flex-1 flex-col items-start text-left outline-none focus-visible:ring-1 focus-visible:ring-[#f2d892]/70"
        title="Abrir dashboard"
        onClick={() => navigate('/dashboard')}
      >
        <span className="truncate text-[7px] font-bold uppercase tracking-[0.12em] text-[#c4a882] sm:text-[8px] sm:tracking-[0.18em]">
          Saldo · travado
        </span>
        <span
          className={cn(
            'w-full truncate font-display leading-none tracking-[0.03em] tabular-nums',
            'text-[0.78rem] sm:text-[0.95rem]',
            TONE_VALUE[message.tone],
          )}
        >
          {message.valorDestaque != null ? fmtCur(message.valorDestaque) : message.headline}
        </span>
      </button>

      <button
        type="button"
        className={cn(
          'relative z-[1] inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          'border border-[rgba(240,210,140,0.28)] bg-[rgba(240,210,140,0.08)] text-[#f2d892]',
          'transition-colors hover:bg-[rgba(240,210,140,0.16)] hover:text-[#f5e0a8]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d892]/50',
        )}
        aria-label="Destravar saldo do mês"
        title="Destravar"
        onClick={e => {
          stop(e)
          unlock()
        }}
      >
        <Unlock className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}
