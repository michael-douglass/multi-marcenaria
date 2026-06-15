import { supabase } from '@/lib/supabase'
import { pdfAllPagesToPngBlobs } from '@/lib/pdf-to-image'
import { pdfPreviewPathAt, collectPreviewStoragePaths, resolveStoredPreviewPaths } from '@/lib/pdf-preview-storage'
import { videoFirstFrameToJpegBlob } from '@/lib/video-to-image'
import { createId } from '@/lib/utils'

export const EVOLUCAO_BUCKET = 'movelaria-obra-evolucao'

export interface ObraEvolucaoItem {
  id: string
  obra_id: string
  nome_arquivo: string
  tipo_mime: string
  kind: 'image' | 'pdf' | 'video'
  storage_path: string
  preview_path: string | null
  preview_paths?: string[] | null
  tirado_em: string
  criado_por: string | null
  criado_em: string
  observacao?: string | null
}

export interface EvolucaoPainelItem extends ObraEvolucaoItem {
  obra_nome: string
  criador_nome: string | null
}

export interface EvolucaoItemComUrl extends ObraEvolucaoItem {
  signedUrl: string | null
  previewSignedUrl: string | null
  previewSignedUrls?: string[]
}

export interface EvolucaoPainelItemComUrl extends EvolucaoPainelItem {
  signedUrl: string | null
  previewSignedUrl: string | null
  previewSignedUrls: string[]
}

export function isAcceptedEvolucaoFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  if (['image/jpeg','image/png','image/webp','image/gif','application/pdf'].includes(file.type)) return true
  if (file.type.startsWith('video/')) return true
  return (
    lower.endsWith('.pdf') ||
    /\.(jpe?g|png|webp|gif)$/.test(lower) ||
    /\.(mp4|webm|mov|avi|ogv|mpeg|mpg|m4v|3gp)$/.test(lower)
  )
}

