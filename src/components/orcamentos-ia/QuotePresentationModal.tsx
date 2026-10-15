import { useEffect, useMemo, useState } from 'react'
import { Printer, RotateCcw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { OrcamentosIaShaderBackdrop } from '@/components/orcamentos-ia/OrcamentosIaShaderBackdrop'
import { QuotePresentationPreview } from '@/components/orcamentos-ia/QuotePresentationPreview'
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

  useEffect(() => {
    if (!open) return
    setDraft(clonePresentationLayout(baseLayout))
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
    setDraft(clonePresentationLayout(baseLayout))
    toast.message('Nomes, valores e fotos restaurados da cotação.')
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
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <OrcamentosIaShaderBackdrop />
        </div>
        <div className="relative z-[1] p-2 sm:p-3">
          <QuotePresentationPreview
            layout={draft}
            onChange={setDraft}
            pageImages={pageImages}
            editable
            className="max-h-[min(78vh,820px)] border-white/70 bg-white/70 shadow-sm backdrop-blur-sm"
          />
        </div>
      </div>
    </Modal>
  )
}
