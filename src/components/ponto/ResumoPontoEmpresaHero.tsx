import { formatMinutosHoraExtra } from '@/lib/funcionario-ponto'
import type { PontoResumoEmpresa } from '@/types'

interface ResumoPontoEmpresaHeroProps {
  empresa: PontoResumoEmpresa
  periodoLabel: string
  intervaloLabel: string
  /** Quando true, a lista está filtrada só com quem tem falta. */
  filtroFaltasAtivo?: boolean
  onToggleFiltroFaltas?: () => void
}

export function ResumoPontoEmpresaHero({
  empresa,
  periodoLabel,
  intervaloLabel,
  filtroFaltasAtivo = false,
  onToggleFiltroFaltas,
}: ResumoPontoEmpresaHeroProps) {
  const clicavel = Boolean(onToggleFiltroFaltas)

  return (
    <section
      className="resumo-ponto-hero relative overflow-hidden rounded-2xl border border-[rgba(212,168,83,0.35)] bg-gradient-to-br from-[rgba(56,28,12,0.95)] via-[rgba(36,16,8,0.92)] to-[rgba(20,10,4,0.98)] px-6 py-7 shadow-mogno-lg sm:px-8"
      aria-label="Total de hora extra da empresa"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[rgba(242,216,146,0.08)] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f2d892] to-transparent opacity-70"
        aria-hidden
      />

      <p className="section-label text-[#d4a853]">Empresa · {periodoLabel}</p>
      <h2 className="font-display mt-1 text-2xl tracking-wide text-[#f2d892] sm:text-3xl">
        Hora extra total
      </h2>
      <p className="mt-1 text-sm text-[#b8957f]">{intervaloLabel}</p>

      <p className="font-display mt-5 text-4xl tabular-nums tracking-tight text-[#f7e7be] sm:text-5xl">
        {formatMinutosHoraExtra(empresa.hora_extra_minutos)}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!clicavel}
          aria-pressed={filtroFaltasAtivo}
          onClick={onToggleFiltroFaltas}
          className={`rounded-lg border px-3 py-1.5 text-sm transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-x-[0.97] active:scale-y-[1.04] ${
            filtroFaltasAtivo
              ? 'border-red-500/50 bg-red-500/20 text-red-200 ring-1 ring-red-500/30'
              : 'border-[rgba(212,168,83,0.3)] bg-[rgba(201,160,69,0.12)] text-[#f2d892] hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200'
          } ${clicavel ? 'cursor-pointer' : 'cursor-default'}`}
          title={
            filtroFaltasAtivo
              ? 'Clique para ver toda a equipe'
              : 'Clique para ver só quem tem falta'
          }
        >
          {empresa.faltas_total} falta{empresa.faltas_total === 1 ? '' : 's'} no período
        </button>
      </div>
    </section>
  )
}
