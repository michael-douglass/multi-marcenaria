import { supabase } from '@/lib/supabase'
import { pdfAllPagesToPngBlobs } from '@/lib/pdf-to-image'
import { officeWordToJpgBlobs } from '@/lib/office-to-image'
import {
  pdfPreviewPathAt,
  collectPreviewStoragePaths,
  resolveStoredPreviewPaths,
} from '@/lib/pdf-preview-storage'
import { createId } from '@/lib/utils'
import type {
  ContaReceber,
  ContaReceberAnexo,
  ContaReceberAnexoScope,
  PendingContaReceberAnexo,
} from '@/types'

export const CR_ANEXOS_BUCKET = 'movelaria-contas-receber-anexos'

const ACCEPTED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const OFFICE_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export function isAcceptedCrAnexoFile(file: File): boolean {
  if (ACCEPTED.includes(file.type)) return true
  const lower = file.name.toLowerCase()
  return (
    lower.endsWith('.pdf')
    || lower.endsWith('.dotx')
    || lower.endsWith('.docx')
    || /\.(jpe?g|png|webp|gif)$/.test(lower)
  )
}

function isOfficeWordFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return (
    OFFICE_MIME.has(file.type)
    || lower.endsWith('.dotx')
    || lower.endsWith('.docx')
  )
}

