import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clearObraLousaDrawingsForImage,
  deleteObraLousaDrawing,
  deleteObraLousaImage,
  drawingsForImage,
  getObraLousaSignedUrl,
  insertObraLousaAnnotation,
  insertObraLousaStroke,
  listObraLousaDrawings,
  listObraLousaImages,
  updateObraLousaDrawing,
  updateObraLousaObservacao,
  uploadObraLousaImage,
  type ObraLousaDrawing,
  type ObraLousaImage,
  type ObraLousaImageWithUrl,
} from '@/lib/obra-lousa'
import {
  encodeAnnotation,
  type WhiteboardAnnotation,
} from '@/lib/obra-lousa-annotations'
import { exportObraLousaJpeg } from '@/lib/obra-lousa-export'
import { uploadObraArquivo, buildPendingObraArquivo, revokePendingObraArquivoUrl } from '@/lib/obra-arquivos'

export function useObraLousa(obraId: string | null, enabled = true) {
  const [images, setImages] = useState<ObraLousaImageWithUrl[]>([])
  const [drawings, setDrawings] = useState<ObraLousaDrawing[]>([])
  const [activeImageId, setActiveImageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async () => {
    if (!obraId || !enabled) {
      setImages([])
      setDrawings([])
      setActiveImageId(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [imgs, draws] = await Promise.all([
        listObraLousaImages(obraId),
        listObraLousaDrawings(obraId),
      ])
      const withUrls = await Promise.all(
        imgs.map(async img => ({
          ...img,
          signedUrl: await getObraLousaSignedUrl(img.file_url).catch(() => null),
        })),
      )
      if (!mountedRef.current) return
      setImages(withUrls)
      setDrawings(draws)
      setActiveImageId(prev => {
        if (prev && withUrls.some(i => i.id === prev)) return prev
        return withUrls[0]?.id ?? null
      })
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Falha ao carregar a Lousa.')
      setImages([])
      setDrawings([])
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [obraId, enabled])

  useEffect(() => { void load() }, [load])

  const activeImage = useMemo(
    () => images.find(i => i.id === activeImageId) ?? null,
    [images, activeImageId],
  )

  const activeDrawings = useMemo(
    () => (activeImageId ? drawingsForImage(drawings, activeImageId) : []),
    [drawings, activeImageId],
  )

  const uploadImage = useCallback(async (file: File) => {
    if (!obraId) return null
    setUploading(true)
    setError(null)
    try {
      const row = await uploadObraLousaImage(obraId, file, images.length)
      const signedUrl = await getObraLousaSignedUrl(row.file_url).catch(() => null)
      const withUrl: ObraLousaImageWithUrl = { ...row, signedUrl }
      setImages(prev => [...prev, withUrl])
      setActiveImageId(row.id)
      return withUrl
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha no upload.'
      setError(msg)
      throw err
    } finally {
      setUploading(false)
    }
  }, [obraId, images.length])

  const removeImage = useCallback(async (image: ObraLousaImage) => {
    await deleteObraLousaImage(image)
    setImages(prev => prev.filter(i => i.id !== image.id))
    setDrawings(prev => prev.filter(d => d.image_id !== image.id))
    setActiveImageId(prev => (prev === image.id ? null : prev))
  }, [])

  const saveObservacao = useCallback(async (imageId: string, observacao: string) => {
    const value = observacao.trim() || null
    await updateObraLousaObservacao(imageId, value)
    setImages(prev =>
      prev.map(i => (i.id === imageId ? { ...i, observacao: value } : i)),
    )
  }, [])

  const addStroke = useCallback(async (path: string, cor: string, strokeWidth: number) => {
    if (!obraId || !activeImageId) return null
    setSaving(true)
    try {
      const row = await insertObraLousaStroke({
        obraId,
        imageId: activeImageId,
        path,
        cor,
        strokeWidth,
      })
      setDrawings(prev => [...prev, row])
      return row
    } finally {
      setSaving(false)
    }
  }, [obraId, activeImageId])

  const addAnnotation = useCallback(async (
    annotation: WhiteboardAnnotation,
    cor: string,
    strokeWidth: number,
  ) => {
    if (!obraId || !activeImageId) return null
    setSaving(true)
    try {
      const row = await insertObraLousaAnnotation({
        obraId,
        imageId: activeImageId,
        annotation,
        cor,
        strokeWidth,
      })
      setDrawings(prev => [...prev, row])
      return row
    } finally {
      setSaving(false)
    }
  }, [obraId, activeImageId])

  const updateAnnotation = useCallback(async (
    drawingId: string,
    annotation: WhiteboardAnnotation,
    imageId: string,
  ) => {
    const path_data = encodeAnnotation(annotation, imageId)
    await updateObraLousaDrawing(drawingId, { path_data })
    setDrawings(prev =>
      prev.map(d => (d.id === drawingId ? { ...d, path_data } : d)),
    )
  }, [])

  const removeDrawing = useCallback(async (drawingId: string) => {
    await deleteObraLousaDrawing(drawingId)
    setDrawings(prev => prev.filter(d => d.id !== drawingId))
  }, [])

  const clearActiveDrawings = useCallback(async () => {
    if (!obraId || !activeImageId) return
    await clearObraLousaDrawingsForImage(obraId, activeImageId)
    setDrawings(prev => prev.filter(d => d.image_id !== activeImageId))
  }, [obraId, activeImageId])

  /**
   * Gera JPEG (foto + riscos), grava em Fotos e Documentos do card
   * e remove a foto da Lousa (sai da tela).
   */
  const exportToAnexos = useCallback(async () => {
    if (!obraId || !activeImage?.signedUrl) {
      throw new Error('Selecione uma foto da Lousa para salvar.')
    }
    setSaving(true)
    try {
      const blob = await exportObraLousaJpeg({
        imageUrl: activeImage.signedUrl,
        width: Number(activeImage.width) || 1280,
        height: Number(activeImage.height) || 720,
        drawings: activeDrawings,
      })
      const baseName = activeImage.file_name.replace(/\.[^.]+$/, '') || 'obra'
      const file = new File(
        [blob],
        `lousa-${baseName}.jpg`,
        { type: 'image/jpeg' },
      )
      const pending = await buildPendingObraArquivo(file)
      await uploadObraArquivo(obraId, pending)
      revokePendingObraArquivoUrl(pending)

      const exportedId = activeImage.id
      const remainingIds = images.filter(i => i.id !== exportedId).map(i => i.id)
      await deleteObraLousaImage(activeImage)
      setDrawings(prev => prev.filter(d => d.image_id !== exportedId))
      setImages(prev => prev.filter(i => i.id !== exportedId))
      setActiveImageId(prev => {
        if (prev !== exportedId) return prev
        return remainingIds[0] ?? null
      })
    } finally {
      setSaving(false)
    }
  }, [obraId, activeImage, activeDrawings, images])

  return {
    images,
    drawings,
    activeImageId,
    setActiveImageId,
    activeImage,
    activeDrawings,
    loading,
    uploading,
    saving,
    error,
    setError,
    reload: load,
    uploadImage,
    removeImage,
    saveObservacao,
    addStroke,
    addAnnotation,
    updateAnnotation,
    removeDrawing,
    clearActiveDrawings,
    exportToAnexos,
  }
}
