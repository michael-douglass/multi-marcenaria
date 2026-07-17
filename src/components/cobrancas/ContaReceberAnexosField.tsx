import { useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { AnexoLightbox, AnexoThumb } from '@/components/contas-pagar/AnexoLightbox'
import { buildPendingCrAnexo } from '@/lib/contas-receber-anexos'
import type { ContaReceberAnexoScope, PendingContaReceberAnexo } from '@/types'

interface ContaReceberAnexosFieldProps {
  anexos: PendingContaReceberAnexo[]
  onChange: (anexos: PendingContaReceberAnexo[]) => void
  /** Quando true, mostra escolha “só esta / todas”. */
  showScope?: boolean
  temParcelamento?: boolean
  scope?: ContaReceberAnexoScope
  onScopeChange?: (scope: ContaReceberAnexoScope) => void
}

export function ContaReceberAnexosField({
  anexos,
  onChange,
  showScope = false,
  temParcelamento = false,
  scope = 'single',
  onScopeChange,
}: ContaReceberAnexosFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<PendingContaReceberAnexo | null>(null)

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    setProcessing(true)
    try {
      const novos: PendingContaReceberAnexo[] = []
      const falhas: string[] = []

      for (const file of Array.from(files)) {
        try {
          novos.push(await buildPendingCrAnexo(file))
        } catch (e) {
          falhas.push(
            e instanceof Error ? `${file.name} (${e.message})` : file.name,
          )
        }
      }

      if (novos.length > 0) onChange([...anexos, ...novos])
      if (falhas.length > 0) {
        setError(
          `Alguns arquivos falharam (${falhas.length}): ${falhas.join('; ')}. Tente novamente.`,
        )
      }
    } finally {
      setProcessing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = (localId: string) => {
    const alvo = anexos.find(a => a.localId === localId)
    if (alvo) {
      const urls = alvo.previewUrls?.length ? alvo.previewUrls : alvo.previewUrl ? [alvo.previewUrl] : []
      urls.forEach(url => URL.revokeObjectURL(url))
    }
    onChange(anexos.filter(a => a.localId !== localId))
    if (lightbox?.localId === localId) setLightbox(null)
  }

  return (
    <Field label="Anexos (imagem, PDF ou Word)">
      <div className="space-y-3">
        {showScope && (
          <div className="flex flex-wrap gap-3 text-xs text-[#edd9c4]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="cr-anexo-scope"
                checked={scope === 'single'}
                onChange={() => onScopeChange?.('single')}
              />
              Só esta parcela
            </label>
            <label
              className={`inline-flex items-center gap-2 ${temParcelamento ? 'cursor-pointer' : 'opacity-50'}`}
            >
              <input
                type="radio"
                name="cr-anexo-scope"
                checked={scope === 'all'}
                disabled={!temParcelamento}
                onChange={() => onScopeChange?.('all')}
              />
              Todas as parcelas
            </label>
          </div>
        )}

        <div
          className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[rgba(240,210,140,0.35)] bg-[rgba(68,46,34,0.45)] px-4 py-4 transition-colors hover:border-[rgba(240,210,140,0.55)] hover:bg-[rgba(240,210,140,0.06)]"
          onClick={() => !processing && inputRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          {processing ? (
            <Loader2 className="h-6 w-6 animate-spin text-[#f2d892]" />
          ) : (
            <FileUp className="h-6 w-6 text-[#f2d892]" />
          )}
          <p className="mt-2 text-center text-xs text-[#edd9c4]">
            {processing
              ? 'Lendo o Word e gerando a prévia…'
              : 'Clique para anexar JPG, PNG, WebP, GIF, PDF ou Word (.dotx / .docx)'}
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.dotx,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.template,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          className="sr-only"
          onChange={e => void addFiles(e.target.files)}
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
        pages={lightbox?.previewUrls}
        title={lightbox?.nome ?? ''}
        kind={lightbox?.kind}
        onClose={() => setLightbox(null)}
        onDelete={lightbox ? () => remove(lightbox.localId) : undefined}
      />
    </Field>
  )
}
