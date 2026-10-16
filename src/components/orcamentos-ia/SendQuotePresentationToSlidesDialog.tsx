import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Presentation, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useOrcamentosPorLead } from '@/hooks/useOrcamentoSlides'
import type { QuotePresentationLayout } from '@/lib/orcamentos-ia/quote-presentation'
import {
  buildOrcamentoSlidesIaPriceSeed,
  writeOrcamentoSlidesIaPriceSeed,
} from '@/lib/orcamentos-ia/quote-presentation-to-slides'
import { formatBRL } from '@/lib/orcamentos-ia/pricing'
import { withOrcamentoReturnTo } from '@/lib/orcamento-slide-navigation'

interface SendQuotePresentationToSlidesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layout: QuotePresentationLayout
  leadId: number
  leadName?: string | null
  projectId?: string | null
  analysisId?: string | null
  returnTo?: string | null
}

export function SendQuotePresentationToSlidesDialog({
  open,
  onOpenChange,
  layout,
  leadId,
  leadName,
  projectId,
  analysisId,
  returnTo,
}: SendQuotePresentationToSlidesDialogProps) {
  const navigate = useNavigate()
  const { data: slides = [], isLoading } = useOrcamentosPorLead(open ? leadId : null)
  const [busy, setBusy] = useState(false)

  const drafts = useMemo(
    () => slides.filter((s) => s.status === 'rascunho'),
    [slides],
  )

  const goWithSeed = (path: string) => {
    setBusy(true)
    try {
      const seed = buildOrcamentoSlidesIaPriceSeed({
        layout,
        leadId,
        projectId,
        analysisId,
        clienteNome: leadName,
      })
      writeOrcamentoSlidesIaPriceSeed(seed)
      const href = returnTo ? withOrcamentoReturnTo(path, returnTo) : path
      onOpenChange(false)
      navigate(href)
      toast.success('Lista de preços da IA pronta na Precificação.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao preparar o orçamento.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Presentation className="h-4 w-4 text-[#0066FF]" />
            Enviar para orçamento do lead
          </DialogTitle>
          <DialogDescription className="text-sm">
            A lista de preços (ambientes e móveis) vai para a etapa Precificação do Orçamento
            Slides
            {leadName ? (
              <>
                {' '}
                de <strong>{leadName}</strong>
              </>
            ) : (
              <>
                {' '}
                (lead #{leadId})
              </>
            )}
            . Total: <strong>{formatBRL(layout.pricing.salePrice)}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Button
            type="button"
            className="w-full gap-1.5 bg-[#0066FF] hover:bg-[#0052cc]"
            disabled={busy}
            onClick={() => goWithSeed(`/orcamento-slides/novo?leadId=${leadId}&fromIa=1`)}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Criar apresentação nova com preços
          </Button>

          {isLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Buscando rascunhos…
            </p>
          ) : drafts.length > 0 ? (
            <div className="rounded-lg border border-border/70 p-2">
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                Ou abrir rascunho existente
              </p>
              <ul className="max-h-36 space-y-1 overflow-y-auto">
                {drafts.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={busy}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[#0066FF]/8"
                      onClick={() =>
                        goWithSeed(`/orcamento-slides/${s.id}/editar?fromIa=1`)
                      }
                    >
                      <span className="min-w-0 truncate font-medium">
                        {s.identificador || s.cliente_nome || s.id.slice(0, 8)}
                      </span>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Rascunho
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
