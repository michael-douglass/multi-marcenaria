import { useRef, useState } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EventoPhotoDrawCanvas } from '@/components/eventos/EventoPhotoDrawCanvas'
import { downloadEventoFotosPdf } from '@/lib/evento-pdf-export'
import { prepareEventoMidiaFiles } from '@/lib/evento-midia-upload'
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
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const atual = midias.find((m) => m.id === (atualId ?? midias[0]?.id)) ?? null

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      let totalPages = 0
      for (const file of Array.from(files)) {
        const prepared = await prepareEventoMidiaFiles(file)
        totalPages += prepared.length
        for (const page of prepared) {
          await onUpload(page)
        }
      }
      if (totalPages > 1) {
        toast.success(
          files.length === 1 && totalPages > 1
            ? `PDF convertido em ${totalPages} imagens.`
            : `${totalPages} imagens enviadas.`,
        )
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha no upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Fotos · {titulo}</DialogTitle>
          <DialogDescription className="sr-only">
            Envie imagens ou PDF. PDF vira páginas em imagem para visualizar e anotar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="btn btn-outline btn-md w-full"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Enviando…' : 'Subir foto ou PDF'}
            </button>
            <p className="text-[11px] leading-snug text-cream-faint">
              Imagem ou PDF. Se for PDF, cada página vira uma foto para você ver e desenhar.
            </p>
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
                Suba uma foto ou um PDF. Se for PDF, cada página vira uma imagem para você ver.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
