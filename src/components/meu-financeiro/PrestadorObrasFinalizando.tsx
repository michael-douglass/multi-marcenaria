import { CalendarClock, HardHat, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PRESTADOR_MONTHS_FULL } from '@/lib/prestador-financeiro'
import { fmtCur } from '@/lib/utils'
import type { MontadorComissaoObra } from '@/lib/metricas-montador-comissao'

const STATUS_LABEL: Record<string, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Em atraso',
  datas_definidas: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

interface PrestadorObrasFinalizandoProps {
  obras: MontadorComissaoObra[]
  mes: number
  ano: number
  loading?: boolean
}

export function PrestadorObrasFinalizando({
  obras,
  mes,
  ano,
  loading = false,
}: PrestadorObrasFinalizandoProps) {
  const accent = '#60a5fa'
  const total = obras.reduce((s, o) => s + o.comissao_valor, 0)
  const periodoLabel = `${PRESTADOR_MONTHS_FULL[mes - 1]} ${ano}`

  return (
    <section
      className="prestador-obras-finalizando flex h-[32rem] flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: 'rgba(96,165,250,0.18)',
        background: 'rgba(68,46,34,0.55)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(96,165,250,0.08)',
      }}
    >
      <header
        className="shrink-0 flex items-start gap-3 border-b px-4 py-4"
        style={{
          borderColor: 'rgba(96,165,250,0.12)',
          background: 'linear-gradient(90deg, rgba(96,165,250,0.1) 0%, transparent 100%)',
        }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `${accent}18`,
            border: `1px solid ${accent}33`,
          }}
        >
          <CalendarClock size={18} style={{ color: accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl tracking-wide" style={{ color: accent }}>
            Obras concluídas
          </h3>
          <p className="text-[0.72rem] text-[#edd9c4]">
            Comissão de obras finalizadas em {periodoLabel}
          </p>
          <p className="mt-1 text-xs font-semibold text-cream">
            {loading ? (
              <span className="inline-flex items-center gap-1.5 text-[#edd9c4]">
                <Loader2 size={12} className="animate-spin" />
                Carregando {periodoLabel}…
              </span>
            ) : (
              <>
                {obras.length} obra{obras.length !== 1 ? 's' : ''}
                {' · '}
                <span style={{ color: accent }}>{fmtCur(total)}</span>
              </>
            )}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {loading ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[#edd9c4]" aria-label="Carregando obras" />
          </div>
        ) : obras.length === 0 ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center">
            <EmptyState message={`Nenhuma obra concluída com comissão em ${periodoLabel}.`} />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {obras.map(obra => (
              <li
                key={obra.obra_id}
                className="group flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors hover:border-[rgba(96,165,250,0.28)]"
                style={{
                  borderColor: 'rgba(240,210,140,0.1)',
                  background: 'rgba(0,0,0,0.22)',
                }}
              >
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${accent}12` }}
                >
                  <HardHat size={14} style={{ color: accent }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-cream">{obra.cliente_nome}</p>
                  <p className="mt-0.5 truncate text-[0.68rem] text-[#edd9c4]">
                    {obra.tipo_obra_nome ?? 'Obra'}
                    {' · '}
                    {STATUS_LABEL[obra.status_kanban] ?? obra.status_kanban}
                  </p>
                  <span
                    className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: `${accent}18`,
                      color: accent,
                      border: `1px solid ${accent}33`,
                    }}
                  >
                    Comissão concluída
                  </span>
                </div>
                <p className="shrink-0 font-mono text-sm font-semibold" style={{ color: accent }}>
                  {fmtCur(obra.comissao_valor)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
