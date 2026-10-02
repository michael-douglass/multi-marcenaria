import { supabase } from '@/lib/supabase'
import { pdfAllPagesToPngBlobs } from '@/lib/pdf-to-image'
import {
  collectPreviewStoragePaths,
  pdfPreviewPathAt,
  resolveStoredPreviewPaths,
} from '@/lib/pdf-preview-storage'
import { createId } from '@/lib/utils'
import type { EscritorioArquivo, EscritorioPasta, PendingEscritorioArquivo } from '@/types'

export const ESCRITORIO_BUCKET = 'movelaria-escritorio-arquivos'
export const ESCRITORIO_MAX_BYTES = 80 * 1024 * 1024

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

export function isAcceptedEscritorioFile(file: File): boolean {
  if (ACCEPTED.includes(file.type)) return true
  const lower = file.name.toLowerCase()
  return lower.endsWith('.pdf') || /\.(jpe?g|png|webp|gif)$/.test(lower)
}

export async function buildPendingEscritorioArquivo(file: File): Promise<PendingEscritorioArquivo> {
  if (!isAcceptedEscritorioFile(file)) {
    throw new Error('Envie apenas imagem (JPG, PNG, WebP, GIF) ou PDF.')
  }
  if (file.size > ESCRITORIO_MAX_BYTES) {
    throw new Error('Arquivo muito grande. O limite é 80 MB por arquivo.')
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
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

  return {
    localId: createId(),
    file,
    nome: file.name,
    tipoMime: file.type || 'image/jpeg',
    kind: 'image',
    previewUrl: URL.createObjectURL(file),
  }
}

export function revokePendingEscritorioUrls(anexos: PendingEscritorioArquivo[]) {
  anexos.forEach(a => {
    const urls = a.previewUrls?.length ? a.previewUrls : a.previewUrl ? [a.previewUrl] : []
    urls.forEach(url => URL.revokeObjectURL(url))
  })
}

export async function listEscritorioPastas(): Promise<EscritorioPasta[]> {
  const { data: pastas, error } = await supabase
    .from('movelaria_escritorio_pastas')
    .select('*')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })
  if (error) throw new Error(error.message)

  const rows = (pastas ?? []) as EscritorioPasta[]
  if (rows.length === 0) return rows

  const { data: counts, error: countErr } = await supabase
    .from('movelaria_escritorio_arquivos')
    .select('pasta_id')
  if (countErr) throw new Error(countErr.message)

  const map = new Map<string, number>()
  for (const row of counts ?? []) {
    const id = (row as { pasta_id: string }).pasta_id
    map.set(id, (map.get(id) ?? 0) + 1)
  }

  return rows.map(p => ({ ...p, qtd_arquivos: map.get(p.id) ?? 0 }))
}

export async function createEscritorioPasta(nome: string, descricao?: string): Promise<EscritorioPasta> {
  const trimmed = nome.trim()
  if (!trimmed) throw new Error('Informe o nome da pasta.')

  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('movelaria_escritorio_pastas')
    .insert({
      nome: trimmed,
      descricao: descricao?.trim() || null,
      criado_por: userData.user?.id ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return { ...(data as EscritorioPasta), qtd_arquivos: 0 }
}

export async function renameEscritorioPasta(id: string, nome: string): Promise<void> {
  const trimmed = nome.trim()
  if (!trimmed) throw new Error('Informe o nome da pasta.')
  const { error } = await supabase
    .from('movelaria_escritorio_pastas')
    .update({ nome: trimmed, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteEscritorioPasta(pasta: EscritorioPasta): Promise<void> {
  const arquivos = await listEscritorioArquivos(pasta.id)
  for (const arq of arquivos) {
    await deleteEscritorioArquivo(arq)
  }
  const { error } = await supabase
    .from('movelaria_escritorio_pastas')
    .delete()
    .eq('id', pasta.id)
  if (error) throw new Error(error.message)
}

export async function listEscritorioArquivos(pastaId: string): Promise<EscritorioArquivo[]> {
  const { data, error } = await supabase
    .from('movelaria_escritorio_arquivos')
    .select('*')
    .eq('pasta_id', pastaId)
    .order('criado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as EscritorioArquivo[]
}

async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout ao gerar URL do arquivo')), 8000),
  )
  const result = await Promise.race([
    supabase.storage.from(ESCRITORIO_BUCKET).createSignedUrl(path, expiresIn),
    timeout,
  ])
  if (result.error || !result.data?.signedUrl) {
    throw new Error(result.error?.message ?? 'URL indisponível')
  }
  return result.data.signedUrl
}

export async function getEscritorioPreviewUrls(arquivo: EscritorioArquivo): Promise<string[]> {
  const paths = resolveStoredPreviewPaths(arquivo)
  const targetPaths = paths.length ? paths : [arquivo.storage_path]
  const urls: string[] = []
  for (const path of targetPaths) {
    try {
      urls.push(await getSignedUrl(path))
    } catch {
      /* ignora página indisponível */
    }
  }
  return urls
}

export async function uploadEscritorioArquivo(
  pastaId: string,
  anexo: PendingEscritorioArquivo,
): Promise<EscritorioArquivo> {
  const arquivoId = createId()
  const ext = anexo.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const storagePath = `${pastaId}/${arquivoId}/original.${ext}`

  const { error: upErr } = await supabase.storage
    .from(ESCRITORIO_BUCKET)
    .upload(storagePath, anexo.file, { contentType: anexo.tipoMime, upsert: false })
  if (upErr) throw new Error(upErr.message)

  let previewPath: string | null = null
  let previewPaths: string[] | null = null
  if (anexo.kind === 'pdf' && anexo.previewBlobs?.length) {
    const basePrefix = `${pastaId}/${arquivoId}`
    previewPaths = []
    for (let i = 0; i < anexo.previewBlobs.length; i++) {
      const path = pdfPreviewPathAt(basePrefix, i + 1, 'folder')
      const { error: prevErr } = await supabase.storage
        .from(ESCRITORIO_BUCKET)
        .upload(path, anexo.previewBlobs[i], { contentType: 'image/png', upsert: false })
      if (prevErr) throw new Error(prevErr.message)
      previewPaths.push(path)
    }
    previewPath = previewPaths[0] ?? null
  } else if (anexo.kind === 'image') {
    previewPath = storagePath
  }

  const { data: userData } = await supabase.auth.getUser()
  const { data, error: dbErr } = await supabase
    .from('movelaria_escritorio_arquivos')
    .insert({
      id: arquivoId,
      pasta_id: pastaId,
      nome_arquivo: anexo.nome,
      tipo_mime: anexo.tipoMime,
      storage_path: storagePath,
      preview_path: previewPath,
      preview_paths: previewPaths,
      kind: anexo.kind,
      criado_por: userData.user?.id ?? null,
    })
    .select()
    .single()
  if (dbErr) throw new Error(dbErr.message)
  return data as EscritorioArquivo
}

export async function deleteEscritorioArquivo(arquivo: EscritorioArquivo): Promise<void> {
  const paths = [arquivo.storage_path, ...collectPreviewStoragePaths(arquivo)]
  const { error: stErr } = await supabase.storage.from(ESCRITORIO_BUCKET).remove([...new Set(paths)])
  if (stErr) throw new Error(stErr.message)

  const { error: dbErr } = await supabase
    .from('movelaria_escritorio_arquivos')
    .delete()
    .eq('id', arquivo.id)
  if (dbErr) throw new Error(dbErr.message)
}
