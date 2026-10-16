import { useMemo } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { QuoteAnalysisDetail } from '@/lib/orcamentos-ia/quote-tree'
import {
  calculateModuleSalePrice,
  calculateQuotePricing,
  countActiveModuleOverrides,
  formatBRL,
  moduleMaterialsCost,
  paramsForModule,
  PRICING_MODALITY_HINT,
  PRICING_MODALITY_LABEL,
  setModulePricingOverride,
  type PricingModality,
  type PricingParams,
} from '@/lib/orcamentos-ia/pricing'

export interface PricingAdjustmentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tree: QuoteAnalysisDetail
  value: PricingParams
  onChange: (next: PricingParams) => void
  /** Dialog aninhado (ex.: dentro da proposta) — z-index maior. */
  nested?: boolean
}

/**
 * Configura margem % ou multiplicador ×N no orçamento inteiro (global)
 * e, se quiser, em cada móvel (local).
 */
export function PricingAdjustmentsDialog({
  open,
  onOpenChange,
  tree,
  value,
  onChange,
  nested = false,
}: PricingAdjustmentsDialogProps) {
  const pricing = useMemo(() => calculateQuotePricing(tree, value), [tree, value])
  const localCount = countActiveModuleOverrides(value)
  const isMargin = value.modality === 'mpc_margin'

  const modules = useMemo(() => {
    const rows: Array<{
      envId: string
      envName: string
      modId: string
      modName: string
      cost: number
      sale: number
      effectiveValue: number
      hasLocal: boolean
    }> = []
    const sheetLoss = value.sheetLossPct ?? 15
    for (const env of tree.environments) {
      for (const mod of env.modules) {
        if (mod.out_of_scope) continue
        const local = paramsForModule(value, mod.id)
        const ov = value.moduleOverrides?.[mod.id]
        const hasLocal = isMargin
          ? typeof ov?.mpcPercent === 'number'
          : typeof ov?.materialMultiplier === 'number'
        rows.push({
          envId: env.id,
          envName: env.name,
          modId: mod.id,
          modName: mod.name,
          cost: moduleMaterialsCost(mod, sheetLoss),
          sale: calculateModuleSalePrice(mod, value),
          effectiveValue: isMargin ? local.mpcPercent : local.materialMultiplier,
          hasLocal,
        })
      }
    }
    return rows
  }, [tree, value, isMargin])

  const setModality = (modality: PricingModality) => {
    onChange({ ...value, modality })
  }

  const setGlobalNumber = (raw: string) => {
    const n = Number(String(raw).replace(',', '.'))
    const safe = Number.isFinite(n) ? n : 0
    if (isMargin) onChange({ ...value, mpcPercent: safe })
    else onChange({ ...value, materialMultiplier: safe })
  }

  const setLocalNumber = (modId: string, raw: string) => {
    const n = Number(String(raw).replace(',', '.'))
    if (!Number.isFinite(n)) return
    onChange(
      setModulePricingOverride(
        value,
        modId,
        isMargin ? { mpcPercent: n } : { materialMultiplier: n },
      ),
    )
  }

  const clearLocal = (modId: string) => {
    const ov = value.moduleOverrides?.[modId]
    if (!ov) return
    if (isMargin) {
      onChange(setModulePricingOverride(value, modId, { mpcPercent: undefined }))
    } else {
      onChange(
        setModulePricingOverride(value, modId, { materialMultiplier: undefined }),
      )
    }
  }

  const clearAllLocal = () => {
    const next = { ...(value.moduleOverrides ?? {}) }
    for (const id of Object.keys(next)) {
      const ov = next[id]
      if (!ov) continue
      if (isMargin) delete ov.mpcPercent
      else delete ov.materialMultiplier
      if (
        typeof ov.mpcPercent !== 'number' &&
        typeof ov.materialMultiplier !== 'number'
      ) {
        delete next[id]
      }
    }
    onChange({ ...value, moduleOverrides: next })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        nested={nested}
        className="max-h-[min(90vh,720px)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4 text-[#0066FF]" />
            Ajustes de preço
          </DialogTitle>
          <DialogDescription className="text-xs">
            Global vale para o orçamento inteiro. Local muda só um móvel (mesma fórmula:
            margem % ou multiplicar custo).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              {(Object.keys(PRICING_MODALITY_LABEL) as PricingModality[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  title={PRICING_MODALITY_HINT[key]}
                  onClick={() => setModality(key)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                    value.modality === key
                      ? 'bg-[#0066FF] text-white'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {PRICING_MODALITY_LABEL[key]}
                </button>
              ))}
            </div>
            <div className="ml-auto rounded-lg border border-[#8d5e22]/25 bg-[#fffcf8] px-3 py-1 text-right">
              <p className="text-[10px] text-[#8a7060]">Total ao vivo</p>
              <p className="text-sm font-semibold tabular-nums text-[#2a1812]">
                {formatBRL(pricing.salePrice)}
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Global
              </h3>
              <span className="text-[10px] text-muted-foreground">
                Todos os móveis sem ajuste local
              </span>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              {isMargin ? 'Margem' : 'Custo ×'}
              <Input
                type="number"
                step={isMargin ? '1' : '0.1'}
                min={0}
                max={isMargin ? 95 : undefined}
                className="h-9 w-24 bg-white"
                value={isMargin ? value.mpcPercent : value.materialMultiplier}
                onChange={(e) => setGlobalNumber(e.target.value)}
              />
              {isMargin ? '%' : null}
            </label>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {isMargin
                ? 'Preço = materiais ÷ (1 − margem%). Ex.: 45% → divide por 0,55.'
                : 'Preço = materiais × fator. Ex.: × 2,5 sobre R$ 1.000 → R$ 2.500.'}
            </p>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Local por móvel
              </h3>
              {localCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={clearAllLocal}
                >
                  Limpar locais ({localCount})
                </Button>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  Opcional — deixe em branco o global
                </span>
              )}
            </div>

            <ScrollArea className="h-[min(42vh,320px)] rounded-xl border border-slate-200">
              <ul className="divide-y divide-slate-100">
                {modules.map((row) => (
                  <li
                    key={row.modId}
                    className={cn(
                      'flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap',
                      row.hasLocal && 'bg-[#0066FF]/[0.04]',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {row.modName}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {row.envName} · materiais {formatBRL(row.cost)}
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      {isMargin ? '%' : '×'}
                      <Input
                        type="number"
                        step={isMargin ? '1' : '0.1'}
                        min={0}
                        max={isMargin ? 95 : undefined}
                        className={cn(
                          'h-8 w-[4.5rem] text-xs',
                          row.hasLocal && 'border-[#0066FF]/50 ring-1 ring-[#0066FF]/20',
                        )}
                        value={row.effectiveValue}
                        onChange={(e) => setLocalNumber(row.modId, e.target.value)}
                        aria-label={
                          isMargin
                            ? `Margem local de ${row.modName}`
                            : `Multiplicador local de ${row.modName}`
                        }
                      />
                    </label>
                    <div className="w-[5.5rem] shrink-0 text-right text-xs font-semibold tabular-nums text-slate-800">
                      {formatBRL(row.sale)}
                    </div>
                    {row.hasLocal ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[10px]"
                        onClick={() => clearLocal(row.modId)}
                      >
                        Global
                      </Button>
                    ) : (
                      <span className="w-12 shrink-0" />
                    )}
                  </li>
                ))}
                {modules.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhum móvel no escopo para ajustar.
                  </li>
                ) : null}
              </ul>
            </ScrollArea>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Botão que abre o dialog de ajustes (com badge se houver locais). */
export function PricingAdjustmentsButton({
  onClick,
  params,
  className,
}: {
  onClick: () => void
  params: PricingParams
  className?: string
}) {
  const n = countActiveModuleOverrides(params)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('gap-1.5', className)}
      onClick={onClick}
      title="Ajustar margem ou multiplicador no orçamento inteiro ou em cada móvel"
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      Ajustes
      {n > 0 ? (
        <Badge
          variant="secondary"
          className="ml-0.5 h-5 min-w-5 justify-center bg-[#0066FF]/12 px-1.5 text-[10px] text-[#0066FF]"
        >
          {n}
        </Badge>
      ) : null}
    </Button>
  )
}
