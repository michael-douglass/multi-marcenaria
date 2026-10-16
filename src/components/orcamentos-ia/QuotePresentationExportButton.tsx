import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuotePresentationModal } from '@/components/orcamentos-ia/QuotePresentationModal'
import type { QuoteAnalysisDetail } from '@/lib/orcamentos-ia/quote-tree'
import type { PricingParams } from '@/lib/orcamentos-ia/pricing'
import type { QuoteProjectRow } from '@/lib/orcamentos-ia/storage'

interface QuotePresentationExportButtonProps {
  tree: QuoteAnalysisDetail
  pricingParams: PricingParams
  onPricingParamsChange?: (next: PricingParams) => void
  pageImages: Array<{ index: number; path: string; url: string }>
  branding: {
    companyName: string
    logoUrl?: string | null
    cnpj?: string | null
    razaoSocial?: string | null
  }
  project?: QuoteProjectRow | null
  companyId?: string
  onProjectChange?: (project: QuoteProjectRow) => void
  disabled?: boolean
}

export function QuotePresentationExportButton({
  tree,
  pricingParams,
  onPricingParamsChange,
  pageImages,
  branding,
  project = null,
  companyId,
  onProjectChange,
  disabled,
}: QuotePresentationExportButtonProps) {
  const [open, setOpen] = useState(false)
  const hasContent = tree.environments.some((e) => e.modules.some((m) => !m.out_of_scope))

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 border-[#0066FF]/35 text-[#0066FF] hover:bg-[#0066FF]/8"
        disabled={disabled || !hasContent}
        onClick={() => setOpen(true)}
        title={hasContent ? 'Exportar proposta em PDF' : 'Sem móveis cotados para exportar'}
      >
        <FileDown className="h-3.5 w-3.5" />
        Exportar proposta
      </Button>
      {open && (
        <QuotePresentationModal
          open={open}
          onClose={() => setOpen(false)}
          tree={tree}
          pricingParams={pricingParams}
          onPricingParamsChange={onPricingParamsChange}
          pageImages={pageImages}
          branding={branding}
          project={project}
          companyId={companyId}
          onProjectChange={onProjectChange}
        />
      )}
    </>
  )
}
