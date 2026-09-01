import { useEffect, useState, type SyntheticEvent } from 'react'
import { ImagePlus, Loader2, Send, X } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useLeadProjetoMutations, useProjetoPorLead } from '@/hooks/useLeadProjetos'
import { LeadEnviarProjetoAura } from '@/components/projetos/LeadEnviarProjetoAura'
import {
  MAX_IMAGENS_ENVIO_SETOR,
  MIN_CARACTERES_ENVIO_SETOR,
  canEnviarDaPipeline,
} from '@/lib/projetos-atelie'
import { isImagemPermitidaNoAtelie } from '@/lib/lead-projeto-chat'
import { setEnviarProjetoDialogOpenFlag } from '@/lib/dialog-outside-guard'
import { cn } from '@/lib/utils'

interface LeadEnviarProjetoDialogProps {
  leadId: number
  hidden?: boolean
  variant?: 'default' | 'card'
  className?: string
  onEnviado?: () => void
}

function FotoMiniatura({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <span className="relative h-16 w-16 overflow-hidden rounded-md border border-[rgba(196,150,58,0.4)]">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
      <button
        type="button"
        className="absolute right-0.5 top-0.5 rounded-full bg-[#1a120e] p-0.5 text-[#fff6ea]"
        onClick={onRemove}
        aria-label="Remover foto"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
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

  useEffect(() => {
    if (!open) return
    setEnviarProjetoDialogOpenFlag(true)
    return () => setEnviarProjetoDialogOpenFlag(false)
  }, [open])

  if (hidden || !canEnviarDaPipeline(userRoles, isSuperAdmin)) return null

  const isCard = variant === 'card'
  const recadoLen = recado.trim().length
  const canSend = recadoLen >= MIN_CARACTERES_ENVIO_SETOR || files.length > 0
  const faltam = Math.max(0, MIN_CARACTERES_ENVIO_SETOR - recadoLen)
  const label = projeto ? 'Solicitar novamente' : 'Enviar ao setor'
  const cardLabel = projeto ? 'Solicitar de novo ao ateliê' : 'Enviar ao setor de projetos'

  const stopCardEvent = (event: SyntheticEvent) => {
    event.stopPropagation()
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && !enviarAoSetor.isPending) {
      setRecado('')
      setFiles([])
    }
  }

  const handleEnviar = async (event: SyntheticEvent) => {
    stopCardEvent(event)
    if (enviarAoSetor.isPending) return
    if (!canSend) {
      toast.error(
        `Escreva pelo menos ${MIN_CARACTERES_ENVIO_SETOR} caracteres ou anexe uma foto.`,
      )
      return
    }
    try {
      await enviarAoSetor.mutateAsync({ leadId, recado, files })
      setRecado('')
      setFiles([])
      setOpen(false)
      onEnviado?.()
    } catch {
      // O aviso já aparece no onError da mutação.
    }
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
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          nested
          data-enviar-projeto-dialog=""
          className="lead-atelier-dialog pointer-events-auto gap-0 overflow-hidden p-0 sm:max-w-md [&>button.absolute]:text-[#f2d892] [&>button.absolute]:hover:text-[#fff6ea] [&>button.absolute]:hover:bg-gold/10"
          onClick={stopCardEvent}
          onPointerDown={stopCardEvent}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="relative space-y-2 overflow-hidden border-b border-[color:var(--lead-line)] bg-[color:var(--lead-panel)] px-5 py-4 pr-12 text-left">
            <LeadEnviarProjetoAura ready={canSend} />
            <DialogTitle className="relative font-serif text-xl font-semibold tracking-tight text-[#fff6ea]">
              Enviar ao setor de projetos
            </DialogTitle>
            <DialogDescription className="relative text-sm leading-relaxed text-[#d4bc9f]">
              Recado com no mínimo {MIN_CARACTERES_ENVIO_SETOR} caracteres ou pelo menos uma foto (até{' '}
              {MAX_IMAGENS_ENVIO_SETOR}). Esse recado abre o canal com o ateliê.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d4bc9f]">
                  Recado para o ateliê
                </p>
                <p
                  className={cn(
                    'text-[10px] font-medium tracking-wide',
                    canSend ? 'text-[#f2d892]' : 'text-[#b89a78]',
                  )}
                >
                  {canSend
                    ? files.length > 0 && recadoLen < MIN_CARACTERES_ENVIO_SETOR
                      ? 'Foto pronta para enviar'
                      : 'Pronto para enviar'
                    : faltam === 1
                      ? 'Falta 1 caractere'
                      : `Faltam ${faltam} caracteres`}
                </p>
              </div>
              <Textarea
                value={recado}
                maxLength={2000}
                onChange={(e) => setRecado(e.target.value)}
                placeholder="O que o ateliê precisa desenhar?"
                className="min-h-[120px] border-[rgba(196,150,58,0.4)] bg-[#120c09] text-[#fff6ea] placeholder:text-[#b89a78]"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d4bc9f]">
                Fotos (opcional)
              </p>
              <div className="flex flex-wrap gap-2">
                {files.map((file, index) => (
                  <FotoMiniatura
                    key={`${file.name}-${file.size}-${index}`}
                    file={file}
                    onRemove={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  />
                ))}
                {files.length < MAX_IMAGENS_ENVIO_SETOR ? (
                  <label className="flex h-16 min-w-16 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-[rgba(242,216,146,0.45)] bg-[#120c09] px-2 text-[#f2d892] hover:bg-[#241810]">
                    <ImagePlus className="h-4 w-4 shrink-0" />
                    <span className="hidden text-[10px] font-semibold uppercase tracking-wide sm:inline">Foto</span>
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
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-[color:var(--lead-line)] bg-[color:var(--lead-panel)] px-5 py-3 sm:space-x-2">
            <Button
              type="button"
              variant="outline"
              className="border-[rgba(196,150,58,0.45)] bg-transparent text-[#fff6ea] hover:bg-gold/10 hover:text-[#fff6ea]"
              disabled={enviarAoSetor.isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className={cn(
                'min-w-[8.5rem] font-semibold text-[#1a120e]',
                canSend
                  ? 'bg-[#f2d892] hover:bg-[#f5e0a8]'
                  : 'bg-[#f2d892]/45 hover:bg-[#f2d892]/60',
              )}
              disabled={enviarAoSetor.isPending}
              onClick={handleEnviar}
              onPointerDown={stopCardEvent}
            >
              {enviarAoSetor.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
