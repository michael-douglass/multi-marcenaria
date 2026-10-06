import { formatBRL } from '@/lib/orcamentos-ia/pricing'
import type { PriceAuditorRow } from '@/lib/orcamentos-ia/observability'

interface PriceAuditorPanelProps {
  rows: PriceAuditorRow[]
  materialsTotal: number
  salePrice: number
  formulaLabel: string
}

export function PriceAuditorPanel({
  rows,
  materialsTotal,
  salePrice,
  formulaLabel,
}: PriceAuditorPanelProps) {
  if (!rows.length) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        Nenhum item BOM para auditar. Rode o desmonte ou reprocesse o PDF.
      </p>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#0066FF]">
          Auditor de preço
        </p>
        <p className="text-[11px] text-muted-foreground">{formulaLabel}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="border-b text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-1.5 font-medium">Item</th>
              <th className="px-2 py-1.5 font-medium">Cat.</th>
              <th className="px-2 py-1.5 font-medium text-right">Qtd</th>
              <th className="px-2 py-1.5 font-medium text-right">Unit.</th>
              <th className="px-2 py-1.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.item}-${i}`} className="border-b border-border/60">
                <td className="max-w-[140px] truncate px-2 py-1" title={row.item}>
                  {row.item}
                </td>
                <td className="px-2 py-1 text-muted-foreground">{row.category}</td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {row.quantity} {row.unit}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">{formatBRL(row.unitCost)}</td>
                <td className="px-2 py-1 text-right tabular-nums font-medium">
                  {formatBRL(row.totalCost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-[#0f1419] px-3 py-2 text-white">
        <div>
          <p className="text-[10px] text-white/60">Materiais (BOM)</p>
          <p className="text-sm font-semibold tabular-nums">{formatBRL(materialsTotal)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#7eb6ff]">Venda</p>
          <p className="text-sm font-semibold tabular-nums text-[#0066FF]">{formatBRL(salePrice)}</p>
        </div>
      </div>
    </div>
  )
}
