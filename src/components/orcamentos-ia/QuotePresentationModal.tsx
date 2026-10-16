import { useEffect, useMemo, useState } from 'react'
import { Download, FileImage, FileText, Loader2, Printer, RotateCcw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { OrcamentosIaShaderBackdrop } from '@/components/orcamentos-ia/OrcamentosIaShaderBackdrop'
import { QuotePresentationPreview } from '@/components/orcamentos-ia/QuotePresentationPreview'
import {
  buildQuotePresentationLayout,
  clonePresentationLayout,
  type QuotePresentationLayout,
} from '@/lib/orcamentos-ia/quote-presentation'
import {
  downloadQuotePresentationExport,
  type QuotePresentationExportFormat,
} from '@/lib/orcamentos-ia/quote-presentation-export'
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
  const [exporting, setExporting] = useState<QuotePresentationExportFormat | 'print' | null>(
    null,
  )

  useEffect(() => {
    if (!open) return
    setDraft(clonePresentationLayout(baseLayout))
  }, [open, baseLayout])

  const handleExport = async (format: QuotePresentationExportFormat) => {
    if (exporting) return
    setExporting(format)
    const label = format === 'pdf' ? 'PDF' : 'JPG'
    toast.message(`Gerando ${label}…`)
    try {
      await downloadQuotePresentationExport(draft, format)
      toast.success(`${label} baixado.`)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Não foi possível gerar o ${label}. Tente de novo.`,
      )
    } finally {
      setExporting(null)
    }
  }

  const handlePrint = () => {
    if (exporting) return
    try {
      setExporting('print')
      openQuotePresentationPrint(draft)
      toast.message('Abrindo a proposta para imprimir…')
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Não foi possível abrir a impressão. Permita pop-ups ou tente de novo.',
      )
    } finally {
      setExporting(null)
    }
  }

  const handleReset = () => {
    setDraft(clonePresentationLayout(baseLayout))
    toast.message('Nomes, valores e fotos restaurados da cotação.')
  }

  const busy = exporting != null

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
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleReset}
            disabled={busy}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-[#0066FF] hover:bg-[#0052cc]"
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {exporting === 'pdf'
                  ? 'Gerando PDF…'
                  : exporting === 'jpg'
                    ? 'Gerando JPG…'
                    : 'Exportar'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                disabled={busy}
                onSelect={() => void handleExport('pdf')}
              >
                <FileText className="h-4 w-4 text-[#0066FF]" />
                Baixar PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                disabled={busy}
                onSelect={() => void handleExport('jpg')}
              >
                <FileImage className="h-4 w-4 text-[#0066FF]" />
                Baixar JPG
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                disabled={busy}
                onSelect={handlePrint}
              >
                <Printer className="h-4 w-4" />
                Imprimir…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
