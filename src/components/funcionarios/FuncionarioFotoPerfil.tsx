import { useEffect, useRef, useState } from 'react'
import { Camera, User } from 'lucide-react'
import { getFuncionarioDocSignedUrl, uploadFotoPerfil } from '@/lib/funcionario-documentos'

interface Props {
  funcionarioId: string
  fotoPath?: string | null
  nome: string
  readOnly?: boolean
  onUpdated: () => void
}

export function FuncionarioFotoPerfil({ funcionarioId, fotoPath, nome, readOnly, onUpdated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fotoPath) {
      setPreviewUrl(null)
      return
    }
    let cancelled = false
    void getFuncionarioDocSignedUrl(fotoPath)
      .then(url => {
        if (!cancelled) setPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null)
      })
    return () => { cancelled = true }
  }, [fotoPath])

  const onFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Envie uma imagem (JPG, PNG ou WebP).')
      return
    }
    setUploading(true)
    setError(null)
    const local = URL.createObjectURL(file)
    setPreviewUrl(local)
    try {
      await uploadFotoPerfil(funcionarioId, file)
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar foto.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="glass-card flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
      <div className="relative">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-[rgba(212,168,83,0.4)] bg-[rgba(0,0,0,0.25)]">
          {previewUrl ? (
            <img src={previewUrl} alt={`Foto de ${nome}`} className="h-full w-full object-cover" />
          ) : (
            <User size={48} className="text-[#b8957f]" />
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-[#d4a853] bg-[#2a1810] text-[#f2d892] shadow-lg"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            aria-label="Alterar foto de perfil"
          >
            <Camera size={16} />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={readOnly || uploading}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
            e.target.value = ''
          }}
        />
      </div>
      <div className="text-center sm:text-left">
        <h3 className="font-semibold text-[#f2d892]">Foto de perfil</h3>
        <p className="mt-1 text-sm text-[#b8957f]">
          Esta foto aparece no sistema como sua identificação. Use uma imagem nítida do rosto.
        </p>
        {!readOnly && (
          <button
            type="button"
            className="btn btn-outline btn-sm mt-3"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Enviando…' : fotoPath ? 'Trocar foto' : 'Escolher foto'}
          </button>
        )}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  )
}
