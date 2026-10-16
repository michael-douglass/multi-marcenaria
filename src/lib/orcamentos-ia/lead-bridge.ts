/**
 * Ponte CRM Lead → Orçamentos com IA.
 * Baixa anexos do lead, garante pasta (1 por lead) e prepara File[] para o pipeline.
 */

import {
  ensureQuoteProjectForLead,
  type QuoteProjectRow,
} from '@/lib/orcamentos-ia/storage'

export interface LeadAttachmentForQuote {
  id: string
  file_url: string
  file_name: string
  mime_type?: string | null
  tipo?: 'pdf' | 'imagem' | 'video' | string | null
}

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i
const PDF_EXT = /\.pdf$/i

export function isLeadAttachmentQuoteable(item: LeadAttachmentForQuote): boolean {
  if (item.tipo === 'video') return false
  if (item.tipo === 'pdf' || item.tipo === 'imagem') return true
  const mime = (item.mime_type || '').toLowerCase()
  if (mime.startsWith('video/')) return false
  if (mime === 'application/pdf' || mime.startsWith('image/')) return true
  const name = (item.file_name || '').toLowerCase()
  return PDF_EXT.test(name) || IMAGE_EXT.test(name)
}

function guessMime(fileName: string, mime: string | null | undefined): string {
  if (mime && mime !== 'application/octet-stream') return mime
  const n = fileName.toLowerCase()
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.webp')) return 'image/webp'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  return mime || 'application/octet-stream'
}

/** Baixa um anexo do lead (URL pública ou assinada) como File do browser. */
export async function downloadLeadAttachmentAsFile(
  item: LeadAttachmentForQuote,
): Promise<{ file: File | null; error?: string }> {
  const url = (item.file_url || '').trim()
  if (!url) return { file: null, error: 'Anexo sem URL.' }
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return { file: null, error: `Falha ao baixar (${res.status}): ${item.file_name}` }
    }
    const blob = await res.blob()
    const mime = guessMime(item.file_name, item.mime_type || blob.type)
    const name = item.file_name?.trim() || `anexo-${item.id}`
    return { file: new File([blob], name, { type: mime }) }
  } catch (err) {
    return {
      file: null,
      error: err instanceof Error ? err.message : 'Não foi possível baixar o anexo.',
    }
  }
}

/**
 * PDFs primeiro (melhor para pasta permanente), depois imagens.
 * Vídeos são ignorados.
 */
export function sortAttachmentsForQuote(
  items: LeadAttachmentForQuote[],
): LeadAttachmentForQuote[] {
  const quoteable = items.filter(isLeadAttachmentQuoteable)
  return [...quoteable].sort((a, b) => {
    const aPdf = a.tipo === 'pdf' || PDF_EXT.test(a.file_name || '')
    const bPdf = b.tipo === 'pdf' || PDF_EXT.test(b.file_name || '')
    if (aPdf === bPdf) return 0
    return aPdf ? -1 : 1
  })
}

export async function prepareLeadAttachmentsAsFiles(
  items: LeadAttachmentForQuote[],
): Promise<{ files: File[]; errors: string[] }> {
  const ordered = sortAttachmentsForQuote(items)
  const files: File[] = []
  const errors: string[] = []
  for (const item of ordered) {
    const { file, error } = await downloadLeadAttachmentAsFile(item)
    if (error || !file) {
      errors.push(error || `Falha em ${item.file_name}`)
      continue
    }
    files.push(file)
  }
  return { files, errors }
}

export async function ensureLeadQuoteFolder(params: {
  companyId: string
  leadId: number
  leadName?: string | null
  userId?: string | null
  sourcePdfName?: string | null
}): Promise<{ project: QuoteProjectRow | null; created: boolean; error?: string }> {
  const result = await ensureQuoteProjectForLead({
    companyId: params.companyId,
    leadId: params.leadId,
    leadName: params.leadName,
    createdBy: params.userId ?? null,
    sourcePdfName: params.sourcePdfName ?? null,
  })
  return {
    project: result.data,
    created: result.created,
    error: result.error,
  }
}

/**
 * Prepara pasta + arquivos para disparar startQuoteAnalysis do context.
 * Não inicia o pipeline — a UI chama o context (progresso no popup global).
 */
export async function prepareLeadQuoteHandoff(params: {
  companyId: string
  leadId: number
  leadName?: string | null
  userId?: string | null
  attachments: LeadAttachmentForQuote[]
}): Promise<{
  project: QuoteProjectRow | null
  files: File[]
  projectCreated: boolean
  error?: string
  warnings: string[]
}> {
  const { files, errors } = await prepareLeadAttachmentsAsFiles(params.attachments)
  if (!files.length) {
    return {
      project: null,
      files: [],
      projectCreated: false,
      error:
        errors[0] ||
        'Nenhum PDF ou imagem válido para cotar. Vídeos não entram no Orçamentos com IA.',
      warnings: errors,
    }
  }

  const folder = await ensureLeadQuoteFolder({
    companyId: params.companyId,
    leadId: params.leadId,
    leadName: params.leadName,
    userId: params.userId,
    sourcePdfName: files[0]?.name ?? null,
  })
  if (folder.error || !folder.project) {
    return {
      project: null,
      files,
      projectCreated: false,
      error: folder.error || 'Não foi possível criar a pasta do lead.',
      warnings: errors,
    }
  }

  return {
    project: folder.project,
    files,
    projectCreated: folder.created,
    warnings: errors,
  }
}
