import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

function cadernosOrdenados(board: EventoBoard) {
  return [...(board.cadernos ?? [])].sort(
    (a, b) => a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em),
  )
}

export function EventoPdfExportDialog({ open, onOpenChange, board, branding }: EventoPdfExportDialogProps) {
  const cadernos = useMemo(() => cadernosOrdenados(board), [board])
  const [marcadas, setMarcadas] = useState<EventoPdfColunaId[]>(EVENTO_PDF_COLUNAS.map((c) => c.id))
  const [cadernosMarcados, setCadernosMarcados] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setMarcadas(EVENTO_PDF_COLUNAS.map((c) => c.id))
    setCadernosMarcados(cadernos.map((c) => c.id))
  }, [open, cadernos])

  const incluiCaderno = marcadas.includes('caderno')
  const slotsMarcados =
    marcadas.filter((id) => id !== 'caderno').length +
    (incluiCaderno ? cadernosMarcados.length / Math.max(cadernos.length, 1) : 0)
  const fill = Math.min(1, slotsMarcados / EVENTO_PDF_COLUNAS.length)

  const toggle = (id: EventoPdfColunaId) => {
    setMarcadas((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  const toggleCaderno = (id: string) => {
    setCadernosMarcados((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  const marcarTodosCadernos = () => setCadernosMarcados(cadernos.map((c) => c.id))
  const limparCadernos = () => setCadernosMarcados([])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="evento-pdf-export-dialog max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-[var(--color-text-primary)]">
            Exportar PDF
            <EventoPdfExportAura fill={fill} className="h-14 w-14 shrink-0" />
          </DialogTitle>
          <DialogDescription className="sr-only">
            Escolha quais partes do evento entram no dossiê em PDF.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
          Marque o que entra no dossiê. A capa vai sempre. Caderno inclui texto e fotos coladas na folha;
          Anexos traz a galeria do botão Anexar (imagem e PDF convertido).
        </p>
        <ul className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto pr-1">
          {EVENTO_PDF_COLUNAS.map((coluna) => {
            const on = marcadas.includes(coluna.id)
            const isCaderno = coluna.id === 'caderno'
            return (
              <li key={coluna.id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggle(coluna.id)}
                  className={cn('evento-pdf-folio flex w-full items-center justify-between px-4 py-3 text-left', on && 'is-on')}
                >
                  <span className="font-medium">{coluna.label}</span>
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                      on
                        ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-[#2a1812] shadow-[0_0_12px_rgba(240,210,140,0.45)]'
                        : 'border-[var(--color-gold-border)] bg-transparent text-transparent',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                </button>
                {isCaderno && on && cadernos.length > 0 ? (
                  <div className="evento-pdf-cadernos ml-1 space-y-2 pl-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                        Quais cadernos entram
                      </p>
                      <span className="flex gap-2 text-xs">
                        <button
                          type="button"
                          className="text-[var(--color-gold-muted)] underline-offset-2 hover:underline"
                          onClick={marcarTodosCadernos}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          className="text-[var(--color-text-muted)] underline-offset-2 hover:underline"
                          onClick={limparCadernos}
                        >
                          Nenhum
                        </button>
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {cadernos.map((c) => {
                        const cOn = cadernosMarcados.includes(c.id)
                        const folhas = board.paginas.filter((p) => p.caderno_id === c.id).length
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => toggleCaderno(c.id)}
                              className={cn(
                                'evento-pdf-caderno-row flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                                cOn && 'is-on',
                              )}
                            >
                              <span className="truncate">{c.titulo.trim() || 'Sem nome'}</span>
                              <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                {folhas} {folhas === 1 ? 'folha' : 'folhas'}
                                <span
                                  className={cn(
                                    'inline-flex h-5 w-5 items-center justify-center rounded-full border',
                                    cOn
                                      ? 'border-[var(--color-gold)] bg-[var(--color-gold)] text-[#2a1812]'
                                      : 'border-[var(--color-gold-border-subtle)] text-transparent',
                                  )}
                                >
                                  <Check className="h-3 w-3" strokeWidth={2.5} />
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}
                {isCaderno && on && cadernos.length === 0 ? (
                  <p className="ml-4 text-xs text-[var(--color-text-muted)]">Nenhum caderno nesta pasta.</p>
                ) : null}
              </li>
            )
          })}
        </ul>
        <DialogFooter className="gap-2 sm:gap-2">
          <button type="button" className="btn btn-outline btn-md" onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-proforco btn-md"
            onClick={() => {
              try {
                const ids = incluiCaderno ? cadernosMarcados : undefined
                openEventoPdfPrint(board, branding, marcadas, ids)
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
