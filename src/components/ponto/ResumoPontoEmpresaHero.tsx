import { formatMinutosHoraExtra } from '@/lib/funcionario-ponto'
import type { PontoResumoEmpresa } from '@/types'

interface ResumoPontoEmpresaHeroProps {
  empresa: PontoResumoEmpresa
  periodoLabel: string
  intervaloLabel: string
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
      className="resumo-ponto-hero relative overflow-hidden rounded-2xl border border-[rgba(26,16,12,0.12)] bg-[#fffaf4]/95 px-6 py-7 shadow-[0_14px_36px_rgba(42,24,18,0.07)] sm:px-8"
      aria-label="Total de hora extra da empresa"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#f2d892] via-[#6b3f12] to-[#2a1812]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[rgba(242,216,146,0.22)] blur-3xl"
        aria-hidden
      />

      <p className="section-label text-[#6b3f12]">Empresa · {periodoLabel}</p>
      <h2 className="font-display mt-1 text-2xl tracking-wide text-[#1a100c] sm:text-3xl">
        Hora extra total
      </h2>
      <p className="mt-1 text-sm text-[#6b5244]">{intervaloLabel}</p>

      <p className="font-display mt-5 text-4xl tabular-nums tracking-tight text-[#6b3f12] sm:text-5xl">
        {formatMinutosHoraExtra(empresa.hora_extra_minutos)}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!clicavel}
          aria-pressed={filtroFaltasAtivo}
          onClick={onToggleFiltroFaltas}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-x-[0.97] active:scale-y-[1.04] ${
            filtroFaltasAtivo
              ? 'border-[#9f1239]/45 bg-[#fde8ec] text-[#9f1239] ring-1 ring-[#9f1239]/20'
              : 'border-[rgba(26,16,12,0.16)] bg-white text-[#6b3f12] hover:border-[#9f1239]/35 hover:bg-[#fff5f7] hover:text-[#9f1239]'
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