function mimeForOffice(file: File): string {
  const lower = file.name.toLowerCase()
  if (file.type && OFFICE_MIME.has(file.type)) return file.type
  if (lower.endsWith('.dotx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.template'
  }
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

/** Chave de grupo do parcelamento (manual ou orçamento). */
export function resolveGrupoReceberId(conta: ContaReceber): string | null {
  return conta.grupo_id ?? conta.origem_lead_id ?? null
}

export async function buildPendingCrAnexo(file: File): Promise<PendingContaReceberAnexo> {
  if (!isAcceptedCrAnexoFile(file)) {
    throw new Error('Envie imagem (JPG, PNG, WebP, GIF), PDF ou Word (.dotx / .docx).')
  }

  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

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

  if (isOfficeWordFile(file)) {
    const previewBlobs = await officeWordToJpgBlobs(file)
    const previewUrls = previewBlobs.map(blob => URL.createObjectURL(blob))
    return {
      localId: createId(),
      file,
      nome: file.name,
      tipoMime: mimeForOffice(file),
      kind: 'document',
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

export function revokePendingCrAnexoUrls(anexos: PendingContaReceberAnexo[]) {
  anexos.forEach(a => {
    const urls = a.previewUrls?.length ? a.previewUrls : a.previewUrl ? [a.previewUrl] : []
    urls.forEach(url => URL.revokeObjectURL(url))
  })
}

export async function uploadContaReceberAnexos(params: {
  scope: ContaReceberAnexoScope
  contaReceberId: string
  grupoId: string | null
  anexos: PendingContaReceberAnexo[]
}): Promise<void> {
  const { scope, contaReceberId, grupoId, anexos } = params

  if (scope === 'all' && !grupoId) {
    throw new Error('Esta cobrança não tem parcelamento para anexar a todas as parcelas.')
  }

  const folderKey = scope === 'all' ? (grupoId as string) : contaReceberId

  for (const anexo of anexos) {
    const anexoId = createId()
    const ext = anexo.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const storagePath = `${folderKey}/${anexoId}/original.${ext}`

    const { error: upErr } = await supabase.storage
      .from(CR_ANEXOS_BUCKET)
      .upload(storagePath, anexo.file, {
        contentType: anexo.tipoMime,
        upsert: false,
      })
    if (upErr) throw new Error(upErr.message)

    let previewPath: string | null = null
    let previewPaths: string[] | null = null
    if (
      (anexo.kind === 'pdf' || anexo.kind === 'document')
      && anexo.previewBlobs?.length
    ) {
      const basePrefix = `${folderKey}/${anexoId}`
      const isWord = anexo.kind === 'document'
      const ext = isWord ? 'jpg' : 'png'
      const contentType = isWord ? 'image/jpeg' : 'image/png'
      previewPaths = []
      for (let i = 0; i < anexo.previewBlobs.length; i++) {
        const path = pdfPreviewPathAt(basePrefix, i + 1, 'folder', ext)
        const { error: prevErr } = await supabase.storage
          .from(CR_ANEXOS_BUCKET)
          .upload(path, anexo.previewBlobs[i], {
            contentType,
            upsert: false,
          })
        if (prevErr) throw new Error(prevErr.message)
        previewPaths.push(path)
      }
      previewPath = previewPaths[0] ?? null
    } else if (anexo.kind === 'image') {
      previewPath = storagePath
    }

    const { error: dbErr } = await supabase.from('movelaria_contas_receber_anexos').insert({
      id: anexoId,
      conta_receber_id: scope === 'single' ? contaReceberId : null,
      grupo_id: scope === 'all' ? grupoId : null,
      nome_arquivo: anexo.nome,
      tipo_mime: anexo.tipoMime,
      storage_path: storagePath,
      preview_path: previewPath,
      preview_paths: previewPaths,
    })
    if (dbErr) throw new Error(dbErr.message)
  }
}

/** Lista anexos desta parcela + anexos compartilhados do grupo. */
export async function listAnexosDaContaReceber(
  conta: ContaReceber,
): Promise<ContaReceberAnexo[]> {
  const grupoId = resolveGrupoReceberId(conta)
  const byId = new Map<string, ContaReceberAnexo>()

  const { data: daParcela, error: errParcela } = await supabase
    .from('movelaria_contas_receber_anexos')
    .select('*')
    .eq('conta_receber_id', conta.id)
    .order('criado_em', { ascending: true })
  if (errParcela) throw new Error(errParcela.message)
  for (const row of daParcela ?? []) byId.set(row.id, row as ContaReceberAnexo)

  if (grupoId) {
    const { data: doGrupo, error: errGrupo } = await supabase
      .from('movelaria_contas_receber_anexos')
      .select('*')
      .eq('grupo_id', grupoId)
      .order('criado_em', { ascending: true })
    if (errGrupo) throw new Error(errGrupo.message)
    for (const row of doGrupo ?? []) byId.set(row.id, row as ContaReceberAnexo)
  }

  return [...byId.values()].sort((a, b) =>
    (a.criado_em ?? '').localeCompare(b.criado_em ?? ''),
  )
}

export async function getCrAnexoSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout ao gerar URL do anexo')), 8000),
  )
  const result = await Promise.race([
    supabase.storage.from(CR_ANEXOS_BUCKET).createSignedUrl(path, expiresIn),
    timeout,
  ])
  if (result.error || !result.data?.signedUrl) {
    throw new Error(result.error?.message ?? 'URL indisponível')
  }
  return result.data.signedUrl
}

function isWordAnexo(anexo: ContaReceberAnexo): boolean {
  const nome = anexo.nome_arquivo.toLowerCase()
  return (
    anexo.tipo_mime.includes('wordprocessingml')
    || nome.endsWith('.dotx')
    || nome.endsWith('.docx')
  )
}

export async function getCrAnexoPreviewSignedUrls(
  anexo: ContaReceberAnexo,
): Promise<string[]> {
  const paths = resolveStoredPreviewPaths(anexo)
  // Word sem JPG gerado: não usar o .dotx/.docx como “imagem”
  const targetPaths = paths.length
    ? paths
    : isWordAnexo(anexo)
      ? []
      : [anexo.storage_path]
  const urls: string[] = []
  for (const path of targetPaths) {
    try {
      urls.push(await getCrAnexoSignedUrl(path))
    } catch {
      /* ignora página indisponível */
    }
  }
  return urls
}

export async function deleteContaReceberAnexo(anexo: ContaReceberAnexo): Promise<void> {
  const paths = [anexo.storage_path, ...collectPreviewStoragePaths(anexo)]
  const { error: stErr } = await supabase.storage
    .from(CR_ANEXOS_BUCKET)
    .remove([...new Set(paths)])
  if (stErr) throw new Error(stErr.message)

  const { error: dbErr } = await supabase
    .from('movelaria_contas_receber_anexos')
    .delete()
    .eq('id', anexo.id)
  if (dbErr) throw new Error(dbErr.message)
}

export function anexoEscopoLabel(anexo: ContaReceberAnexo): 'desta parcela' | 'todas' {
  return anexo.grupo_id ? 'todas' : 'desta parcela'
}
