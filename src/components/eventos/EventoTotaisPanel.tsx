import { formatarMoedaEvento, totalLinhaItem } from '@/lib/evento-helpers'
import type { EventoItem, EventoTotais } from '@/lib/evento-types'
import { cn } from '@/lib/utils'

interface EventoTotaisPanelProps {
  totais: EventoTotais
  itens: EventoItem[]
  className?: string
}

export function EventoTotaisPanel({ totais, itens, className }: EventoTotaisPanelProps) {
  return (
    <div className={cn('flex h-full min-h-[280px] flex-col rounded-xl border border-gold-border bg-[var(--color-surface-card)] p-4', className)}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-gold/80">4 · Totais</p>
      <p className="mt-1 text-sm text-cream-faint">Resumo</p>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-cream-faint">Pessoas</dt>
          <dd className="font-display text-2xl text-gold">{totais.pessoas}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-cream-faint">Itens</dt>
          <dd className="font-display text-2xl text-gold">{totais.itens}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-cream-faint">Total</dt>
          <dd className="font-display text-xl text-gold">{formatarMoedaEvento(totais.total)}</dd>
        </div>
      </dl>
      <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {itens.length === 0 && (
          <li className="text-sm text-cream-faint">Nada para somar ainda.</li>
        )}
        {itens.map((item) => (
          <li key={item.id} className="rounded-lg border border-gold-border/30 px-3 py-2">
            <p className="truncate text-sm">{item.nome}</p>
            <p className="text-[11px] text-cream-faint">
              {item.quantidade} {item.unidade}
              {item.fornecedor ? ` · ${item.fornecedor}` : ''}
            </p>
            <p className="text-xs text-gold">
              {formatarMoedaEvento(totalLinhaItem(item))} · {formatarMoedaEvento(item.preco_unitario)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
