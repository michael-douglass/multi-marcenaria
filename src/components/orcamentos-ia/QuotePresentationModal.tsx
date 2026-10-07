import { useEffect, useMemo, useState } from 'react'
import { Printer, RotateCcw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { OrcamentosIaShaderBackdrop } from '@/components/orcamentos-ia/OrcamentosIaShaderBackdrop'
import { QuotePresentationPreview } from '@/components/orcamentos-ia/QuotePresentationPreview'
import { QuotePresentationEditor } from '@/components/orcamentos-ia/QuotePresentationEditor'
import {
  buildQuotePresentationLayout,
  clonePresentationLayout,
  type QuotePresentationLayout,
} from '@/lib/orcamentos-ia/quote-presentation'
import { openQuotePresentationPrint } from '@/lib/orcamentos-ia/quote-presentation-print'
import type { QuoteAnalysisDetail } from '@/lib/orcamentos-ia/quote-tree'
import type { PricingParams } from '@/lib/orcamentos-ia/pricing'
import { toast } from 'sonner'

interface QuotePresentationModalProps {
  open: boolean
  onClose: () => void
  tree: QuoteAnalysisDetail
  pricingParams: PricingParams
  pageImages: Array<{ index: number; path: string; url: string }>
  branding: {
    companyName: string
    logoUrl?: string | null
    cnpj?: string | null
    razaoSocial?: string | null
  }
}

export function QuotePresentationModal({
  open,
  onClose,
  tree,
  pricingParams,
  pageImages,
  branding,
}: QuotePresentationModalProps) {
  const baseLayout = useMemo(
    () =>
      buildQuotePresentationLayout({
        tree,
        pricingParams,
        pageImages,
        branding,
      }),
    [tree, pricingParams, pageImages, branding],
  )

  const [draft, setDraft] = useState<QuotePresentationLayout>(() =>
    clonePresentationLayout(baseLayout),
  )
  /** Preços de partida para redistribuir mão de obra/lucro sem dobrar. */
  const [baseline, setBaseline] = useState<QuotePresentationLayout>(() =>
    clonePresentationLayout(baseLayout),
  )
  const [laborCost, setLaborCost] = useState(0)
  const [profitPercent, setProfitPercent] = useState(0)

  useEffect(() => {
    if (!open) return
    const cloned = clonePresentationLayout(baseLayout)
    setDraft(cloned)
    setBaseline(clonePresentationLayout(baseLayout))
    setLaborCost(0)
    setProfitPercent(0)
  }, [open, baseLayout])

  const handlePrint = () => {
    try {
      openQuotePresentationPrint(draft)
      toast.message('Abrindo a proposta para imprimir ou salvar PDF…')
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Não foi possível abrir a impressão. Permita pop-ups ou tente de novo.',
      )
    }
  }

  const handleReset = () => {
    const cloned = clonePresentationLayout(baseLayout)
    setDraft(cloned)
    setBaseline(clonePresentationLayout(baseLayout))
    setLaborCost(0)
    setProfitPercent(0)
    toast.message('Valores e fotos restaurados da cotação.')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Proposta apresentável"
      extraWide
      tall
      closeOnBackdrop={false}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-[#0066FF] hover:bg-[#0052cc]"
            onClick={handlePrint}
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      }
    >
      <div className="relative -mx-1 min-h-[70vh] overflow-hidden rounded-xl border border-slate-200/80">
        <div className="pointer-events-none absolute inset-0 opacity-35">
          <OrcamentosIaShaderBackdrop />
        </div>
        <div className="relative z-[1] grid gap-3 p-2 sm:p-3 lg:grid-cols-[minmax(280px,380px)_1fr]">
          <div className="max-h-[72vh] overflow-y-auto rounded-xl border border-white/70 bg-white/85 p-2 shadow-sm backdrop-blur-sm">
            <QuotePresentationEditor
              draft={draft}
              baseline={baseline}
              onChange={setDraft}
              pageImages={pageImages}
              laborCost={laborCost}
              profitPercent={profitPercent}
              onLaborCostChange={setLaborCost}
              onProfitPercentChange={setProfitPercent}
            />
          </div>
          <div className="min-w-0">
            <p
              className="mb-2 px-1 text-xs text-slate-600"
              style={{ fontFamily: 'Raleway, sans-serif' }}
            >
              Prévia idêntica ao PDF. Ajuste fotos e valores à esquerda; depois use “Imprimir / Salvar
              PDF”.
            </p>
            <QuotePresentationPreview layout={draft} />
          </div>
        </div>
      </div>
    </Modal>
  )
}
