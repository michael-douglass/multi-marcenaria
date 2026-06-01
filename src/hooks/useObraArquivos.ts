import { useState, useEffect, useCallback } from 'react'
import {
  listObraArquivos, uploadObraArquivo, deleteObraArquivo, getObraArquivoUrl,
  buildPendingObraArquivo,
  type ObraArquivo, type PendingObraArquivo,
} from '../lib/obra-arquivos'

export type { ObraArquivo, PendingObraArquivo }

interface ArquivoComUrl extends ObraArquivo {
  signedUrl: string | null
  previewSignedUrl: string | null
}

export function useObraArquivos(obraId: string | null) {
  const [data, setData] = useState<ArquivoComUrl[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    if (!obraId) { setData([]); return }
    setLoading(true)
    try {
      const arqs = await listObraArquivos(obraId)
      // Gera signed URLs em paralelo
      const comUrls = await Promise.all(arqs.map(async a => {
        const [signedUrl, previewSignedUrl] = await Promise.all([
          getObraArquivoUrl(a.storage_path).catch(() => null),
          a.preview_path && a.preview_path !== a.storage_path
            ? getObraArquivoUrl(a.preview_path).catch(() => null)
            : Promise.resolve(null),
        ])
        return {
          ...a,
          signedUrl,
          previewSignedUrl: a.kind === 'image' ? signedUrl : previewSignedUrl,
        }
      }))
      setData(comUrls)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [obraId])

  useEffect(() => { void load() }, [load])

  const upload = async (file: File) => {
    if (!obraId) return
    setUploading(true)
    try {
      const pending = await buildPendingObraArquivo(file)
      await uploadObraArquivo(obraId, pending)
      URL.revokeObjectURL(pending.previewUrl)
      await load()
    } finally {
      setUploading(false)
    }
  }

  const remove = async (arq: ObraArquivo) => {
    await deleteObraArquivo(arq)
    setData(prev => prev.filter(a => a.id !== arq.id))
  }

  return { data, loading, uploading, upload, remove, reload: load }
}
