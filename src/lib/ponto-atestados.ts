import { supabase } from '@/lib/supabase'
import { pdfAllPagesToPngBlobs } from '@/lib/pdf-to-image'
import {
  collectPreviewStoragePaths,
  pdfPreviewPathAt,
  resolveStoredPreviewPaths,
} from '@/lib/pdf-preview-storage'
import { FUNCIONARIO_DOCS_BUCKET, isAcceptedFuncionarioFile } from '@/lib/funcionario-documentos'
import { createId } from '@/lib/utils'
import type { PontoAtestado, PendingPontoAtestado } from '@/types'

export const PONTO_ATESTADO_MAX_BYTES = 80 * 1024 * 1024

export async function buildPendingPontoAtestado(file: File): Promise<PendingPontoAtestado> {
  if (!isAcceptedFuncionarioFile(file)) {
    throw new Error('Envie apenas imagem (JPG, PNG, WebP, GIF) ou PDF.')
  }
  if (file.size > PONTO_ATESTADO_MAX_BYTES) {
    throw new Error('Arquivo muito grande. O limite é 80 MB.')
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

export function revokePendingPontoAtestadoUrls(anexos: PendingPontoAtestado[]) {
  anexos.forEach(a => {
    const urls = a.previewUrls?.length ? a.previewUrls : a.previewUrl ? [a.previewUrl] : []
    urls.forEach(url => URL.revokeObjectURL(url))
  })
}

export async function listPontoAtestadosDia(
  funcionarioId: string,
  data: string,
): Promise<PontoAtestado[]> {
  const { data: rows, error } = await supabase
    .from('movelaria_funcionario_ponto_atestados')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .eq('data', data)
    .order('criado_em', { ascending: true })
  if (error) throw new Error(error.message)
  return (rows ?? []) as PontoAtestado[]
}

export async function listPontoAtestadosPeriodo(
  funcionarioId: string,
  inicio: string,
  fim: string,
): Promise<PontoAtestado[]> {
  const { data: rows, error } = await supabase
    .from('movelaria_funcionario_ponto_atestados')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: true })
    .order('criado_em', { ascending: true })
  if (error) throw new Error(error.message)
  return (rows ?? []) as PontoAtestado[]
}

/** Contagens por funcionario_id|data para o período (enriquece o resumo). */
export async function countPontoAtestadosPorDia(
  funcionarioIds: string[],
  inicio: string,
  fim: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (funcionarioIds.length === 0) return map

  const { data: rows, error } = await supabase
    .from('movelaria_funcionario_ponto_atestados')
    .select('funcionario_id, data')
    .in('funcionario_id', funcionarioIds)
    .gte('data', inicio)
    .lte('data', fim)
  if (error) throw new Error(error.message)

  for (const row of rows ?? []) {
    const r = row as { funcionario_id: string; data: string }
    const key = `${r.funcionario_id}|${r.data}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(FUNCIONARIO_DOCS_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'URL indisponível')
  return data.signedUrl
}

export async function getPontoAtestadoPreviewUrls(atestado: PontoAtestado): Promise<string[]> {
  const paths = resolveStoredPreviewPaths(atestado)
  const targetPaths = paths.length ? paths : [atestado.storage_path]
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

export async function uploadPontoAtestado(
  funcionarioId: string,
  data: string,
  anexo: PendingPontoAtestado,
): Promise<PontoAtestado> {
  const id = createId()
  const ext = anexo.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const storagePath = `${funcionarioId}/atestados/${data}/${id}/original.${ext}`

  const { error: upErr } = await supabase.storage
    .from(FUNCIONARIO_DOCS_BUCKET)
    .upload(storagePath, anexo.file, { contentType: anexo.tipoMime, upsert: false })
  if (upErr) throw new Error(upErr.message)

  let previewPath: string | null = null
  let previewPaths: string[] | null = null
  if (anexo.kind === 'pdf' && anexo.previewBlobs?.length) {
    const basePrefix = `${funcionarioId}/atestados/${data}/${id}`
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

  const { data: userData } = await supabase.auth.getUser()
  const { data: row, error: dbErr } = await supabase
    .from('movelaria_funcionario_ponto_atestados')
    .insert({
      id,
      funcionario_id: funcionarioId,
      data,
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
  return row as PontoAtestado
}

export async function deletePontoAtestado(atestado: PontoAtestado): Promise<void> {
  const paths = [atestado.storage_path, ...collectPreviewStoragePaths(atestado)]
  const { error: stErr } = await supabase.storage
    .from(FUNCIONARIO_DOCS_BUCKET)
    .remove([...new Set(paths)])
  if (stErr) throw new Error(stErr.message)

  const { error: dbErr } = await supabase
    .from('movelaria_funcionario_ponto_atestados')
    .delete()
    .eq('id', atestado.id)
  if (dbErr) throw new Error(dbErr.message)
}

/** Baixa a preview como data URL (para embutir no PDF impresso). */
export async function pontoAtestadoToDataUrls(atestado: PontoAtestado): Promise<string[]> {
  const urls = await getPontoAtestadoPreviewUrls(atestado)
  const dataUrls: string[] = []
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const blob = await res.blob()
      dataUrls.push(await blobToDataUrl(blob))
    } catch {
      /* ignora */
    }
  }
  return dataUrls
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler arquivo'))
    reader.readAsDataURL(blob)
  })
}
