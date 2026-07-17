import { createPortal } from 'react-dom'
import { X, CheckCircle2, Trash2 } from 'lucide-react'
import { fmtCur, fmtDate } from '@/lib/utils'
import { getValorPagoConta } from '@/lib/contas-pagar-valores'
import type { ContaPagar } from '@/types'

export interface ContasPagarSelecaoPopupProps {
  contas: ContaPagar[]
  totalRestante: number
  processing?: boolean
  pagarCount: number
  onMarcarPago: () => void
  onApagar: () => void
  onLimpar: () => void
  onRemover: (id: string) => void
  resolveNome: (conta: ContaPagar) => string
}

/**
 * Painel flutuante no canto inferior direito (acima dos botões Agenda/Navegação)
 * com as contas marcadas e o total a pagar.
 */
export function ContasPagarSelecaoPopup({
  contas,
  totalRestante,
  processing = false,
  pagarCount,
  onMarcarPago,
  onApagar,
  onLimpar,
  onRemover,
  resolveNome,
}: ContasPagarSelecaoPopupProps) {
  if (contas.length === 0) return null

  return createPortal(
    <aside
      className="contas-selecao-popup fixed z-[220] flex w-[min(22.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden"
      style={{
        right: '1.5rem',
        bottom: '7.25rem',
        borderRadius: '1rem',
        border: '1px solid rgba(240,210,140,0.42)',
        background:
          'linear-gradient(165deg, rgba(28,12,6,0.97) 0%, rgba(12,5,2,0.98) 55%, rgba(8,3,1,0.99) 100%)',
        boxShadow:
          '0 18px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(242,216,146,0.08), inset 0 1px 0 rgba(242,216,146,0.12)',
      }}
      role="dialog"
      aria-label="Contas selecionadas"
      aria-live="polite"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 11px, rgba(242,216,146,0.35) 11px, rgba(242,216,146,0.35) 12px)',
        }}
      />

      <header className="relative flex items-start justify-between gap-3 border-b border-[rgba(240,210,140,0.18)] px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="section-label mb-1 text-[0.65rem] tracking-[0.28em] text-[rgba(240,210,140,0.7)]">
            Seleção
          </p>
          <h2 className="font-display text-lg leading-none tracking-[0.06em] text-[#f2d892]">
            {contas.length} conta{contas.length !== 1 ? 's' : ''}
          </h2>
        </div>
        <button
          type="button"
          onClick={onLimpar}
          disabled={processing}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(240,210,140,0.35)] text-[#edd9c4] transition-colors hover:border-[rgba(240,210,140,0.7)] hover:bg-[rgba(240,210,140,0.08)] hover:text-[#f2d892]"
          aria-label="Limpar seleção"
          title="Limpar seleção"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <ul className="relative max-h-[min(40vh,16rem)] space-y-0 overflow-y-auto overscroll-contain px-2 py-2">
        {contas.map((conta, index) => {
          const nome = resolveNome(conta)
          const restante = Math.max(0, conta.valor_parcela - getValorPagoConta(conta))
          const paga = conta.status === 'pago'
          return (
            <li
              key={conta.id}
              className="contas-selecao-popup__item group flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[rgba(240,210,140,0.06)]"
              style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#fffaf4]" title={nome}>
                  {nome}
                </p>
                <p className="mt-0.5 text-[0.7rem] text-[#edd9c4]/80">
                  {conta.numero_parcela}/{conta.total_parcelas}
                  {' · '}
                  {fmtDate(conta.data_vencimento)}
                  {paga ? ' · paga' : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className="font-display text-sm tabular-nums tracking-wide"
                  style={{ color: paga ? '#4ade80' : '#f2d892' }}
                >
                  {fmtCur(restante)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemover(conta.id)}
                  disabled={processing}
                  className="text-[0.65rem] uppercase tracking-wider text-[#edd9c4]/50 opacity-0 transition-opacity group-hover:opacity-100 hover:text-[#f87171] focus:opacity-100"
                  aria-label={`Remover ${nome} da seleção`}
                >
                  tirar
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <footer className="relative space-y-3 border-t border-[rgba(240,210,140,0.2)] bg-[rgba(0,0,0,0.25)] px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="section-label text-[0.6rem] tracking-[0.22em] text-[rgba(240,210,140,0.65)]">
              Total restante
            </p>
            <p className="font-display text-2xl leading-none tracking-[0.04em] tabular-nums text-[#f7e7be]">
              {fmtCur(totalRestante)}
            </p>
          </div>
          <p className="pb-0.5 text-right text-[0.7rem] text-[#edd9c4]/70">
            {pagarCount} a quitar
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-success btn-sm flex flex-1 items-center justify-center gap-1.5"
            disabled={processing || pagarCount === 0}
            onClick={onMarcarPago}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Marcar pago
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm flex items-center justify-center gap-1.5"
            disabled={processing}
            onClick={onApagar}
            aria-label="Apagar contas selecionadas"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Apagar
          </button>
        </div>
      </footer>

      <style>{`
        @keyframes contasSelecaoIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes contasSelecaoItemIn {
          from { opacity: 0; transform: translateX(6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .contas-selecao-popup {
          animation: contasSelecaoIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .contas-selecao-popup__item {
          animation: contasSelecaoItemIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .contas-selecao-popup,
          .contas-selecao-popup__item {
            animation: none;
          }
        }
      `}</style>
    </aside>,
    document.body,
  )
}
