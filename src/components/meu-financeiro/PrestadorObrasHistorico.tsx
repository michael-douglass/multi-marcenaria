import { Clock, CheckCircle2, HardHat, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PRESTADOR_MONTHS_FULL, PRESTADOR_MONTHS_SHORT } from '@/lib/prestador-financeiro'
import { fmtCur, fmtDate } from '@/lib/utils'
import type { PrestadorFinanceiroItem } from '@/types'

interface PrestadorObrasHistoricoProps {
  titulo: string
  subtitulo: string
  itens: PrestadorFinanceiroItem[]
  variant: 'receber' | 'recebidas'
  emptyMessage: string
  mes: number
  ano: number
  onMesChange: (mes: number) => void
  loading?: boolean
}

function statusLabel(item: PrestadorFinanceiroItem): string {
  if (item.tipo === 'previsto') return 'Previsto'
  if (item.status === 'pago') return 'Pago'
  if (item.status === 'pendente') return 'Pendente'
  return item.status
}

export function PrestadorObrasHistorico({
  titulo,
  subtitulo,
  itens,
  variant,
  emptyMessage,
  mes,
  ano,
  onMesChange,
  loading = false,
}: PrestadorObrasHistoricoProps) {
  const isReceber = variant === 'receber'
  const accent = isReceber ? '#d4a853' : '#10b981'
  const Icon = isReceber ? Clock : CheckCircle2
  const total = itens.reduce((s, i) => s + Number(i.valor), 0)
  const periodoLabel = `${PRESTADOR_MONTHS_FULL[mes - 1]} ${ano}`

  return (
    <section
      className="prestador-obras-historico flex h-[32rem] flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: isReceber ? 'rgba(212,168,83,0.18)' : 'rgba(16,185,129,0.18)',
        background: 'rgba(15,7,3,0.55)',
        boxShadow: isReceber
          ? '0 12px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(212,168,83,0.08)'
          : '0 12px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(16,185,129,0.08)',
      }}
    >
      <header
        className="shrink-0 flex items-start gap-3 border-b px-4 py-4"
        style={{
          borderColor: isReceber ? 'rgba(212,168,83,0.12)' : 'rgba(16,185,129,0.12)',
          background: isReceber
            ? 'linear-gradient(90deg, rgba(212,168,83,0.1) 0%, transparent 100%)'
            : 'linear-gradient(90deg, rgba(16,185,129,0.1) 0%, transparent 100%)',
        }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `${accent}18`,
            border: `1px solid ${accent}33`,
          }}
        >
          <Icon size={18} style={{ color: accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl tracking-wide" style={{ color: accent }}>
            {titulo}
          </h3>
          <p className="text-[0.72rem] text-[#8a6a55]">{subtitulo}</p>
          <p className="mt-1 text-xs font-semibold text-cream">
            {loading ? (
              <span className="inline-flex items-center gap-1.5 text-[#8a6a55]">
                <Loader2 size={12} className="animate-spin" />
                Carregando {periodoLabel}…
              </span>
            ) : (
              <>
                {itens.length} obra{itens.length !== 1 ? 's' : ''}
                {' · '}
                <span style={{ color: accent }}>{fmtCur(total)}</span>
              </>
            )}
          </p>
        </div>
      </header>

      {/* Navegação por mês do ano */}
      <div
        className="shrink-0 border-b px-3 py-2.5"
        style={{
          borderColor: isReceber ? 'rgba(212,168,83,0.1)' : 'rgba(16,185,129,0.1)',
          background: 'rgba(0,0,0,0.18)',
        }}
      >
        <p className="mb-2 px-0.5 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-[#6b5544]">
          Mês · {ano}
        </p>
        <div
          className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin"
          role="tablist"
          aria-label={`Meses de ${ano} — ${titulo}`}
        >
          {PRESTADOR_MONTHS_SHORT.map((label, i) => {
            const mesNum = i + 1
            const ativo = mes === mesNum
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={ativo}
                aria-label={PRESTADOR_MONTHS_FULL[i]}
                onClick={() => onMesChange(mesNum)}
                className={[
                  'shrink-0 rounded-lg px-2.5 py-1.5 text-[0.68rem] font-semibold transition-all',
                  ativo ? 'shadow-sm' : 'opacity-70 hover:opacity-100',
                ].join(' ')}
                style={
                  ativo
                    ? {
                        background: `linear-gradient(180deg, ${accent}28 0%, ${accent}12 100%)`,
                        color: accent,
                        border: `1px solid ${accent}55`,
                        boxShadow: `0 0 12px ${accent}22`,
                      }
                    : {
                        background: 'rgba(212,168,83,0.04)',
                        color: '#8a6a55',
                        border: '1px solid rgba(212,168,83,0.1)',
                      }
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Lista com altura fixa e rolagem */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {loading ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[#8a6a55]" aria-label="Carregando obras" />
          </div>
        ) : itens.length === 0 ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center">
            <EmptyState message={emptyMessage} />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {itens.map((item, idx) => (
              <li
                key={`${item.tipo}-${item.obra_id ?? item.conta_pagar_id ?? idx}`}
                className="group flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors hover:border-[rgba(212,168,83,0.28)]"
                style={{
                  borderColor: 'rgba(212,168,83,0.1)',
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
                  <p className="truncate text-sm font-semibold text-cream">{item.cliente_nome}</p>
                  {item.descricao && (
                    <p className="mt-0.5 truncate text-[0.68rem] text-[#8a6a55]">{item.descricao}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide"
                      style={{
                        backgroundColor: `${accent}18`,
                        color: accent,
                        border: `1px solid ${accent}33`,
                      }}
                    >
                      {statusLabel(item)}
                    </span>
                    <span className="text-[0.65rem] text-[#6b5544]">{fmtDate(item.data_referencia)}</span>
                  </div>
                </div>
                <p className="shrink-0 font-mono text-sm font-semibold" style={{ color: accent }}>
                  {fmtCur(item.valor)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
