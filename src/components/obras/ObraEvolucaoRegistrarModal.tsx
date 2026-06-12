import { useRef, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { isAcceptedEvolucaoFile } from '@/lib/obra-evolucao'

interface ObraEvolucaoRegistrarModalProps {
  open: boolean
  uploading: boolean
  onClose: () => void
  onSubmit: (files: File[], observacao: string) => Promise<void>
}

/** Modal para enviar foto de progresso com observação opcional. */
export function ObraEvolucaoRegistrarModal({
  open,
  uploading,
  onClose,
  onSubmit,
}: ObraEvolucaoRegistrarModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [observacao, setObservacao] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setObservacao('')
    setSelectedFiles([])
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    if (uploading) return
    reset()
    onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setError(null)

    const invalid = files.find(f => !isAcceptedEvolucaoFile(f))
    if (invalid) {
      setError('Apenas imagens (JPG, PNG, WebP), PDFs e vídeos são aceitos.')
      e.target.value = ''
      return
    }

    setSelectedFiles(files)
  }

  const handleSubmit = async () => {
    if (!selectedFiles.length) {
      setError('Selecione pelo menos uma foto, PDF ou vídeo.')
      return
    }
    setError(null)
    try {
      await onSubmit(selectedFiles, observacao.trim())
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar progresso.')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="REGISTRAR PROGRESSO">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-wider text-[#8a6a55]">
            Observação <span className="normal-case font-normal text-[#6b5544]">(opcional)</span>
          </label>
          <textarea
            className="glass-input min-h-[88px] resize-y"
            placeholder="Descreva o que foi feito hoje na obra..."
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            maxLength={500}
            disabled={uploading}
          />
          <p className="mt-1 text-right text-[0.62rem] text-[#6b5544]">
            {observacao.length}/500
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-wider text-[#8a6a55]">
            Fotos, PDF ou Vídeo
          </label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[rgba(212,168,83,0.35)] bg-black/20 px-4 py-6 text-sm font-semibold text-[#d4a853] transition hover:border-[rgba(212,168,83,0.55)] hover:bg-[rgba(212,168,83,0.06)] disabled:opacity-50"
          >
            <Camera size={18} />
            {selectedFiles.length ? 'Trocar arquivos' : 'Escolher foto, PDF ou vídeo'}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {selectedFiles.length > 0 && (
            <ul className="mt-2 space-y-1">
              {selectedFiles.map(file => (
                <li
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between gap-2 rounded-md bg-[rgba(212,168,83,0.08)] px-2.5 py-1.5 text-xs text-cream"
                >
                  <span className="min-w-0 truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles(prev => prev.filter(f => f !== file))}
                    disabled={uploading}
                    className="shrink-0 text-[#8a6a55] hover:text-[#d4a853]"
                    aria-label="Remover arquivo"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="btn btn-outline btn-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={uploading || !selectedFiles.length}
            className="btn btn-gold btn-sm flex items-center gap-1.5"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {uploading ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
