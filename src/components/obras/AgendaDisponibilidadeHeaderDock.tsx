import { useMemo } from 'react'
import { CalendarCheck2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useObras } from '@/hooks/useObras'
import { useApp } from '@/context/AppContext'
import { getPrimeiraDataTotalmenteDisponivel } from '@/lib/obra-disponibilidade'
import { hasObrasMenuAccess } from '@/lib/obra-permissions'
import { cn, fmtDate } from '@/lib/utils'

/**
 * Chip no NavigationHeader: mostra a partir de qual dia a agenda
 * de obras fica totalmente livre (sem nenhuma obra marcada).
 */
export function AgendaDisponibilidadeHeaderDock() {
  const navigate = useNavigate()
  const { roles } = useApp()
  const { data: obras, loading } = useObras()

  const resumo = useMemo(
    () => getPrimeiraDataTotalmenteDisponivel(obras),
    [obras],
  )

  if (!hasObrasMenuAccess(roles)) return null
  if (loading && obras.length === 0) return null

  const dataLabel = fmtDate(resumo.primeiraDataLivre)
  const ultimoLabel = resumo.ultimoDiaComObra
    ? fmtDate(resumo.ultimoDiaComObra)
    : null
  const fullLabel = ultimoLabel
    ? `Totalmente disponível a partir do dia ${dataLabel}. Última obra marcada até ${ultimoLabel}.`
    : `Totalmente disponível a partir do dia ${dataLabel}.`

  return (
    <button
      type="button"
      role="status"
      aria-label={fullLabel}
      title={fullLabel}
      onClick={() => navigate('/agenda-obras?view=calendario')}
      className={cn(
        'agenda-disp-header-dock group relative flex h-9 min-w-0 max-w-[min(100%,22rem)] items-center gap-2 overflow-hidden',
        'rounded-lg border border-[rgba(110,190,140,0.38)]',
        'bg-[linear-gradient(135deg,rgba(22,38,28,0.92)_0%,rgba(28,16,12,0.78)_55%,rgba(36,24,14,0.88)_100%)]',
        'px-2.5 shadow-[0_0_0_1px_rgba(0,0,0,0.22),0_8px_22px_rgba(0,0,0,0.28)]',
        'backdrop-blur-sm transition-[border-color,box-shadow,transform] duration-300',
        'hover:border-[rgba(134,239,172,0.55)] hover:shadow-[0_0_0_1px_rgba(74,222,128,0.18),0_10px_28px_rgba(0,0,0,0.32)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86efac]/45',
        'active:scale-[0.99]',
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_120%_at_8%_50%,rgba(74,222,128,0.16),transparent_58%)] opacity-70"
      />
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[2px] bg-[linear-gradient(180deg,#86efac_0%,rgba(74,222,128,0.25)_100%)]"
      />

      <span
        aria-hidden
        className={cn(
          'relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
          'border border-[rgba(134,239,172,0.28)] bg-[rgba(74,222,128,0.1)] text-[#86efac]',
          'transition-colors group-hover:bg-[rgba(74,222,128,0.16)]',
        )}
      >
        <CalendarCheck2 className="h-3.5 w-3.5" />
      </span>

      <span className="relative z-[1] flex min-w-0 flex-1 flex-col items-start text-left">
        <span className="text-[7px] font-bold uppercase tracking-[0.14em] text-[#9ec9a8] sm:text-[8px] sm:tracking-[0.16em]">
          Totalmente disponível a partir do dia
        </span>
        <span
          className={cn(
            'truncate font-display leading-none tracking-[0.04em] tabular-nums text-[#b8f0c8]',
            'text-[0.82rem] sm:text-[0.92rem]',
          )}
        >
          {dataLabel}
        </span>
      </span>

      <span
        aria-hidden
        className="pointer-events-none absolute -right-4 top-1/2 h-10 w-10 -translate-y-1/2 animate-pulse rounded-full bg-[rgba(74,222,128,0.12)] blur-md motion-reduce:animate-none"
      />
    </button>
  )
}
