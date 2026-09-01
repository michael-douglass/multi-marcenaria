import { Package } from 'lucide-react'
import { fmtCur } from '@/lib/utils'

interface ObraMarkupCustosToolbarProps {
  totalPedidoAFazer: number
  loading?: boolean
  /** Quando true, a agenda está mostrando só obras com pedido a fazer. */
  filtroPedidosAtivo?: boolean
  /** Clique no total: liga/desliga filtro das obras com pedido a fazer. */
  onPedidoAFazerClick?: () => void
}

/** Total “pedido a fazer” (soma das categorias marcadas em cada card). */
export function ObraMarkupCustosToolbar({
  totalPedidoAFazer,
  loading = false,
  filtroPedidosAtivo = false,
  onPedidoAFazerClick,
}: ObraMarkupCustosToolbarProps) {
  const badgeClass = [
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold text-[#4ade80]',
    filtroPedidosAtivo
      ? 'border-[rgba(74,222,128,0.7)] bg-[rgba(34,197,94,0.28)] ring-1 ring-[rgba(74,222,128,0.4)]'
      : 'border-[rgba(74,222,128,0.38)] bg-[rgba(34,197,94,0.12)]',
    onPedidoAFazerClick
      ? 'cursor-pointer transition-colors hover:bg-[rgba(34,197,94,0.22)]'
      : '',
  ].join(' ')

  const badgeTitle = filtroPedidosAtivo
    ? 'Mostrando só obras com pedido a fazer — clique para ver todas'
    : 'Clique para ver só obras com pedido a fazer'

  const badgeContent = (
    <>
      <Package size={14} className="shrink-0" aria-hidden />
      <span className="whitespace-nowrap">
        Pedido a fazer:{' '}
        {loading ? '…' : fmtCur(totalPedidoAFazer)}
      </span>
    </>
  )

  return (
    <div className="flex flex-col items-start gap-1 min-w-0">
      {onPedidoAFazerClick ? (
        <button
          type="button"
          className={badgeClass}
          onClick={onPedidoAFazerClick}
          title={badgeTitle}
          aria-pressed={filtroPedidosAtivo}
        >
          {badgeContent}
        </button>
      ) : (
        <div
          className={badgeClass}
          title="Soma dos custos marcados em cada card (materiais, serviços e/ou despesas) das obras ativas sem pedido de material feito"
          role="status"
        >
          {badgeContent}
        </div>
      )}
      <p className="m-0 text-[0.58rem] leading-snug text-[var(--color-text-muted)]">
        Em cada card, marque Mat. / Serv. / Desp. — fica salvo no sistema para todos
      </p>
    </div>
  )
}
