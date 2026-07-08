import { supabase } from '@/lib/supabase'
import { pdfAllPagesToPngBlobs } from '@/lib/pdf-to-image'
import { pdfPreviewPathAt } from '@/lib/pdf-preview-storage'
import { createId } from '@/lib/utils'
import { atualizarFotoPerfilPath } from '@/lib/meu-perfil-api'
import type { FuncionarioDocumento, PendingFuncionarioDocumento } from '@/types'

export const FUNCIONARIO_DOCS_BUCKET = 'movelaria-funcionario-documentos'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

export function isAcceptedFuncionarioFile(file: File): boolean {
  if (ACCEPTED.includes(file.type)) return true
  const lower = file.name.toLowerCase()
  return lower.endsWith('.pdf') || /\.(jpe?g|png|webp|gif)$/.test(lower)
}

export async function buildPendingFuncionarioDoc(
  file: File,
  tipoDocumento: string,
  categoria: FuncionarioDocumento['categoria'] = 'rh',
): Promise<PendingFuncionarioDocumento> {
  if (!isAcceptedFuncionarioFile(file)) {
    throw new Error('Envie apenas imagem (JPG, PNG, WebP, GIF) ou PDF.')
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
      tipoDocumento,
      categoria,
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
    tipoDocumento,
    categoria,
    previewUrl: URL.createObjectURL(file),
  }
}

export function revokePendingFuncionarioDocUrls(anexos: PendingFuncionarioDocumento[]) {
  anexos.forEach(a => {
    const urls = a.previewUrls?.length ? a.previewUrls : a.previewUrl ? [a.previewUrl] : []
    urls.forEach(url => URL.revokeObjectURL(url))
  })
}

export async function uploadFuncionarioDocumento(
  funcionarioId: string,
  anexo: PendingFuncionarioDocumento,
  origem: FuncionarioDocumento['origem'] = 'admin',
): Promise<FuncionarioDocumento> {
  const docId = createId()
  const ext = anexo.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const storagePath = `${funcionarioId}/${docId}/original.${ext}`

  const { error: upErr } = await supabase.storage
    .from(FUNCIONARIO_DOCS_BUCKET)
    .upload(storagePath, anexo.file, { contentType: anexo.tipoMime, upsert: false })
  if (upErr) throw new Error(upErr.message)

  let previewPath: string | null = null
  let previewPaths: string[] | null = null

  if (anexo.kind === 'pdf' && anexo.previewBlobs?.length) {
    const basePrefix = `${funcionarioId}/${docId}`
    previewPaths = []
    for (let i = 0; i < anexo.previewBlobs.length; i++) {
      const path = pdfPreviewPathAt(basePrefix, i + 1, 'folder')
      const { error: prevErr } = await supabase.storage
        .from(FUNCIONARIO_DOCS_BUCKET)
        .upload(path, anexo.previewBlobs[i], { contentType: 'image/png', upsert: false })
      if (prevErr) throw new Error(prevErr.message)
      previewPaths.push(path)
    }
    previewPath = previewPaths[0] ?? null
  } else if (anexo.kind === 'image') {
    previewPath = storagePath
  }

  const { data, error: dbErr } = await supabase
    .from('movelaria_funcionario_documentos')
    .insert({
      id: docId,
      funcionario_id: funcionarioId,
      categoria: anexo.categoria,
      tipo_documento: anexo.tipoDocumento,
      nome_arquivo: anexo.nome,
      tipo_mime: anexo.tipoMime,
      storage_path: storagePath,
      preview_path: previewPath,
      preview_paths: previewPaths,
      kind: anexo.kind,
      origem,
    })
    .select()
    .single()
  if (dbErr) throw new Error(dbErr.message)
  return data as FuncionarioDocumento
}

export async function uploadFotoPerfil(funcionarioId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Envie uma imagem (JPG, PNG ou WebP).')
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const storagePath = `${funcionarioId}/perfil/foto.${ext}`

  const { error: upErr } = await supabase.storage
    .from(FUNCIONARIO_DOCS_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: true })
  if (upErr) throw new Error(upErr.message)

  await atualizarFotoPerfilPath(storagePath)
  return storagePath
}

export async function listFuncionarioDocumentos(funcionarioId: string): Promise<FuncionarioDocumento[]> {
  const { data, error } = await supabase
    .from('movelaria_funcionario_documentos')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .order('criado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as FuncionarioDocumento[]
}

export async function getFuncionarioDocSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(FUNCIONARIO_DOCS_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'URL indisponível')
  return data.signedUrl
}

export async function deleteFuncionarioDocumento(doc: FuncionarioDocumento): Promise<void> {
  const paths = [doc.storage_path]
  if (doc.preview_path && doc.preview_path !== doc.storage_path) paths.push(doc.preview_path)
  if (Array.isArray(doc.preview_paths)) paths.push(...doc.preview_paths)

  await supabase.storage.from(FUNCIONARIO_DOCS_BUCKET).remove([...new Set(paths)])

  const { error } = await supabase
    .from('movelaria_funcionario_documentos')
    .delete()
    .eq('id', doc.id)
  if (error) throw new Error(error.message)
}

export async function uploadReciboAssinado(
  funcionarioId: string,
  reciboId: string,
  blob: Blob,
): Promise<string> {
  const storagePath = `${funcionarioId}/recibos/${reciboId}/assinado.png`
  const { error } = await supabase.storage
    .from(FUNCIONARIO_DOCS_BUCKET)
    .upload(storagePath, blob, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(error.message)
  return storagePath
}