export async function uploadObraEvolucao(
  obraId: string,
  file: File,
  observacao?: string | null,
): Promise<ObraEvolucaoItem> {
  const lower = file.name.toLowerCase()
  const isPdf   = file.type === 'application/pdf' || lower.endsWith('.pdf')
  const isVideo = !isPdf && (file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|ogv|mpeg|mpg|m4v|3gp)$/.test(lower))
  const arquivoId = createId()
  const ext = lower.split('.').pop() ?? (isVideo ? 'mp4' : 'jpg')
  const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const storagePath = `${obraId}/${now}_${arquivoId}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(EVOLUCAO_BUCKET)
    .upload(storagePath, file, { contentType: file.type || 'image/jpeg', upsert: false })
  if (upErr) throw new Error(upErr.message)

  let previewPath: string | null = null
  let previewPaths: string[] | null = null
  if (isPdf) {
    const blobs = await pdfAllPagesToPngBlobs(file)
    const basePrefix = `${obraId}/${now}_${arquivoId}`
    previewPaths = []
    for (let i = 0; i < blobs.length; i++) {
      const path = pdfPreviewPathAt(basePrefix, i + 1, 'suffix')
      await supabase.storage.from(EVOLUCAO_BUCKET).upload(path, blobs[i], {
        contentType: 'image/png', upsert: false,
      })
      previewPaths.push(path)
    }
    previewPath = previewPaths[0] ?? null
  } else if (isVideo) {
    const thumbBlob = await videoFirstFrameToJpegBlob(file).catch(() => null)
    if (thumbBlob) {
      previewPath = `${obraId}/${now}_${arquivoId}_preview.jpg`
      await supabase.storage.from(EVOLUCAO_BUCKET).upload(previewPath, thumbBlob, {
        contentType: 'image/jpeg', upsert: false,
      })
    }
  } else {
    previewPath = storagePath
  }

  const kind: 'image' | 'pdf' | 'video' = isPdf ? 'pdf' : isVideo ? 'video' : 'image'
  const obs = observacao?.trim() || null

  const { data: row, error: dbErr } = await supabase
    .from('movelaria_obra_evolucao')
    .insert({
      id: arquivoId,
      obra_id: obraId,
      nome_arquivo: file.name,
      tipo_mime: file.type || 'image/jpeg',
      kind,
      storage_path: storagePath,
      preview_path: previewPath,
      preview_paths: previewPaths,
      tirado_em: new Date().toISOString(),
      observacao: obs,
    })
    .select()
    .single()
  if (dbErr) throw new Error(dbErr.message)
  return row as ObraEvolucaoItem
}

export async function deleteObraEvolucao(item: ObraEvolucaoItem): Promise<void> {
  const paths = [item.storage_path, ...collectPreviewStoragePaths(item)]
  await supabase.storage.from(EVOLUCAO_BUCKET).remove([...new Set(paths)])
  const { error } = await supabase.from('movelaria_obra_evolucao').delete().eq('id', item.id)
  if (error) throw new Error(error.message)
}

export async function getEvolucaoUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(EVOLUCAO_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'URL indisponível')
  return data.signedUrl
}

const SIGNED_URL_BATCH = 25

type SignedUrlEntry = {
  path?: string
  signedUrl?: string | null
  signedURL?: string | null
  error?: string | null
}

function pickSignedUrl(entry: SignedUrlEntry): string | null {
  return entry.signedUrl ?? entry.signedURL ?? null
}

/** Assina vários caminhos em lotes; caminhos que falharem são tentados um a um. */
async function signEvolucaoPaths(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  const missing = new Set(unique)

  for (let i = 0; i < unique.length; i += SIGNED_URL_BATCH) {
    const chunk = unique.slice(i, i + SIGNED_URL_BATCH)
    const { data, error } = await supabase.storage
      .from(EVOLUCAO_BUCKET)
      .createSignedUrls(chunk, 3600)

    if (error) {
      console.warn('[obra-evolucao] Erro ao assinar URLs em lote:', error.message)
      continue
    }

    for (const entry of (data ?? []) as SignedUrlEntry[]) {
      const url = pickSignedUrl(entry)
      if (entry.path && url && !entry.error) {
        map.set(entry.path, url)
        missing.delete(entry.path)
      }
    }
  }

  if (missing.size > 0) {
    await Promise.all([...missing].map(async path => {
      try {
        const url = await getEvolucaoUrl(path)
        map.set(path, url)
      } catch {
        /* mantém ausente — UI mostra placeholder */
      }
    }))
  }

  return map
}

/** URL para miniatura na grade (preview ou arquivo original). */
export function evolucaoThumbUrl(item: {
  previewSignedUrl: string | null
  signedUrl: string | null
}): string | null {
  return item.previewSignedUrl ?? item.signedUrl ?? null
}

/** URL para visualização em tela cheia (PDF usa imagens convertidas). */
export function evolucaoLightboxPages(item: {
  kind: 'image' | 'pdf' | 'video'
  previewSignedUrls?: string[] | null
  previewSignedUrl: string | null
  signedUrl: string | null
}): string[] {
  if (item.kind === 'video') return item.signedUrl ? [item.signedUrl] : []
  if (item.previewSignedUrls?.length) return item.previewSignedUrls
  const one = evolucaoLightboxUrl(item)
  return one ? [one] : []
}

export function evolucaoLightboxUrl(item: {
  kind: 'image' | 'pdf' | 'video'
  previewSignedUrl: string | null
  signedUrl: string | null
}): string | null {
  if (item.kind === 'video') return item.signedUrl
  if (item.kind === 'pdf') return item.previewSignedUrl ?? item.signedUrl
  return item.signedUrl ?? item.previewSignedUrl
}

export async function listObraEvolucao(obraId: string): Promise<ObraEvolucaoItem[]> {
  const { data, error } = await supabase
    .from('movelaria_obra_evolucao')
    .select('*')
    .eq('obra_id', obraId)
    .order('tirado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ObraEvolucaoItem[]
}

async function addUrls<T extends ObraEvolucaoItem>(items: T[]): Promise<(T & { signedUrl: string | null; previewSignedUrl: string | null; previewSignedUrls: string[] })[]> {
  if (items.length === 0) return []

  const paths: string[] = []
  for (const item of items) {
    paths.push(item.storage_path)
    for (const p of resolveStoredPreviewPaths(item)) {
      if (p !== item.storage_path) paths.push(p)
    }
  }

  const urlMap = await signEvolucaoPaths(paths)

  return items.map(item => {
    const signedUrl = urlMap.get(item.storage_path) ?? null
    const previewPaths = resolveStoredPreviewPaths(item)
    const previewSignedUrls = previewPaths
      .map(p => urlMap.get(p) ?? null)
      .filter((u): u is string => !!u)
    const previewFromPath = previewSignedUrls[0] ?? null
    const previewSignedUrl =
      item.kind === 'image'
        ? signedUrl
        : previewFromPath ?? signedUrl

    return { ...item, signedUrl, previewSignedUrl, previewSignedUrls }
  })
}

export { addUrls as addEvolucaoUrls }

export interface EvolucaoDiaGrupo<T extends ObraEvolucaoItem = ObraEvolucaoItem> {
  diaNumero: number
  data: string
  fotos: T[]
}

function evolucaoDayMs(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).getTime()
}

function evolucaoDaysBetween(from: string, to: string): number {
  return Math.round((evolucaoDayMs(to) - evolucaoDayMs(from)) / 86_400_000)
}

/** Agrupa fotos de evolução por dia calendário, numerando Dia 01, 02… desde o início da obra. */
export function groupEvolucaoPorDia<T extends ObraEvolucaoItem>(
  items: T[],
  refInicio?: string | null,
): EvolucaoDiaGrupo<T>[] {
  if (items.length === 0) return []

  const ref =
    refInicio?.slice(0, 10) ??
    items.reduce((earliest, item) => {
      const d = item.tirado_em.slice(0, 10)
      return !earliest || d < earliest ? d : earliest
    }, '')

  const byDate = new Map<string, T[]>()
  for (const item of items) {
    const d = item.tirado_em.slice(0, 10)
    const list = byDate.get(d) ?? []
    list.push(item)
    byDate.set(d, list)
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, fotos]) => ({
      diaNumero: Math.max(1, evolucaoDaysBetween(ref, data) + 1),
      data,
      fotos: [...fotos].sort((a, b) => a.tirado_em.localeCompare(b.tirado_em)),
    }))
}
