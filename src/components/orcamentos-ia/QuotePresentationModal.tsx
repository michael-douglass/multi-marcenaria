import { useEffect, useMemo, useState } from 'react'
import {
  Download,
  FileImage,
  FileText,
  ListOrdered,
  Loader2,
  Presentation,
  Printer,
  RotateCcw,
} from 'lucide-react'
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
import { SendQuotePresentationToSlidesDialog } from '@/components/orcamentos-ia/SendQuotePresentationToSlidesDialog'
import { LinkQuoteProjectToLeadDialog } from '@/components/orcamentos-ia/LinkQuoteProjectToLeadDialog'
import {
  PricingAdjustmentsButton,
  PricingAdjustmentsDialog,
} from '@/components/orcamentos-ia/PricingAdjustmentsDialog'
import {
  buildQuotePresentationLayout,
  clonePresentationLayout,
  type QuotePresentationLayout,
} from '@/lib/orcamentos-ia/quote-presentation'
import {
  downloadQuotePresentationExport,
  type QuotePresentationExportFormat,
} from '@/lib/orcamentos-ia/quote-presentation-export'
import {
  openQuotePresentationPrint,
  type QuotePresentationBodyMode,
} from '@/lib/orcamentos-ia/quote-presentation-print'
import type { QuoteAnalysisDetail } from '@/lib/orcamentos-ia/quote-tree'
import type { PricingParams } from '@/lib/orcamentos-ia/pricing'
import type { QuoteProjectRow } from '@/lib/orcamentos-ia/storage'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface QuotePresentationModalProps {
  open: boolean
  onClose: () => void
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
}

