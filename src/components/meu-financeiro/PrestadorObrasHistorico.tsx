import { Clock, CheckCircle2, HardHat } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { fmtCur, fmtDate } from '@/lib/utils'
import type { PrestadorFinanceiroItem } from '@/types'

interface PrestadorObrasHistoricoProps {
  titulo: string
  subtitulo: string
  itens: PrestadorFinanceiroItem[]
  variant: 'receber' | 'recebidas'
  emptyMessage: string
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
}: PrestadorObrasHistoricoProps) {
  const isReceber = variant === 'receber'
  const accent = isReceber ? '#d4a853' : '#10b981'
  const Icon = isReceber ? Clock : CheckCircle2

  return (
    <section
      className="prestador-obras-historico flex flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: isReceber ? 'rgba(212,168,83,0.18)' : 'rgba(16,185,129,0.18)',
        background: 'rgba(15,7,3,0.55)',
      }}
    >
      <header
        className="flex items-start gap-3 border-b px-4 py-4"
        style={{
          borderColor: isReceber ? 'rgba(212,168,83,0.12)' : 'rgba(16,185,129,0.12)',
          background: isReceber
            ? 'linear-gradient(90deg, rgba(212,168,83,0.08) 0%, transparent 100%)'
            : 'linear-gradient(90deg, rgba(16,185,129,0.08) 0%, transparent 100%)',
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
        <div className="min-w-0">
          <h3 className="font-display text-xl tracking-wide" style={{ color: accent }}>
            {titulo}
          </h3>
          <p className="text-[0.72rem] text-[#8a6a55]">{subtitulo}</p>
          <p className="mt-1 text-xs font-semibold text-cream">
            {itens.length} obra{itens.length !== 1 ? 's' : ''}
            {' · '}
            <span style={{ color: accent }}>{fmtCur(itens.reduce((s, i) => s + Number(i.valor), 0))}</span>
          </p>
        </div>
      </header>

      <div className="max-h-[420px] overflow-y-auto p-3">
        {itens.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <ul className="flex flex-col gap-2">
            {itens.map((item, idx) => (
              <li
                key={`${item.tipo}-${item.obra_id ?? item.conta_pagar_id ?? idx}`}
                className="group flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors hover:border-[rgba(212,168,83,0.28)]"
                style={{
                  borderColor: 'rgba(212,168,83,0.1)',
                  background: 'rgba(0,0,0,0.22)',
                  animationDelay: `${idx * 40}ms`,
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
