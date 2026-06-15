import { useState, useEffect, useCallback } from 'react'
import {
  listObraArquivos, uploadObraArquivo, deleteObraArquivo, getObraArquivoUrl,
  buildPendingObraArquivo, revokePendingObraArquivoUrl,
  type ObraArquivo, type PendingObraArquivo,
} from '../lib/obra-arquivos'
import { resolveStoredPreviewPaths } from '../lib/pdf-preview-storage'

export type { ObraArquivo, PendingObraArquivo }

interface ArquivoComUrl extends ObraArquivo {
  signedUrl: string | null
  previewSignedUrl: string | null
  previewSignedUrls: string[]
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
      const comUrls = await Promise.all(arqs.map(async a => {
        const [signedUrl, ...previewUrls] = await Promise.all([
          getObraArquivoUrl(a.storage_path).catch(() => null),
          ...resolveStoredPreviewPaths(a).map(p =>
            getObraArquivoUrl(p).catch(() => null),
          ),
        ])
        const previewSignedUrls = previewUrls.filter((u): u is string => !!u)
        const previewSignedUrl =
          a.kind === 'image'
            ? signedUrl
            : previewSignedUrls[0] ?? signedUrl

        return {
          ...a,
          signedUrl,
          previewSignedUrl,
          previewSignedUrls,
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
      revokePendingObraArquivoUrl(pending)
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
