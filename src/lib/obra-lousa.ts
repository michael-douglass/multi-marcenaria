import { supabase } from '@/lib/supabase'
import { createId } from '@/lib/utils'
import {
  encodeAnnotation,
  encodeStroke,
  parsePathData,
  type WhiteboardAnnotation,
} from '@/lib/obra-lousa-annotations'

export const OBRA_LOUSA_BUCKET = 'movelaria-obra-lousa'
export const OBRA_LOUSA_MAX_BYTES = 100 * 1024 * 1024 // 100 MB

const ACCEPTED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']

export interface ObraLousaImage {
  id: string
  obra_id: string
  file_url: string
  file_name: string
  tipo_mime: string
  width: number | null
  height: number | null
  z_index: number
  observacao: string | null
  criado_por: string | null
  criado_em: string
  atualizado_em: string
}

export interface ObraLousaDrawing {
  id: string
  obra_id: string
  image_id: string | null
  path_data: string
  cor: string
  stroke_width: number
  criado_por: string | null
  criado_em: string
}

export interface ObraLousaImageWithUrl extends ObraLousaImage {
  signedUrl: string | null
}

export function isAcceptedLousaImage(file: File): boolean {
  if (ACCEPTED_IMAGES.includes(file.type)) return true
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)
}

export function assertLousaFileSize(file: File): void {
  if (file.size > OBRA_LOUSA_MAX_BYTES) {
    throw new Error('Arquivo muito grande. O limite da Lousa é 100 MB por arquivo.')
  }
}

function loadImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const size = { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height }
      URL.revokeObjectURL(url)
      resolve(size)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler as dimensões da imagem.'))
    }
    img.src = url
  })
}

export async function listObraLousaImages(obraId: string): Promise<ObraLousaImage[]> {
  const { data, error } = await supabase
    .from('movelaria_obra_lousa_images')
    .select('*')
    .eq('obra_id', obraId)
    .order('z_index', { ascending: true })
    .order('criado_em', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ObraLousaImage[]
}

export async function listObraLousaDrawings(obraId: string): Promise<ObraLousaDrawing[]> {
  const { data, error } = await supabase
    .from('movelaria_obra_lousa_drawings')
    .select('*')
    .eq('obra_id', obraId)
    .order('criado_em', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ObraLousaDrawing[]
}

export async function getObraLousaSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(OBRA_LOUSA_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'URL indisponível')
  return data.signedUrl
}

export async function uploadObraLousaImage(
  obraId: string,
  file: File,
  zIndex = 0,
): Promise<ObraLousaImage> {
  if (!isAcceptedLousaImage(file)) {
    throw new Error('Envie apenas imagens (JPG, PNG, WebP, GIF ou HEIC).')
  }
  assertLousaFileSize(file)

  const imageId = createId()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const storagePath = `${obraId}/${imageId}.${ext}`
  const tipoMime = file.type || 'image/jpeg'

  let width: number | null = null
  let height: number | null = null
  try {
    const size = await loadImageSize(file)
    width = size.width
    height = size.height
  } catch {
    // dimensões opcionais
  }

  const { error: upErr } = await supabase.storage
    .from(OBRA_LOUSA_BUCKET)
    .upload(storagePath, file, { contentType: tipoMime, upsert: false })
  if (upErr) throw new Error(upErr.message)

  const { data: row, error: dbErr } = await supabase
    .from('movelaria_obra_lousa_images')
    .insert({
      id: imageId,
      obra_id: obraId,
      file_url: storagePath,
      file_name: file.name,
      tipo_mime: tipoMime,
      width,
      height,
      z_index: zIndex,
      observacao: null,
    })
    .select()
    .single()

  if (dbErr) {
    await supabase.storage.from(OBRA_LOUSA_BUCKET).remove([storagePath])
    throw new Error(dbErr.message)
  }

  return row as ObraLousaImage
}

export async function updateObraLousaObservacao(
  imageId: string,
  observacao: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('movelaria_obra_lousa_images')
    .update({ observacao, atualizado_em: new Date().toISOString() })
    .eq('id', imageId)
  if (error) throw new Error(error.message)
}

export async function deleteObraLousaImage(image: ObraLousaImage): Promise<void> {
  await supabase.storage.from(OBRA_LOUSA_BUCKET).remove([image.file_url])
  const { error } = await supabase
    .from('movelaria_obra_lousa_images')
    .delete()
    .eq('id', image.id)
  if (error) throw new Error(error.message)
}

export async function insertObraLousaStroke(input: {
  obraId: string
  imageId: string
  path: string
  cor: string
  strokeWidth: number
}): Promise<ObraLousaDrawing> {
  const pathData = encodeStroke(input.path, input.imageId)
  const { data, error } = await supabase
    .from('movelaria_obra_lousa_drawings')
    .insert({
      obra_id: input.obraId,
      image_id: input.imageId,
      path_data: pathData,
      cor: input.cor,
      stroke_width: input.strokeWidth,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ObraLousaDrawing
}

export async function insertObraLousaAnnotation(input: {
  obraId: string
  imageId: string
  annotation: WhiteboardAnnotation
  cor: string
  strokeWidth: number
}): Promise<ObraLousaDrawing> {
  const pathData = encodeAnnotation(input.annotation, input.imageId)
  const { data, error } = await supabase
    .from('movelaria_obra_lousa_drawings')
    .insert({
      obra_id: input.obraId,
      image_id: input.imageId,
      path_data: pathData,
      cor: input.cor,
      stroke_width: input.strokeWidth,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ObraLousaDrawing
}

export async function updateObraLousaDrawing(
  drawingId: string,
  patch: Partial<Pick<ObraLousaDrawing, 'path_data' | 'cor' | 'stroke_width'>>,
): Promise<void> {
  const { error } = await supabase
    .from('movelaria_obra_lousa_drawings')
    .update(patch)
    .eq('id', drawingId)
  if (error) throw new Error(error.message)
}

export async function deleteObraLousaDrawing(drawingId: string): Promise<void> {
  const { error } = await supabase
    .from('movelaria_obra_lousa_drawings')
    .delete()
    .eq('id', drawingId)
  if (error) throw new Error(error.message)
}

export async function clearObraLousaDrawingsForImage(
  obraId: string,
  imageId: string,
): Promise<void> {
  const { error } = await supabase
    .from('movelaria_obra_lousa_drawings')
    .delete()
    .eq('obra_id', obraId)
    .eq('image_id', imageId)
  if (error) throw new Error(error.message)
}

export function drawingsForImage(
  drawings: ObraLousaDrawing[],
  imageId: string,
): ObraLousaDrawing[] {
  return drawings.filter(d => {
    if (d.image_id === imageId) return true
    const parsed = parsePathData(d.path_data)
    return parsed?.imageId === imageId
  })
}
