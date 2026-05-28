import { useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { buildPendingAnexo } from '@/lib/contas-pagar-anexos'
import type { PendingContaPagarAnexo } from '@/types'
import { AnexoLightbox, AnexoThumb } from './AnexoLightbox'

interface ContaPagarAnexosFieldProps {
  anexos: PendingContaPagarAnexo[]
  onChange: (anexos: PendingContaPagarAnexo[]) => void
}

export function ContaPagarAnexosField({ anexos, onChange }: ContaPagarAnexosFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<PendingContaPagarAnexo | null>(null)

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    setProcessing(true)
    try {
      const novos: PendingContaPagarAnexo[] = []
      const falhas: string[] = []

      for (const file of Array.from(files)) {
        try {
          novos.push(await buildPendingAnexo(file))
        } catch {
          falhas.push(file.name)
        }
      }

      if (novos.length > 0) {
        onChange([...anexos, ...novos])
      }

      if (falhas.length > 0) {
        setError(
          `Alguns arquivos falharam (${falhas.length}): ${falhas.join(', ')}. Tente novamente.`,
        )
      }
    } finally {
      setProcessing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = (localId: string) => {
    const alvo = anexos.find(a => a.localId === localId)
    if (alvo) URL.revokeObjectURL(alvo.previewUrl)
    onChange(anexos.filter(a => a.localId !== localId))
    if (lightbox?.localId === localId) setLightbox(null)
  }

  return (
    <Field label="Anexos (imagem ou PDF)">
      <div className="space-y-3">
        <div
          className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[rgba(212,168,83,0.35)] bg-[rgba(15,7,3,0.45)] px-4 py-4 transition-colors hover:border-[rgba(212,168,83,0.55)] hover:bg-[rgba(212,168,83,0.06)]"
          onClick={() => !processing && inputRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          {processing ? (
            <Loader2 className="h-6 w-6 animate-spin text-[#d4a853]" />
          ) : (
            <FileUp className="h-6 w-6 text-[#d4a853]" />
          )}
          <p className="mt-2 text-center text-xs text-[#8a6a55]">
            Clique para anexar JPG, PNG, WebP, GIF ou PDF
          </p>
          <p className="mt-0.5 text-center text-[0.65rem] text-[#8a6a55]/80">
            PDFs viram imagem na pré-visualização
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={e => addFiles(e.target.files)}
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        {anexos.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {anexos.map(a => (
              <AnexoThumb
                key={a.localId}
                previewUrl={a.previewUrl}
                nome={a.nome}
                kind={a.kind}
                onOpenFullscreen={() => setLightbox(a)}
                onDelete={() => remove(a.localId)}
              />
            ))}
          </div>
        )}
      </div>

      <AnexoLightbox
        open={!!lightbox}
        imageUrl={lightbox?.previewUrl ?? ''}
        title={lightbox?.nome ?? ''}
        onClose={() => setLightbox(null)}
        onDelete={
          lightbox
            ? () => {
                remove(lightbox.localId)
              }
            : undefined
        }
      />
    </Field>
  )
}
