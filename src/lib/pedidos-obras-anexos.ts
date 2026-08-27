import { supabase } from '@/lib/supabase'
import {
  ANEXOS_BUCKET as CP_BUCKET,
  buildPendingAnexo,
  isAcceptedAnexoFile,
  revokePendingAnexoUrls,
} from '@/lib/contas-pagar-anexos'
import { pdfPreviewPathAt } from '@/lib/pdf-preview-storage'
import { createId } from '@/lib/utils'
import type { PedidoAnexo, PendingContaPagarAnexo } from '@/types'

export const PEDIDOS_ANEXOS_BUCKET = 'movelaria-pedidos-anexos'

export { buildPendingAnexo, isAcceptedAnexoFile, revokePendingAnexoUrls }

export async function uploadPedidoAnexos(
  pedidoId: string,
  anexos: PendingContaPagarAnexo[],
): Promise<void> {
  for (const anexo of anexos) {
    const anexoId = createId()
    const ext = anexo.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const storagePath = `${pedidoId}/${anexoId}/original.${ext}`

    const { error: upErr } = await supabase.storage
      .from(PEDIDOS_ANEXOS_BUCKET)
      .upload(storagePath, anexo.file, {
        contentType: anexo.tipoMime,
        upsert: false,
      })
    if (upErr) throw new Error(upErr.message)

    let previewPath: string | null = null
    if (anexo.kind === 'pdf' && anexo.previewBlobs?.[0]) {
      previewPath = pdfPreviewPathAt(`${pedidoId}/${anexoId}`, 1, 'folder')
      const { error: prevErr } = await supabase.storage
        .from(PEDIDOS_ANEXOS_BUCKET)
        .upload(previewPath, anexo.previewBlobs[0], {
          contentType: 'image/png',
          upsert: false,
        })
      if (prevErr) throw new Error(prevErr.message)
    } else if (anexo.kind === 'image') {
      previewPath = storagePath
    }

    const { error: dbErr } = await supabase.from('movelaria_pedidos_anexos').insert({
      id: anexoId,
      pedido_id: pedidoId,
      nome_arquivo: anexo.nome,
      tipo_mime: anexo.tipoMime,
      storage_path: storagePath,
      preview_path: previewPath,
    })
    if (dbErr) throw new Error(dbErr.message)
  }
}

export async function getPedidoAnexoSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PEDIDOS_ANEXOS_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'URL do anexo indisponível')
  }
  return data.signedUrl
}

export async function deletePedidoAnexo(anexo: PedidoAnexo): Promise<void> {
  const paths = [anexo.storage_path, anexo.preview_path].filter((p): p is string => !!p)
  const { error: stErr } = await supabase.storage
    .from(PEDIDOS_ANEXOS_BUCKET)
    .remove([...new Set(paths)])
  if (stErr) throw new Error(stErr.message)

  const { error: dbErr } = await supabase
    .from('movelaria_pedidos_anexos')
    .delete()
    .eq('id', anexo.id)
  if (dbErr) throw new Error(dbErr.message)
}

/** Copia as NFs do pedido para o grupo de Contas a Pagar, depois da aprovação. */
export async function copyPedidoAnexosToContaPagar(
  anexos: PedidoAnexo[],
  grupoLancamentoId: string,
): Promise<void> {
  for (const anexo of anexos) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from(PEDIDOS_ANEXOS_BUCKET)
      .download(anexo.storage_path)
    if (dlErr || !blob) throw new Error(dlErr?.message ?? 'Não foi possível ler a nota fiscal.')

    const anexoId = createId()
    const ext = anexo.nome_arquivo.split('.').pop()?.toLowerCase() ?? 'bin'
    const storagePath = `${grupoLancamentoId}/${anexoId}/original.${ext}`

    const { error: upErr } = await supabase.storage
      .from(CP_BUCKET)
      .upload(storagePath, blob, {
        contentType: anexo.tipo_mime,
        upsert: false,
      })
    if (upErr) throw new Error(upErr.message)

    let previewPath: string | null = storagePath
    if (anexo.preview_path && anexo.preview_path !== anexo.storage_path) {
      const { data: previewBlob } = await supabase.storage
        .from(PEDIDOS_ANEXOS_BUCKET)
        .download(anexo.preview_path)
      if (previewBlob) {
        previewPath = pdfPreviewPathAt(`${grupoLancamentoId}/${anexoId}`, 1, 'folder')
        await supabase.storage.from(CP_BUCKET).upload(previewPath, previewBlob, {
          contentType: 'image/png',
          upsert: false,
        })
      }
    }

    const { error: dbErr } = await supabase.from('movelaria_contas_pagar_anexos').insert({
      id: anexoId,
      grupo_lancamento_id: grupoLancamentoId,
      nome_arquivo: anexo.nome_arquivo,
      tipo_mime: anexo.tipo_mime,
      storage_path: storagePath,
      preview_path: previewPath,
    })
    if (dbErr) throw new Error(dbErr.message)
  }
}
