import { supabase } from '@/lib/supabase'
import { pdfAllPagesToPngBlobs } from '@/lib/pdf-to-image'
import { pdfPreviewPathAt, collectPreviewStoragePaths, resolveStoredPreviewPaths } from '@/lib/pdf-preview-storage'
import { videoFirstFrameToJpegBlob } from '@/lib/video-to-image'
import { createId } from '@/lib/utils'
import type { ObraBriefingAnexo } from '@/types'

export const BRIEFING_BUCKET = 'movelaria-obra-briefing'

const ACCEPTED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ACCEPTED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/ogg', 'video/mpeg']
const ACCEPTED = [...ACCEPTED_IMAGES, 'application/pdf', ...ACCEPTED_VIDEO]

export interface PendingBriefingAnexo {
  localId: string
  file: File
  nome: string
  tipoMime: string
  kind: 'image' | 'pdf' | 'video' | 'drawing'
  previewUrl: string
  previewUrls?: string[]
  previewBlobs?: Blob[]
  previewBlob?: Blob
}

export function isAcceptedBriefingFile(file: File): boolean {
  if (ACCEPTED.includes(file.type)) return true
  if (file.type.startsWith('video/')) return true
  const lower = file.name.toLowerCase()
  return (
    lower.endsWith('.pdf') ||
    /\.(jpe?g|png|webp|gif)$/.test(lower) ||
    /\.(mp4|webm|mov|avi|ogv|mpeg|mpg|m4v|3gp)$/.test(lower)
  )
}