export function QuotePresentationModal({
  open,
  onClose,
  tree,
  pricingParams,
  onPricingParamsChange,
  pageImages,
  branding,
  project = null,
  companyId,
  onProjectChange,
}: QuotePresentationModalProps) {
  const [localPricing, setLocalPricing] = useState<PricingParams>(pricingParams)
  const [pricingAdjustOpen, setPricingAdjustOpen] = useState(false)
  const [viewMode, setViewMode] = useState<QuotePresentationBodyMode>('full')
  const [sendSlidesOpen, setSendSlidesOpen] = useState(false)
  const [linkLeadOpen, setLinkLeadOpen] = useState(false)
  const [linkedProject, setLinkedProject] = useState<QuoteProjectRow | null>(project)

  useEffect(() => {
    if (!open) return
    setLocalPricing(pricingParams)
    setViewMode('full')
    setLinkedProject(project)
  }, [open, pricingParams, project])

  const applyPricing = (next: PricingParams) => {
    setLocalPricing(next)
    onPricingParamsChange?.(next)
  }

  const baseLayout = useMemo(
    () =>
      buildQuotePresentationLayout({
        tree,
        pricingParams: localPricing,
        pageImages,
        branding,
      }),
    [tree, localPricing, pageImages, branding],
  )

  const [draft, setDraft] = useState<QuotePresentationLayout>(() =>
    clonePresentationLayout(baseLayout),
  )
  const [exporting, setExporting] = useState<
    QuotePresentationExportFormat | 'print' | 'print-list' | null
  >(null)

  useEffect(() => {
    if (!open) return
    setDraft(clonePresentationLayout(baseLayout))
  }, [open, baseLayout])

  const leadId = linkedProject?.lead_id ?? null

  const handleExport = async (
    format: QuotePresentationExportFormat,
    mode: QuotePresentationBodyMode = 'full',
  ) => {
    if (exporting) return
    setExporting(format)
    const label =
      mode === 'priceList'
        ? format === 'pdf'
          ? 'lista de preços (PDF)'
          : 'lista de preços (JPG)'
        : format === 'pdf'
          ? 'PDF'
          : 'JPG'
    toast.message(`Gerando ${label}…`)
    try {
      await downloadQuotePresentationExport(draft, format, mode)
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

  const handlePrint = (mode: QuotePresentationBodyMode = 'full') => {
    if (exporting) return
    try {
      setExporting(mode === 'priceList' ? 'print-list' : 'print')
      openQuotePresentationPrint(draft, mode)
      toast.message(
        mode === 'priceList'
          ? 'Abrindo lista de preços para imprimir…'
          : 'Abrindo a proposta para imprimir…',
      )
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
          <div className="flex rounded-md border border-border p-0.5">
            <button
              type="button"
              className={cn(
                'rounded px-2 py-1 text-[11px] font-medium',
                viewMode === 'full' ? 'bg-[#0066FF] text-white' : 'text-muted-foreground',
              )}
              onClick={() => setViewMode('full')}
            >
              Completa
            </button>
            <button
              type="button"
              className={cn(
                'rounded px-2 py-1 text-[11px] font-medium',
                viewMode === 'priceList' ? 'bg-[#0066FF] text-white' : 'text-muted-foreground',
              )}
              onClick={() => setViewMode('priceList')}
            >
              Só preços
            </button>
          </div>
          <PricingAdjustmentsButton
            params={localPricing}
            onClick={() => setPricingAdjustOpen(true)}
          />
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-[#0066FF]/35 text-[#0066FF]"
            disabled={busy}
            onClick={() => {
              if (leadId != null) {
                setSendSlidesOpen(true)
                return
              }
              if (linkedProject && companyId) {
                setLinkLeadOpen(true)
                toast.message('Alinhe um lead à pasta para enviar à apresentação.')
                return
              }
              toast.error('Esta cotação não está numa pasta. Abra pelo hub Orçamentos IA.')
            }}
          >
            <Presentation className="h-3.5 w-3.5" />
            Orçamento do lead
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
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                disabled={busy}
                onSelect={() => void handleExport('pdf', 'full')}
              >
                <FileText className="h-4 w-4 text-[#0066FF]" />
                Baixar PDF completo
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                disabled={busy}
                onSelect={() => void handleExport('jpg', 'full')}
              >
                <FileImage className="h-4 w-4 text-[#0066FF]" />
                Baixar JPG completo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                disabled={busy}
                onSelect={() => void handleExport('pdf', 'priceList')}
              >
                <ListOrdered className="h-4 w-4 text-[#0066FF]" />
                Baixar lista de preços (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                disabled={busy}
                onSelect={() => void handleExport('jpg', 'priceList')}
              >
                <ListOrdered className="h-4 w-4 text-[#0066FF]" />
                Baixar lista de preços (JPG)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                disabled={busy}
                onSelect={() => handlePrint('full')}
              >
                <Printer className="h-4 w-4" />
                Imprimir proposta…
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                disabled={busy}
                onSelect={() => handlePrint('priceList')}
              >
                <Printer className="h-4 w-4" />
                Imprimir lista de preços…
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
            viewMode={viewMode}
            className="max-h-[min(78vh,820px)] border-white/70 bg-white/70 shadow-sm backdrop-blur-sm"
          />
        </div>
      </div>

      <PricingAdjustmentsDialog
        open={pricingAdjustOpen}
        onOpenChange={setPricingAdjustOpen}
        tree={tree}
        value={localPricing}
        onChange={applyPricing}
        nested
      />

      {leadId != null ? (
        <SendQuotePresentationToSlidesDialog
          open={sendSlidesOpen}
          onOpenChange={setSendSlidesOpen}
          layout={draft}
          leadId={leadId}
          projectId={linkedProject?.id ?? null}
          analysisId={tree.id}
        />
      ) : null}

      {linkedProject && companyId ? (
        <LinkQuoteProjectToLeadDialog
          open={linkLeadOpen}
          onOpenChange={setLinkLeadOpen}
          project={linkedProject}
          companyId={companyId}
          onLinked={(p) => {
            setLinkedProject(p)
            onProjectChange?.(p)
            if (p.lead_id != null) setSendSlidesOpen(true)
          }}
        />
      ) : null}
    </Modal>
  )
}
