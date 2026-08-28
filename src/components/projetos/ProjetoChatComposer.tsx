import { useEffect, useId, useRef, useState } from 'react'
import { ImagePlus, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { MAX_CHAT_MENSAGEM } from '@/lib/projetos-atelie'
import { isImagemPermitidaNoAtelie, mensagemChatValida } from '@/lib/lead-projeto-chat'

interface ProjetoChatComposerProps {
  compact?: boolean
  disabled?: boolean
  onSend: (payload: { mensagem: string; file: File | null }) => void
}

export function ProjetoChatComposer({ compact, disabled, onSend }: ProjetoChatComposerProps) {
  const composerId = useId()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const canSend = mensagemChatValida(text, Boolean(file)) && !disabled

  const submit = () => {
    if (!canSend) return
    onSend({ mensagem: text.trim(), file })
    setText('')
    setFile(null)
  }

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      <label className="sr-only" htmlFor={composerId}>
        Responder no canal
      </label>
      <Textarea
        id={composerId}
        value={text}
        maxLength={MAX_CHAT_MENSAGEM}
        disabled={disabled}
        placeholder="Escreva no canal do ateliê…"
        className={cn(
          'resize-y border-gold/25 bg-[#1a120e]/70 text-[15px] leading-6 text-cream-secondary',
          compact ? 'min-h-[72px]' : 'min-h-[88px]',
        )}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
        }}
      />
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const next = event.target.files?.[0]
              if (!next) return
              if (!isImagemPermitidaNoAtelie(next)) return
              setFile(next)
              event.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 border-gold/25 text-gold"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Imagem
          </Button>
          {preview ? (
            <span className="relative h-20 w-20 overflow-hidden rounded-md border border-gold/20">
              <img src={preview} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-0.5 top-0.5 rounded-full bg-[#120c09]/80 p-0.5 text-cream-secondary"
                onClick={() => setFile(null)}
                aria-label="Tirar imagem"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 bg-gold text-[#1a120e] hover:bg-gold/90"
          disabled={!canSend}
          onClick={submit}
        >
          <Send className="mr-1 h-3.5 w-3.5" />
          Enviar
        </Button>
      </div>
    </div>
  )
}
