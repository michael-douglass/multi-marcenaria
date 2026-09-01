import { useState } from 'react'
import { ImagePlus, Mail, Pencil, Phone, Trash2, UserRound } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LeadNameAutocomplete } from '@/components/leads/LeadNameAutocomplete'
import type { EventoParticipanteInput } from '@/hooks/useEventoBoard'
import type { EventoParticipante } from '@/lib/evento-types'
import { formatInternationalPhone } from '@/lib/utils'

function labelTelefone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return value
}

interface EventoParticipanteCardProps {
  pessoa: EventoParticipante
  onSave: (input: EventoParticipanteInput & { id?: string }) => Promise<unknown>
  onDelete: () => void
  onFotos: () => void
}

export function EventoParticipanteCard({ pessoa, onSave, onDelete, onFotos }: EventoParticipanteCardProps) {
  const [open, setOpen] = useState(false)
  const capa = pessoa.midias[0]
  const contato = [pessoa.telefone ? labelTelefone(pessoa.telefone) : null, pessoa.email].filter(Boolean).join(' · ')

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
            {contato ? (
              <p className="mt-0.5 truncate text-[11px] text-cream-faint">{contato}</p>
            ) : null}
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
  const [telefone, setTelefone] = useState(initial?.telefone ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [saving, setSaving] = useState(false)

  const resetFrom = (pessoa?: EventoParticipante | null) => {
    setNome(pessoa?.nome ?? '')
    setLeadId(pessoa?.lead_id ?? null)
    setTelefone(pessoa?.telefone ?? '')
    setEmail(pessoa?.email ?? '')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (next) resetFrom(initial)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar pessoa' : 'Adicionar lead'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="evento-pessoa-nome">Nome</Label>
            <LeadNameAutocomplete
              id="evento-pessoa-nome"
              value={nome}
              onChange={(value) => {
                setNome(value)
                setLeadId(null)
              }}
              onSelectLead={(lead) => {
                setNome(lead.name)
                setLeadId(lead.id)
                setTelefone(lead.phone || '')
                setEmail(lead.email || '')
              }}
              placeholder="Busque um lead ou digite o nome"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evento-pessoa-telefone">Telefone</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream-faint" />
              <Input
                id="evento-pessoa-telefone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="pl-9"
                placeholder="(11) 99999-0000"
                value={telefone}
                onChange={(e) => setTelefone(formatInternationalPhone(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evento-pessoa-email">E-mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream-faint" />
              <Input
                id="evento-pessoa-email"
                type="email"
                autoComplete="email"
                className="pl-9"
                placeholder="pessoa@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          {leadId ? (
            <span className="inline-block rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
              Lead cadastrado
            </span>
          ) : (
            <p className="text-[11px] text-cream-faint">
              Pessoa nova entra no CRM como lead, com este nome, telefone e e-mail.
            </p>
          )}
        </div>
        <DialogFooter>
          <button type="button" className="btn btn-outline btn-md" onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-proforco btn-md"
            disabled={!nome.trim() || saving}
            onClick={() => {
              setSaving(true)
              void onSave({ nome, lead_id: leadId, telefone, email }).finally(() => setSaving(false))
            }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
