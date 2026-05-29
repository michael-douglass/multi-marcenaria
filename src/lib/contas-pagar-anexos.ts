import { supabase } from '@/lib/supabase'
import { pdfFirstPageToPngBlob } from '@/lib/pdf-to-image'
import { createId } from '@/lib/utils'
import type { ContaPagarAnexo, PendingContaPagarAnexo } from '@/types'

export const ANEXOS_BUCKET = 'movelaria-contas-pagar-anexos'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

export function isAcceptedAnexoFile(file: File): boolean {
  if (ACCEPTED.includes(file.type)) return true
  const lower = file.name.toLowerCase()
  return lower.endsWith('.pdf') || /\.(jpe?g|png|webp|gif)$/.test(lower)
}

export async function buildPendingAnexo(file: File): Promise<PendingContaPagarAnexo> {
  if (!isAcceptedAnexoFile(file)) {
    throw new Error('Envie apenas imagem (JPG, PNG, WebP, GIF) ou PDF.')
  }

  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

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

  return {
    localId: createId(),
    file,
    nome: file.name,
    tipoMime: file.type || 'image/jpeg',
    kind: 'image',
    previewUrl: URL.createObjectURL(file),
  }
}

export function revokePendingAnexoUrls(anexos: PendingContaPagarAnexo[]) {
  anexos.forEach(a => URL.revokeObjectURL(a.previewUrl))
}

export async function uploadContaPagarAnexos(
  grupoLancamentoId: string,
  anexos: PendingContaPagarAnexo[],
): Promise<void> {
  for (const anexo of anexos) {
    const anexoId = createId()
    const ext = anexo.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const storagePath = `${grupoLancamentoId}/${anexoId}/original.${ext}`

    const { error: upErr } = await supabase.storage
      .from(ANEXOS_BUCKET)
      .upload(storagePath, anexo.file, {
        contentType: anexo.tipoMime,
        upsert: false,
      })
    if (upErr) throw new Error(upErr.message)

    let previewPath: string | null = null
    if (anexo.kind === 'pdf' && anexo.previewBlob) {
      previewPath = `${grupoLancamentoId}/${anexoId}/preview.png`
      const { error: prevErr } = await supabase.storage
        .from(ANEXOS_BUCKET)
        .upload(previewPath, anexo.previewBlob, {
          contentType: 'image/png',
          upsert: false,
        })
      if (prevErr) throw new Error(prevErr.message)
    } else if (anexo.kind === 'image') {
      previewPath = storagePath
    }

    const { error: dbErr } = await supabase.from('movelaria_contas_pagar_anexos').insert({
      id: anexoId,
      grupo_lancamento_id: grupoLancamentoId,
      nome_arquivo: anexo.nome,
      tipo_mime: anexo.tipoMime,
      storage_path: storagePath,
      preview_path: previewPath,
    })
    if (dbErr) throw new Error(dbErr.message)
  }
}

export async function listAnexosByGrupo(grupoId: string): Promise<ContaPagarAnexo[]> {
  const { data, error } = await supabase
    .from('movelaria_contas_pagar_anexos')
    .select('*')
    .eq('grupo_lancamento_id', grupoId)
    .order('criado_em', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAnexoSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout ao gerar URL do anexo')), 8000),
  )
  const result = await Promise.race([
    supabase.storage.from(ANEXOS_BUCKET).createSignedUrl(path, expiresIn),
    timeout,
  ])
  if (result.error || !result.data?.signedUrl) {
    throw new Error(result.error?.message ?? 'URL indisponível')
  }
  return result.data.signedUrl
}

export async function deleteContaPagarAnexo(anexo: ContaPagarAnexo): Promise<void> {
  const paths = [anexo.storage_path]
  if (anexo.preview_path && anexo.preview_path !== anexo.storage_path) {
    paths.push(anexo.preview_path)
  }
  const { error: stErr } = await supabase.storage.from(ANEXOS_BUCKET).remove(paths)
  if (stErr) throw new Error(stErr.message)

  const { error: dbErr } = await supabase
    .from('movelaria_contas_pagar_anexos')
    .delete()
    .eq('id', anexo.id)
  if (dbErr) throw new Error(dbErr.message)
}
