import { useRef, useState } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EventoPhotoDrawCanvas } from '@/components/eventos/EventoPhotoDrawCanvas'
import { downloadEventoFotosPdf } from '@/lib/evento-pdf-export'
import { prepareWhiteboardImageForUpload } from '@/lib/whiteboard-image-upload'
import type { EventoDesenho, EventoMidia } from '@/lib/evento-types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface EventoCardFotosSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  midias: EventoMidia[]
  branding: { nome: string; cnpj?: string | null; logoUrl?: string | null }
  onUpload: (file: File) => Promise<unknown>
  onAnotacoes: (midiaId: string, anotacoes: EventoDesenho[]) => Promise<unknown>
  onDelete: (midia: EventoMidia) => Promise<unknown>
}

export function EventoCardFotosSheet({
  open,
  onOpenChange,
  titulo,
  midias,
  branding,
  onUpload,
  onAnotacoes,
  onDelete,
}: EventoCardFotosSheetProps) {
  const [atualId, setAtualId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const atual = midias.find((m) => m.id === (atualId ?? midias[0]?.id)) ?? null

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    try {
      for (const file of Array.from(files)) {
        const prepared = await prepareWhiteboardImageForUpload(file)
        await onUpload(prepared)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha no upload')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Fotos · {titulo}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <button type="button" className="btn btn-outline btn-md w-full" onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Subir foto
            </button>
            <button
              type="button"
              className="btn btn-outline btn-md w-full"
              disabled={midias.length === 0}
              onClick={() => void downloadEventoFotosPdf({ titulo, midias, branding })}
            >
              <Download className="h-4 w-4" />
              PDF das fotos
            </button>
            <ul className="max-h-[420px] space-y-2 overflow-y-auto">
              {midias.map((midia) => (
                <li key={midia.id}>
                  <button
                    type="button"
                    onClick={() => setAtualId(midia.id)}
                    className={cn(
                      'w-full overflow-hidden rounded-lg border',
                      atual?.id === midia.id ? 'border-gold' : 'border-gold-border/40',
                    )}
                  >
                    <img src={midia.file_url} alt="" className="h-16 w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            {atual ? (
              <div className="space-y-2">
                <EventoPhotoDrawCanvas
                  src={atual.file_url}
                  anotacoes={atual.anotacoes}
                  onChange={(next) => void onAnotacoes(atual.id, next)}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => void onDelete(atual)}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir foto
                </button>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-gold-border px-4 py-16 text-center text-sm text-cream-faint">
                Suba uma foto para desenhar em cima.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
