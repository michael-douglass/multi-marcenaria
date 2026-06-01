import { supabase } from '@/lib/supabase'
import { pdfFirstPageToPngBlob } from '@/lib/pdf-to-image'
import { createId } from '@/lib/utils'

export const EVOLUCAO_BUCKET = 'movelaria-obra-evolucao'

export interface ObraEvolucaoItem {
  id: string
  obra_id: string
  nome_arquivo: string
  tipo_mime: string
  kind: 'image' | 'pdf'
  storage_path: string
  preview_path: string | null
  tirado_em: string
  criado_por: string | null
  criado_em: string
}

export interface EvolucaoPainelItem extends ObraEvolucaoItem {
  obra_nome: string
  criador_nome: string | null
}

export interface EvolucaoItemComUrl extends ObraEvolucaoItem {
  signedUrl: string | null
  previewSignedUrl: string | null
}

export interface EvolucaoPainelItemComUrl extends EvolucaoPainelItem {
  signedUrl: string | null
  previewSignedUrl: string | null
}

export function isAcceptedEvolucaoFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return (
    ['image/jpeg','image/png','image/webp','image/gif','application/pdf'].includes(file.type) ||
    lower.endsWith('.pdf') || /\.(jpe?g|png|webp|gif)$/.test(lower)
  )
}

export async function uploadObraEvolucao(
  obraId: string,
  file: File,
): Promise<ObraEvolucaoItem> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const arquivoId = createId()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const storagePath = `${obraId}/${now}_${arquivoId}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(EVOLUCAO_BUCKET)
    .upload(storagePath, file, { contentType: file.type || 'image/jpeg', upsert: false })
  if (upErr) throw new Error(upErr.message)

  let previewPath: string | null = null
  if (isPdf) {
    const blob = await pdfFirstPageToPngBlob(file)
    previewPath = `${obraId}/${now}_${arquivoId}_preview.png`
    await supabase.storage.from(EVOLUCAO_BUCKET).upload(previewPath, blob, {
      contentType: 'image/png', upsert: false,
    })
  } else {
    previewPath = storagePath
  }

  const { data: row, error: dbErr } = await supabase
    .from('movelaria_obra_evolucao')
    .insert({
      id: arquivoId,
      obra_id: obraId,
      nome_arquivo: file.name,
      tipo_mime: file.type || 'image/jpeg',
      kind: isPdf ? 'pdf' : 'image',
      storage_path: storagePath,
      preview_path: previewPath,
      tirado_em: new Date().toISOString(),
    })
    .select()
    .single()
  if (dbErr) throw new Error(dbErr.message)
  return row as ObraEvolucaoItem
}

export async function deleteObraEvolucao(item: ObraEvolucaoItem): Promise<void> {
  const paths = [item.storage_path]
  if (item.preview_path && item.preview_path !== item.storage_path) paths.push(item.preview_path)
  await supabase.storage.from(EVOLUCAO_BUCKET).remove(paths)
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

export async function listObraEvolucao(obraId: string): Promise<ObraEvolucaoItem[]> {
  const { data, error } = await supabase
    .from('movelaria_obra_evolucao')
    .select('*')
    .eq('obra_id', obraId)
    .order('tirado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ObraEvolucaoItem[]
}

async function addUrls<T extends ObraEvolucaoItem>(items: T[]): Promise<(T & { signedUrl: string | null; previewSignedUrl: string | null })[]> {
  return Promise.all(items.map(async item => {
    const [signedUrl, previewSignedUrl] = await Promise.all([
      getEvolucaoUrl(item.storage_path).catch(() => null),
      item.preview_path && item.preview_path !== item.storage_path
        ? getEvolucaoUrl(item.preview_path).catch(() => null)
        : Promise.resolve(null),
    ])
    return {
      ...item,
      signedUrl,
      previewSignedUrl: item.kind === 'image' ? signedUrl : previewSignedUrl,
    }
  }))
}

export { addUrls as addEvolucaoUrls }
