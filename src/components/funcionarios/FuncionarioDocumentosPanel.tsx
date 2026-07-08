import { useRef, useState } from 'react'
import { Trash2, Upload } from 'lucide-react'
import { AnexoLightbox, AnexoThumb } from '@/components/contas-pagar/AnexoLightbox'
import { useApp } from '@/context/AppContext'
import {
  buildPendingFuncionarioDoc,
  deleteFuncionarioDocumento,
  revokePendingFuncionarioDocUrls,
  uploadFuncionarioDocumento,
} from '@/lib/funcionario-documentos'
import { isAdministrador } from '@/lib/role-access'
import type { FuncionarioDocumento, PendingFuncionarioDocumento } from '@/types'

interface Props {
  funcionarioId: string
  documentos: FuncionarioDocumento[]
  readOnly?: boolean
  onReload: () => void
}

export function FuncionarioDocumentosPanel({ funcionarioId, documentos, readOnly, onReload }: Props) {
  const { roles } = useApp()
  const canDeleteDocuments = isAdministrador(roles)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<FuncionarioDocumento | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || readOnly) return
    setUploading(true)
    setError(null)
    const pending: PendingFuncionarioDocumento[] = []
    try {
      for (const file of Array.from(files)) {
        pending.push(await buildPendingFuncionarioDoc(file, 'outros', 'rh'))
      }
      for (const p of pending) {
        await uploadFuncionarioDocumento(funcionarioId, p, 'admin')
      }
      onReload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar documento.')
    } finally {
      revokePendingFuncionarioDocUrls(pending)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async (doc: FuncionarioDocumento) => {
    if (readOnly || !canDeleteDocuments) return
    if (!confirm(`Excluir "${doc.nome_arquivo}"?`)) return
    try {
      await deleteFuncionarioDocumento(doc)
      onReload()
      if (lightbox?.id === doc.id) setLightbox(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir.')
    }
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-medium text-[#f2d892]">Documentos RH</p>
            <p className="text-sm text-[#b8957f]">Imagens ou PDFs — CTPS, contratos, etc.</p>
          </div>
          <div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => void handleFiles(e.target.files)}
            />
            <button
              type="button"
              className="btn btn-gold btn-sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={14} />
              {uploading ? 'Enviando…' : 'Enviar arquivo'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {documentos.length === 0 ? (
        <div className="glass-card p-8 text-center text-[#b8957f]">Nenhum documento na pasta.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {documentos.map(doc => (
            <div key={doc.id} className="group relative">
              <button
                type="button"
                className="w-full overflow-hidden rounded-lg border border-[rgba(212,168,83,0.2)] bg-[rgba(36,16,8,0.5)]"
                onClick={() => setLightbox(doc)}
              >
              <AnexoThumb
                  kind={doc.kind}
                  previewUrl={doc.previewSignedUrl ?? ''}
                  nome={doc.nome_arquivo}
                  onOpenFullscreen={() => setLightbox(doc)}
                />
              </button>
              {canDeleteDocuments && !readOnly && (
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded bg-red-900/80 p-1 opacity-0 transition group-hover:opacity-100"
                  onClick={() => void handleDelete(doc)}
                >
                  <Trash2 size={12} className="text-red-200" />
                </button>
              )}
              <p className="mt-1 truncate text-xs text-[#b8957f]">{doc.nome_arquivo}</p>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <AnexoLightbox
          open
          imageUrl={lightbox.previewSignedUrl ?? ''}
          title={lightbox.nome_arquivo}
          kind={lightbox.kind}
          onClose={() => setLightbox(null)}
          onDelete={canDeleteDocuments && !readOnly ? () => void handleDelete(lightbox) : undefined}
        />
      )}
    </div>
  )
}