export async function buildPendingBriefingAnexo(file: File): Promise<PendingBriefingAnexo> {
  if (!isAcceptedBriefingFile(file)) {
    throw new Error('Envie apenas imagem (JPG, PNG, WebP), PDF ou vídeo.')
  }
  const lower = file.name.toLowerCase()
  const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf')
  const isVideo = !isPdf && (file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|ogv|mpeg|mpg|m4v|3gp)$/.test(lower))

  if (isPdf) {
    const previewBlobs = await pdfAllPagesToPngBlobs(file)
    const previewUrls = previewBlobs.map(blob => URL.createObjectURL(blob))
    return {
      localId: createId(),
      file,
      nome: file.name,
      tipoMime: file.type || 'application/pdf',
      kind: 'pdf',
      previewUrl: previewUrls[0] ?? '',
      previewUrls,
      previewBlobs,
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

export function buildPendingDrawingAnexo(blob: Blob, nome = 'desenho.png'): PendingBriefingAnexo {
  const file = new File([blob], nome, { type: 'image/png' })
  return {
    localId: createId(),
    file,
    nome,
    tipoMime: 'image/png',
    kind: 'drawing',
    previewUrl: URL.createObjectURL(blob),
  }
}

export function revokePendingBriefingAnexo(pending: PendingBriefingAnexo): void {
  const urls = pending.previewUrls?.length
    ? pending.previewUrls
    : pending.previewUrl
      ? [pending.previewUrl]
      : []
  urls.forEach(url => URL.revokeObjectURL(url))
}

export function briefingAnexoLightboxPages(anexo: {
  kind: ObraBriefingAnexo['kind']
  signedUrl?: string | null
  previewSignedUrl?: string | null
  previewSignedUrls?: string[] | null
}): string[] {
  if (anexo.kind === 'video') return anexo.signedUrl ? [anexo.signedUrl] : []
  if (anexo.previewSignedUrls?.length) return anexo.previewSignedUrls
  const one = briefingAnexoLightboxUrl(anexo)
  return one ? [one] : []
}

export function briefingAnexoLightboxUrl(anexo: {
  kind: ObraBriefingAnexo['kind']
  signedUrl?: string | null
  previewSignedUrl?: string | null
}): string | null {
  if (anexo.kind === 'video') return anexo.signedUrl ?? null
  if (anexo.kind === 'pdf') return anexo.previewSignedUrl ?? anexo.signedUrl ?? null
  return anexo.signedUrl ?? anexo.previewSignedUrl ?? null
}

export async function uploadBriefingAnexo(
  obraId: string,
  briefingId: string,
  respostaId: string,
  pending: PendingBriefingAnexo,
  ordem = 0,
): Promise<ObraBriefingAnexo> {
  const anexoId = createId()
  const ext = pending.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const storagePath = `${obraId}/${briefingId}/${respostaId}/${anexoId}/original.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BRIEFING_BUCKET)
    .upload(storagePath, pending.file, { contentType: pending.tipoMime, upsert: false })
  if (upErr) throw new Error(upErr.message)

  let previewPath: string | null = null
  let previewPaths: string[] | null = null
  const basePrefix = `${obraId}/${briefingId}/${respostaId}/${anexoId}`

  if (pending.kind === 'pdf' && pending.previewBlobs?.length) {
    previewPaths = []
    for (let i = 0; i < pending.previewBlobs.length; i++) {
      const path = pdfPreviewPathAt(basePrefix, i + 1, 'folder')
      const { error: pvErr } = await supabase.storage
        .from(BRIEFING_BUCKET)
        .upload(path, pending.previewBlobs[i], { contentType: 'image/png', upsert: false })
      if (pvErr) throw new Error(pvErr.message)
      previewPaths.push(path)
    }
    previewPath = previewPaths[0] ?? null
  } else if (pending.kind === 'video' && pending.previewBlob) {
    previewPath = `${basePrefix}/preview.jpg`
    const { error: pvErr } = await supabase.storage
      .from(BRIEFING_BUCKET)
      .upload(previewPath, pending.previewBlob, { contentType: 'image/jpeg', upsert: false })
    if (pvErr) throw new Error(pvErr.message)
  } else if (pending.kind === 'image' || pending.kind === 'drawing') {
    previewPath = storagePath
  }

  const { data: row, error: dbErr } = await supabase
    .from('movelaria_obra_briefing_anexos')
    .insert({
      id: anexoId,
      resposta_id: respostaId,
      nome_arquivo: pending.nome,
      tipo_mime: pending.tipoMime,
      kind: pending.kind,
      storage_path: storagePath,
      preview_path: previewPath,
      preview_paths: previewPaths,
      ordem,
    })
    .select()
    .single()
  if (dbErr) throw new Error(dbErr.message)
  return row as ObraBriefingAnexo
}

export async function deleteBriefingAnexo(anexo: ObraBriefingAnexo): Promise<void> {
  const paths = [anexo.storage_path, ...collectPreviewStoragePaths(anexo)]
  await supabase.storage.from(BRIEFING_BUCKET).remove([...new Set(paths)])
  const { error } = await supabase.from('movelaria_obra_briefing_anexos').delete().eq('id', anexo.id)
  if (error) throw new Error(error.message)
}

export async function replaceBriefingDrawingFile(
  anexo: ObraBriefingAnexo,
  file: File,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BRIEFING_BUCKET)
    .upload(anexo.storage_path, file, { contentType: file.type || 'image/png', upsert: true })
  if (error) throw new Error(error.message)
}

export async function getBriefingAnexoUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BRIEFING_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'URL indisponível')
  return data.signedUrl
}

export async function enrichBriefingAnexos(anexos: ObraBriefingAnexo[]): Promise<ObraBriefingAnexo[]> {
  return Promise.all(
    anexos.map(async anexo => {
      const signedUrl = await getBriefingAnexoUrl(anexo.storage_path).catch(() => null)
      const previewPaths = resolveStoredPreviewPaths(anexo)
      const previewSignedUrls = previewPaths.length
        ? await Promise.all(previewPaths.map(p => getBriefingAnexoUrl(p).catch(() => null)))
        : []
      const previewSignedUrl = previewSignedUrls[0] ?? (anexo.preview_path
        ? await getBriefingAnexoUrl(anexo.preview_path).catch(() => null)
        : null)
      return {
        ...anexo,
        signedUrl,
        previewSignedUrl,
        previewSignedUrls: previewSignedUrls.filter(Boolean) as string[],
      }
    }),
  )
}
