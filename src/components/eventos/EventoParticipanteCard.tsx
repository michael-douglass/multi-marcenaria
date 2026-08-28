import { useState } from 'react'
import { ImagePlus, Pencil, Trash2, UserRound } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { LeadNameAutocomplete } from '@/components/leads/LeadNameAutocomplete'
import type { EventoParticipanteInput } from '@/hooks/useEventoBoard'
import type { EventoParticipante } from '@/lib/evento-types'

interface EventoParticipanteCardProps {
  pessoa: EventoParticipante
  onSave: (input: EventoParticipanteInput & { id?: string }) => Promise<unknown>
  onDelete: () => void
  onFotos: () => void
}

export function EventoParticipanteCard({ pessoa, onSave, onDelete, onFotos }: EventoParticipanteCardProps) {
  const [open, setOpen] = useState(false)
  const capa = pessoa.midias[0]

  return (
    <>
      <article className="overflow-hidden rounded-xl border border-gold-border bg-[var(--color-surface-card)]">
        <button type="button" onClick={onFotos} className="block w-full">
          {capa ? (
            <img src={capa.file_url} alt="" className="h-28 w-full object-cover" />
          ) : (
            <div className="flex h-28 items-center justify-center bg-mahogany-base/80 text-cream-faint">
              <UserRound className="h-8 w-8" />
            </div>
          )}
        </button>
        <div className="flex items-start justify-between gap-2 px-3 py-2">
          <button type="button" onClick={() => setOpen(true)} className="min-w-0 text-left">
            <p className="truncate font-medium text-cream-secondary">{pessoa.nome}</p>
            <span className="mt-1 inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
              {pessoa.lead_id ? 'Lead' : 'Convidado'}
            </span>
          </button>
          <div className="flex gap-1">
            <button type="button" aria-label="Editar pessoa" onClick={() => setOpen(true)} className="p-1 text-cream-faint hover:text-gold">
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Fotos da pessoa" onClick={onFotos} className="p-1 text-cream-faint hover:text-gold">
              <ImagePlus className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Excluir pessoa" onClick={onDelete} className="p-1 text-cream-faint hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </article>
      <EventoParticipanteDialog
        open={open}
        onOpenChange={setOpen}
        initial={pessoa}
        onSave={async (input) => {
          await onSave({ ...input, id: pessoa.id })
          setOpen(false)
        }}
      />
    </>
  )
}

interface EventoParticipanteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: EventoParticipante | null
  onSave: (input: EventoParticipanteInput) => Promise<unknown>
}

export function EventoParticipanteDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: EventoParticipanteDialogProps) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [leadId, setLeadId] = useState<number | null>(initial?.lead_id ?? null)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (next) {
          setNome(initial?.nome ?? '')
          setLeadId(initial?.lead_id ?? null)
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar pessoa' : 'Adicionar pessoa'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Busque um lead ou digite o nome</Label>
            <LeadNameAutocomplete
              value={nome}
              onChange={(value) => {
                setNome(value)
                setLeadId(null)
              }}
              onSelectLead={(lead) => {
                setNome(lead.name)
                setLeadId(lead.id)
              }}
              placeholder="Nome da pessoa"
            />
          </div>
          {leadId ? (
            <span className="inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
              Lead
            </span>
          ) : (
            <span className="inline-block rounded-full border border-gold-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-cream-faint">
              Convidado
            </span>
          )}
        </div>
        <DialogFooter>
          <button type="button" className="btn btn-outline btn-md" onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-proforco btn-md"
            disabled={!nome.trim()}
            onClick={() => void onSave({ nome, lead_id: leadId })}
          >
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
