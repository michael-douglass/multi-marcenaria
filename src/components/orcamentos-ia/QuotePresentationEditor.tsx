import { useMemo, useRef, useState } from 'react'
import { ImagePlus, Split, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type {
  QuotePageImage,
  QuotePresentationLayout,
} from '@/lib/orcamentos-ia/quote-presentation'
import {
  computeLaborProfitExtra,
  distributeExtraOntoSalePrices,
  formatBRL,
  recomputePresentationTotals,
} from '@/lib/orcamentos-ia/quote-presentation'
import { toast } from 'sonner'

interface QuotePresentationEditorProps {
  draft: QuotePresentationLayout
  /** Layout de partida (antes da distribuição de mão de obra/lucro). */
  baseline: QuotePresentationLayout
  onChange: (next: QuotePresentationLayout) => void
  pageImages: QuotePageImage[]
  laborCost: number
  profitPercent: number
  onLaborCostChange: (value: number) => void
  onProfitPercentChange: (value: number) => void
}

type ImageTarget =
  | { kind: 'env'; envId: string }
  | { kind: 'mod'; envId: string; modId: string }

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

export function QuotePresentationEditor({
  draft,
  baseline,
  onChange,
  pageImages,
  laborCost,
  profitPercent,
  onLaborCostChange,
  onProfitPercentChange,
}: QuotePresentationEditorProps) {
  const [pickerFor, setPickerFor] = useState<ImageTarget | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const laborExtra = useMemo(
    () =>
      computeLaborProfitExtra(draft.pricing.materialsCost, laborCost, profitPercent),
    [draft.pricing.materialsCost, laborCost, profitPercent],
  )

  const handleDistribute = () => {
    if (!(laborExtra.totalExtra > 0)) {
      toast.message('Informe mão de obra e/ou lucro % para gerar um valor a distribuir.')
      return
    }
    const next = distributeExtraOntoSalePrices(baseline, laborExtra.totalExtra, draft)
    onChange(next)
    toast.success(
      `${formatBRL(laborExtra.totalExtra)} distribuídos nos preços de venda (proporcional aos materiais).`,
    )
  }

  const applyImage = (url: string) => {
    if (!pickerFor) return
    let next = { ...draft, environments: draft.environments.map((env) => ({ ...env, modules: [...env.modules] })) }
    if (pickerFor.kind === 'env') {
      next.environments = next.environments.map((env) =>
        env.id === pickerFor.envId ? { ...env, imageUrl: url } : env,
      )
    } else {
      next.environments = next.environments.map((env) => {
        if (env.id !== pickerFor.envId) return env
        return {
          ...env,
          modules: env.modules.map((m) =>
            m.id === pickerFor.modId ? { ...m, imageUrl: url } : m,
          ),
        }
      })
    }
    onChange(next)
    setPickerFor(null)
  }

  const updateModuleMoney = (
    envId: string,
    modId: string,
    field: 'salePrice' | 'materialsCost',
    raw: string,
  ) => {
    const value = Number(String(raw).replace(',', '.'))
    const safe = Number.isFinite(value) && value >= 0 ? value : 0
    const nextEnvs = draft.environments.map((env) => {
      if (env.id !== envId) return env
      return {
        ...env,
        modules: env.modules.map((m) =>
          m.id === modId ? { ...m, [field]: safe } : m,
        ),
      }
    })
    onChange(recomputePresentationTotals({ ...draft, environments: nextEnvs }))
  }

  const openUpload = (target: ImageTarget) => {
    setPickerFor(target)
    queueMicrotask(() => fileRef.current?.click())
  }

  return (
    <div className="space-y-4" style={{ fontFamily: 'Raleway, sans-serif' }}>
      <div>
        <h3 className="text-sm font-semibold text-[#0f1419]">Revisar antes de imprimir</h3>
        <p className="mt-0.5 text-xs text-slate-600">
          Confira as fotos, troque se precisar e ajuste os valores de cada móvel. A prévia ao lado
          atualiza na hora.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file || !pickerFor) return
          void readFileAsDataUrl(file).then(applyImage).catch(() => setPickerFor(null))
        }}
      />

      {draft.environments.map((env) => (
        <section
          key={env.id}
          className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[#0f1419]">{env.name}</p>
              <p className="text-[11px] text-slate-500">
                Ambiente · venda {env.salePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="mb-3 overflow-hidden rounded-lg border border-[#0066FF]/25 bg-slate-50">
            {env.imageUrl ? (
              <img src={env.imageUrl} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-36 items-center justify-center text-xs font-semibold uppercase tracking-wider text-[#0066FF]">
                Sem foto do ambiente
              </div>
            )}
            <div className="flex flex-wrap gap-2 border-t border-slate-200 p-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => setPickerFor({ kind: 'env', envId: env.id })}
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Escolher página
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => openUpload({ kind: 'env', envId: env.id })}
              >
                <Upload className="h-3.5 w-3.5" />
                Enviar foto
              </Button>
            </div>
          </div>

          {pickerFor?.kind === 'env' && pickerFor.envId === env.id && (
            <ImagePickerGrid
              pageImages={pageImages}
              onPick={applyImage}
              onCancel={() => setPickerFor(null)}
            />
          )}

          <div className="space-y-3">
            {env.modules.map((mod) => {
              const picking =
                pickerFor?.kind === 'mod' &&
                pickerFor.envId === env.id &&
                pickerFor.modId === mod.id
              return (
                <article
                  key={mod.id}
                  className="rounded-lg border border-slate-200 bg-[#fafaf8] p-2.5"
                >
                  <div className="grid grid-cols-[96px_1fr] gap-2.5 sm:grid-cols-[112px_1fr]">
                    <div className="overflow-hidden rounded-md border border-[#0066FF]/20 bg-white">
                      {mod.imageUrl ? (
                        <img src={mod.imageUrl} alt="" className="h-24 w-full object-cover" />
                      ) : (
                        <div className="flex h-24 items-center justify-center text-[10px] font-semibold uppercase text-[#0066FF]">
                          Foto
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div>
                        <p className="truncate text-sm font-semibold text-[#0f1419]">{mod.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {mod.dimensionsLabel || 'Móvel sob medida'}
                          {mod.pageNumber != null ? ` · pág. ${mod.pageNumber}` : ''}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-0.5 text-[10px] text-slate-500">
                          Venda (R$)
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 text-xs"
                            value={mod.salePrice}
                            onChange={(e) =>
                              updateModuleMoney(env.id, mod.id, 'salePrice', e.target.value)
                            }
                          />
                        </label>
                        <label className="space-y-0.5 text-[10px] text-slate-500">
                          Materiais (R$)
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-8 text-xs"
                            value={mod.materialsCost}
                            onChange={(e) =>
                              updateModuleMoney(env.id, mod.id, 'materialsCost', e.target.value)
                            }
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() =>
                            setPickerFor({ kind: 'mod', envId: env.id, modId: mod.id })
                          }
                        >
                          <ImagePlus className="h-3 w-3" />
                          Trocar foto
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-[11px]"
                          onClick={() =>
                            openUpload({ kind: 'mod', envId: env.id, modId: mod.id })
                          }
                        >
                          <Upload className="h-3 w-3" />
                          Enviar
                        </Button>
                      </div>
                    </div>
                  </div>
                  {picking && (
                    <div className="mt-2">
                      <ImagePickerGrid
                        pageImages={pageImages}
                        onPick={applyImage}
                        onCancel={() => setPickerFor(null)}
                      />
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      ))}

      <section className="sticky bottom-0 z-[2] rounded-xl border border-[#0066FF]/30 bg-[#f5f8ff] p-3 shadow-md">
        <h3 className="text-sm font-semibold text-[#0f1419]">Mão de obra e lucro</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
          Só para o seu cálculo — <strong>não aparece no PDF</strong>. Informe os valores e clique em
          distribuir para embutir a soma nos preços de venda dos móveis.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="space-y-0.5 text-[10px] text-slate-500">
            Mão de obra (R$)
            <Input
              type="number"
              step="0.01"
              min="0"
              className="h-9 bg-white text-xs"
              value={laborCost || ''}
              placeholder="0"
              onChange={(e) => {
                const n = Number(String(e.target.value).replace(',', '.'))
                onLaborCostChange(Number.isFinite(n) && n >= 0 ? n : 0)
              }}
            />
          </label>
          <label className="space-y-0.5 text-[10px] text-slate-500">
            Lucro (%)
            <Input
              type="number"
              step="0.1"
              min="0"
              max="95"
              className="h-9 bg-white text-xs"
              value={profitPercent || ''}
              placeholder="0"
              onChange={(e) => {
                const n = Number(String(e.target.value).replace(',', '.'))
                onProfitPercentChange(Number.isFinite(n) && n >= 0 ? n : 0)
              }}
            />
          </label>
        </div>
        <div className="mt-2 space-y-0.5 rounded-lg border border-white/80 bg-white/80 px-2.5 py-2 text-[11px] text-slate-600">
          <p>
            Base (materiais + mão de obra):{' '}
            <span className="font-semibold tabular-nums text-[#0f1419]">
              {formatBRL(laborExtra.costBase)}
            </span>
          </p>
          <p>
            Lucro calculado:{' '}
            <span className="font-semibold tabular-nums text-[#0f1419]">
              {formatBRL(laborExtra.profitValue)}
            </span>
          </p>
          <p>
            Soma a distribuir:{' '}
            <span className="font-semibold tabular-nums text-[#0066FF]">
              {formatBRL(laborExtra.totalExtra)}
            </span>
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-2 w-full gap-1.5 bg-[#0066FF] hover:bg-[#0052cc]"
          onClick={handleDistribute}
        >
          <Split className="h-3.5 w-3.5" />
          Distribuir no preço final
        </Button>
      </section>
    </div>
  )
}

function ImagePickerGrid({
  pageImages,
  onPick,
  onCancel,
}: {
  pageImages: QuotePageImage[]
  onPick: (url: string) => void
  onCancel: () => void
}) {
  if (!pageImages.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
        Nenhuma página do PDF disponível. Use “Enviar foto”.
        <Button type="button" size="sm" variant="ghost" className="ml-2 h-7" onClick={onCancel}>
          Fechar
        </Button>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-[#0066FF]/25 bg-[#f5f8ff] p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-[#0066FF]">Escolha uma página do projeto</p>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
          Fechar
        </Button>
      </div>
      <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
        {pageImages.map((page) => (
          <button
            key={page.path}
            type="button"
            onClick={() => onPick(page.url)}
            className={cn(
              'overflow-hidden rounded-md border border-slate-200 bg-white transition',
              'hover:border-[#0066FF] hover:ring-2 hover:ring-[#0066FF]/30',
            )}
            title={`Página ${page.index}`}
          >
            <img src={page.url} alt="" className="aspect-[4/3] w-full object-cover" />
            <span className="block px-1 py-0.5 text-center text-[10px] text-slate-600">
              pág. {page.index}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
