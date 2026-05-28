import { fmtCur } from '@/lib/utils'
import type { ResumoFinanceiroFornecedor as ResumoFinanceiro } from '@/lib/fornecedor-financeiro'

interface Props {
  resumo: ResumoFinanceiro
  compact?: boolean
}

export function ResumoFinanceiroFornecedor({ resumo, compact }: Props) {
  const items = [
    { label: 'Limite', value: resumo.limite, color: '#d4a853' },
    { label: 'A pagar', value: resumo.aPagar, color: '#f87171' },
    {
      label: 'Disponível',
      value: resumo.disponivel,
      color: resumo.disponivel < 0 ? '#f87171' : '#4ade80',
    },
    { label: 'Caixa fornecedor', value: resumo.caixa, color: '#60a5fa' },
  ]

  return (
    <div
      className={
        compact
          ? 'grid grid-cols-2 gap-2 sm:grid-cols-4'
          : 'grid grid-cols-2 gap-3 sm:grid-cols-4'
      }
    >
      {items.map(item => (
        <div
          key={item.label}
          className="rounded-lg border border-[rgba(212,168,83,0.15)] bg-[rgba(0,0,0,0.2)] px-2.5 py-2"
        >
          <div className="section-label mb-0.5 text-[0.65rem]">{item.label}</div>
          <div
            className="font-display truncate"
            style={{ fontSize: compact ? '0.95rem' : '1.05rem', color: item.color }}
            title={fmtCur(item.value)}
          >
            {fmtCur(item.value)}
          </div>
        </div>
      ))}
    </div>
  )
}
