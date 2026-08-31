import { useState, type SyntheticEvent } from 'react'
import { ImagePlus, Send, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useLeadProjetoMutations, useProjetoPorLead } from '@/hooks/useLeadProjetos'
import {
  MAX_IMAGENS_ENVIO_SETOR,
  MIN_CARACTERES_ENVIO_SETOR,
  canEnviarDaPipeline,
} from '@/lib/projetos-atelie'
import { isImagemPermitidaNoAtelie } from '@/lib/lead-projeto-chat'
import { cn } from '@/lib/utils'

interface LeadEnviarProjetoDialogProps {
  leadId: number
  hidden?: boolean
  variant?: 'default' | 'card'
  className?: string
  onEnviado?: () => void
}

export function LeadEnviarProjetoDialog({
  leadId,
  hidden,
  variant = 'default',
  className,
  onEnviado,
}: LeadEnviarProjetoDialogProps) {
  const { userRoles, isSuperAdmin } = useAuth()
  const { projeto } = useProjetoPorLead(leadId)
  const { enviarAoSetor } = useLeadProjetoMutations()
  const [open, setOpen] = useState(false)
  const [recado, setRecado] = useState('')
  const [files, setFiles] = useState<File[]>([])

  if (hidden || !canEnviarDaPipeline(userRoles, isSuperAdmin)) return null

  const isCard = variant === 'card'
  const canSend = recado.trim().length >= MIN_CARACTERES_ENVIO_SETOR || files.length > 0
  const label = projeto ? 'Solicitar novamente' : 'Enviar ao setor'
  const cardLabel = projeto ? 'Solicitar de novo ao ateliê' : 'Enviar ao setor de projetos'

  const stopCardEvent = (event: SyntheticEvent) => {
    event.stopPropagation()
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={isCard ? 'outline' : 'default'}
        className={cn(
          isCard
            ? 'h-auto min-h-9 w-full justify-center gap-1.5 whitespace-normal px-2.5 py-2 text-[11px] font-semibold leading-snug border-gold/50 bg-[linear-gradient(180deg,rgba(242,216,146,0.22),rgba(242,216,146,0.08))] text-gold shadow-[inset_0_1px_0_rgba(255,248,220,0.18)] hover:bg-gold/25 hover:text-[#f5e0a8]'
            : 'gap-1.5 bg-gold text-[#1a120e] hover:bg-gold/90',
          className,
        )}
        onClick={(event) => {
          stopCardEvent(event)
          setOpen(true)
        }}
        onPointerDown={stopCardEvent}
      >
        <Send className="h-3.5 w-3.5 shrink-0" />
        <span className={isCard ? 'text-center text-balance' : 'truncate'}>{isCard ? cardLabel : label}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="border-gold/20 bg-[#120c09]"
          onClick={stopCardEvent}
          onPointerDown={stopCardEvent}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-gold">Enviar ao setor de projetos</DialogTitle>
            <DialogDescription>
              Recado com no mínimo {MIN_CARACTERES_ENVIO_SETOR} caracteres ou pelo menos uma foto (até{' '}
              {MAX_IMAGENS_ENVIO_SETOR}). Esse recado abre o canal com o ateliê.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={recado}
            maxLength={2000}
            onChange={(e) => setRecado(e.target.value)}
            placeholder="O que o ateliê precisa desenhar?"
            className="min-h-[100px] border-gold/25 bg-[#1a120e]/70"
          />
          <div className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <span key={`${file.name}-${index}`} className="relative h-16 w-16 overflow-hidden rounded-md border border-gold/20">
                <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 rounded-full bg-[#120c09]/80 p-0.5"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {files.length < MAX_IMAGENS_ENVIO_SETOR ? (
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-gold/30 text-gold">
                <ImagePlus className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    const next = [...(event.target.files ?? [])].filter(isImagemPermitidaNoAtelie)
                    setFiles((prev) => [...prev, ...next].slice(0, MAX_IMAGENS_ENVIO_SETOR))
                    event.target.value = ''
                  }}
                />
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-gold text-[#1a120e]"
              disabled={!canSend || enviarAoSetor.isPending}
              onClick={async () => {
                await enviarAoSetor.mutateAsync({ leadId, recado, files })
                setRecado('')
                setFiles([])
                setOpen(false)
                onEnviado?.()
              }}
            >
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
