import { useState } from 'react'
import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EventoPdfExportAura } from '@/components/eventos/EventoPdfExportAura'
import { EVENTO_PDF_COLUNAS, openEventoPdfPrint, type EventoPdfBranding } from '@/lib/evento-pdf-export'
import type { EventoBoard, EventoPdfColunaId } from '@/lib/evento-types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface EventoPdfExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  board: EventoBoard
  branding: EventoPdfBranding
}

export function EventoPdfExportDialog({ open, onOpenChange, board, branding }: EventoPdfExportDialogProps) {
  const [marcadas, setMarcadas] = useState<EventoPdfColunaId[]>(EVENTO_PDF_COLUNAS.map((c) => c.id))
  const fill = marcadas.length / EVENTO_PDF_COLUNAS.length

  const toggle = (id: EventoPdfColunaId) => {
    setMarcadas((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Exportar PDF
            <EventoPdfExportAura fill={fill} className="h-14 w-14" />
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-cream-muted">Marque o que entra no dossiê. Cada bloco vira a própria folha A4 — a capa vai sempre.</p>
        <ul className="space-y-2">
          {EVENTO_PDF_COLUNAS.map((coluna) => {
            const on = marcadas.includes(coluna.id)
            return (
              <li key={coluna.id}>
                <button
                  type="button"
                  onClick={() => toggle(coluna.id)}
                  className={cn('evento-pdf-folio flex w-full items-center justify-between px-4 py-3 text-left', on && 'is-on')}
                >
                  <span>{coluna.label}</span>
                  <span className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full border',
                    on ? 'border-gold bg-gold text-[#2a1812] shadow-[0_0_12px_rgba(240,210,140,0.45)]' : 'border-gold-border text-transparent',
                  )}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <DialogFooter>
          <button type="button" className="btn btn-outline btn-md" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button
            type="button"
            className="btn btn-proforco btn-md"
            onClick={() => {
              try {
                openEventoPdfPrint(board, branding, marcadas)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Não deu para abrir o PDF')
              }
            }}
          >
            Gerar PDF
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
