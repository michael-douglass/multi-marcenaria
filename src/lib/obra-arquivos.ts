import { supabase } from '@/lib/supabase'
import { pdfFirstPageToPngBlob } from '@/lib/pdf-to-image'
import { videoFirstFrameToJpegBlob } from '@/lib/video-to-image'
import { createId } from '@/lib/utils'

export const OBRA_ARQUIVOS_BUCKET = 'movelaria-obra-arquivos'

const ACCEPTED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ACCEPTED_VIDEO  = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/ogg', 'video/mpeg']
const ACCEPTED = [...ACCEPTED_IMAGES, 'application/pdf', ...ACCEPTED_VIDEO]

export interface ObraArquivo {
  id: string
  obra_id: string
  nome_arquivo: string
  tipo_mime: string
  kind: 'image' | 'pdf' | 'video'
  storage_path: string
  preview_path: string | null
  criado_por: string | null
  criado_em: string
}

export interface PendingObraArquivo {
  localId: string
  file: File
  nome: string
  tipoMime: string
  kind: 'image' | 'pdf' | 'video'
  previewUrl: string
  previewBlob?: Blob
}

export function isAcceptedObraFile(file: File): boolean {
  if (ACCEPTED.includes(file.type)) return true
  if (file.type.startsWith('video/')) return true
  const lower = file.name.toLowerCase()
  return (
    lower.endsWith('.pdf') ||
    /\.(jpe?g|png|webp|gif)$/.test(lower) ||
    /\.(mp4|webm|mov|avi|ogv|mpeg|mpg|m4v|3gp)$/.test(lower)
  )
}

export async function buildPendingObraArquivo(file: File): Promise<PendingObraArquivo> {
  if (!isAcceptedObraFile(file)) {
    throw new Error('Envie apenas imagem (JPG, PNG, WebP), PDF ou vídeo.')
  }
  const lower = file.name.toLowerCase()
  const isPdf   = file.type === 'application/pdf' || lower.endsWith('.pdf')
  const isVideo = !isPdf && (file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|ogv|mpeg|mpg|m4v|3gp)$/.test(lower))

  if (isPdf) {
    const previewBlob = await pdfFirstPageToPngBlob(file)
    return {
      localId: createId(),
      file,
      nome: file.name,
      tipoMime: file.type || 'application/pdf',
      kind: 'pdf',
      previewUrl: URL.createObjectURL(previewBlob),
      previewBlob,
    }
  }

  if (isVideo) {
    const previewBlob = await videoFirstFrameToJpegBlob(file).catch(() => null)
    return {
      localId: createId(),
      file,
      nome: file.name,
      tipoMime: file.type || 'video/mp4',
      kind: 'video',
      previewUrl: previewBlob ? URL.createObjectURL(previewBlob) : '',
      previewBlob: previewBlob ?? undefined,
    }
  }

  return {
    localId: createId(),
    file,
    nome: file.name,
    tipoMime: file.type || 'image/jpeg',
    kind: 'image',
    previewUrl: URL.createObjectURL(file),
  }
}

export function revokePendingObraArquivoUrl(pending: PendingObraArquivo): void {
  if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl)
}

export function obraArquivoLightboxUrl(arq: {
  kind: 'image' | 'pdf' | 'video'
  signedUrl: string | null
  previewSignedUrl: string | null
}): string | null {
  if (arq.kind === 'video') return arq.signedUrl
  if (arq.kind === 'pdf') return arq.previewSignedUrl ?? arq.signedUrl
  return arq.signedUrl ?? arq.previewSignedUrl
}

export async function uploadObraArquivo(
  obraId: string,
  pending: PendingObraArquivo,
): Promise<ObraArquivo> {
  const arquivoId = createId()
  const ext = pending.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const storagePath = `${obraId}/${arquivoId}/original.${ext}`

  const { error: upErr } = await supabase.storage
    .from(OBRA_ARQUIVOS_BUCKET)
    .upload(storagePath, pending.file, { contentType: pending.tipoMime, upsert: false })
  if (upErr) throw new Error(upErr.message)

  let previewPath: string | null = null
  if ((pending.kind === 'pdf' || pending.kind === 'video') && pending.previewBlob) {
    const previewExt = pending.kind === 'video' ? 'jpg' : 'png'
    const previewMime = pending.kind === 'video' ? 'image/jpeg' : 'image/png'
    previewPath = `${obraId}/${arquivoId}/preview.${previewExt}`
    const { error: pvErr } = await supabase.storage
      .from(OBRA_ARQUIVOS_BUCKET)
      .upload(previewPath, pending.previewBlob, { contentType: previewMime, upsert: false })
    if (pvErr) throw new Error(pvErr.message)
  } else if (pending.kind === 'image') {
    previewPath = storagePath
  }

  const { data: row, error: dbErr } = await supabase
    .from('movelaria_obra_arquivos')
    .insert({
      id: arquivoId,
      obra_id: obraId,
      nome_arquivo: pending.nome,
      tipo_mime: pending.tipoMime,
      kind: pending.kind,
      storage_path: storagePath,
      preview_path: previewPath,
    })
    .select()
    .single()
  if (dbErr) throw new Error(dbErr.message)
  return row as ObraArquivo
}

export async function deleteObraArquivo(arq: ObraArquivo): Promise<void> {
  const paths = [arq.storage_path]
  if (arq.preview_path && arq.preview_path !== arq.storage_path) paths.push(arq.preview_path)
  await supabase.storage.from(OBRA_ARQUIVOS_BUCKET).remove(paths)
  const { error } = await supabase.from('movelaria_obra_arquivos').delete().eq('id', arq.id)
  if (error) throw new Error(error.message)
}

export async function getObraArquivoUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(OBRA_ARQUIVOS_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'URL indisponível')
  return data.signedUrl
}

export async function listObraArquivos(obraId: string): Promise<ObraArquivo[]> {
  const { data, error } = await supabase
    .from('movelaria_obra_arquivos')
    .select('*')
    .eq('obra_id', obraId)
    .order('criado_em', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ObraArquivo[]
}
