import { supabase } from '@/integrations/supabase/client';
import type { OrcamentoExportFormat } from '@/lib/orcamento-slide-export';
import type { OrcamentoExportViewport } from '@/lib/orcamento-slide-export-constants';
import {
  buildPdfFileName,
  triggerBlobDownload,
} from '@/lib/orcamento-slide-print';
import type { OrcamentoSlide, OrcamentoSlideMidia } from '@/lib/orcamento-slide-types';

export const ORCAMENTO_SLIDE_EXPORTS_BUCKET = 'orcamento-slide-exports';
export const ORCAMENTO_SLIDE_EXPORTS_TABLE = 'orcamento_slide_exports';

export interface OrcamentoSlideExportCacheInput {
  empresaSchema: string;
  orcamentoId: string;
  viewport: OrcamentoExportViewport;
  format: OrcamentoExportFormat;
  fingerprint: string;
  titulo: string;
}

interface OrcamentoSlideExportRow {
  id: string;
  empresa_schema: string;
  orcamento_id: string;
  viewport: string;
  format: string;
  content_fingerprint: string;
  storage_path: string;
  file_size: number | null;
}

/** Hash estável (SHA-256 hex) — muda quando o orçamento/mídias mudam. */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildExportFingerprint(opts: {
  orcamento: Pick<OrcamentoSlide, 'id' | 'atualizado_em' | 'dados' | 'status' | 'cliente_nome' | 'identificador'>;
  midias: Array<Pick<OrcamentoSlideMidia, 'id' | 'ordem' | 'file_url' | 'tipo'>>;
  viewport: OrcamentoExportViewport;
  format: OrcamentoExportFormat;
}): Promise<string> {
  const midiaSig = [...opts.midias]
    .map((m) => `${m.id}:${m.ordem}:${m.tipo}:${m.file_url}`)
    .sort()
    .join('|');

  const raw = [
    opts.orcamento.id,
    opts.orcamento.atualizado_em,
    opts.orcamento.status,
    opts.orcamento.cliente_nome,
    opts.orcamento.identificador,
    JSON.stringify(opts.orcamento.dados ?? {}),
    midiaSig,
    opts.viewport,
    opts.format,
  ].join('\n');

  return sha256Hex(raw);
}

function storagePathFor(input: OrcamentoSlideExportCacheInput): string {
  return `${input.empresaSchema}/${input.orcamentoId}/${input.viewport}/${input.format}/${input.fingerprint}.pdf`;
}

/**
 * Se existir PDF com o mesmo fingerprint, baixa e salva no disco do usuário.
 * Retorna true em cache hit.
 */
export async function tryDownloadCachedPdfExport(
  input: OrcamentoSlideExportCacheInput,
): Promise<boolean> {
  if (input.format !== 'pdf') return false;

  const { data, error } = await supabase
    .from(ORCAMENTO_SLIDE_EXPORTS_TABLE)
    .select(
      'id, empresa_schema, orcamento_id, viewport, format, content_fingerprint, storage_path, file_size',
    )
    .eq('empresa_schema', input.empresaSchema)
    .eq('orcamento_id', input.orcamentoId)
    .eq('viewport', input.viewport)
    .eq('format', 'pdf')
    .maybeSingle();

  if (error || !data) return false;

  const row = data as OrcamentoSlideExportRow;
  if (row.content_fingerprint !== input.fingerprint) return false;

  const { data: blob, error: downErr } = await supabase.storage
    .from(ORCAMENTO_SLIDE_EXPORTS_BUCKET)
    .download(row.storage_path);

  if (downErr || !blob) return false;

  triggerBlobDownload(blob, buildPdfFileName(input.titulo));
  return true;
}

/** Grava (ou substitui) o PDF gerado no Storage + metadados. */
export async function saveCachedPdfExport(
  input: OrcamentoSlideExportCacheInput,
  blob: Blob,
): Promise<void> {
  if (input.format !== 'pdf') return;

  const path = storagePathFor(input);

  const { error: upErr } = await supabase.storage
    .from(ORCAMENTO_SLIDE_EXPORTS_BUCKET)
    .upload(path, blob, {
      upsert: true,
      contentType: 'application/pdf',
      cacheControl: '3600',
    });

  if (upErr) throw upErr;

  // Remove arquivo antigo se o fingerprint mudou (path diferente).
  const { data: existing } = await supabase
    .from(ORCAMENTO_SLIDE_EXPORTS_TABLE)
    .select('storage_path')
    .eq('empresa_schema', input.empresaSchema)
    .eq('orcamento_id', input.orcamentoId)
    .eq('viewport', input.viewport)
    .eq('format', 'pdf')
    .maybeSingle();

  const oldPath =
    existing &&
    typeof existing === 'object' &&
    'storage_path' in existing &&
    typeof (existing as { storage_path?: string }).storage_path === 'string'
      ? (existing as { storage_path: string }).storage_path
      : null;

  if (oldPath && oldPath !== path) {
    void supabase.storage.from(ORCAMENTO_SLIDE_EXPORTS_BUCKET).remove([oldPath]);
  }

  const { error: upsertErr } = await supabase.from(ORCAMENTO_SLIDE_EXPORTS_TABLE).upsert(
    {
      empresa_schema: input.empresaSchema,
      orcamento_id: input.orcamentoId,
      viewport: input.viewport,
      format: 'pdf',
      content_fingerprint: input.fingerprint,
      storage_path: path,
      file_size: blob.size,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'empresa_schema,orcamento_id,viewport,format' },
  );

  if (upsertErr) throw upsertErr;
}
