import type { LeadPDF } from '@/hooks/useLeadPDFs';
import {
  agendaMimeToMediaTipo,
  extractAgendaFormUploads,
  parseAgendaFormUploadFieldValue,
  type AgendaFormUploadedFile,
} from '@/lib/agenda-form-uploads';
import {
  filterCustomFormFields,
  parseRespostaFormulario,
} from '@/lib/agenda-form-field-utils';
import type { FormField } from '@/hooks/useAgendaFormFields';

export const FORM_UPLOAD_ATTACHMENT_ID_PREFIX = 'form-upload:';

export function formUploadAttachmentId(
  reuniaoId: string,
  fieldKey: string,
  fileUrl: string,
): string {
  return `${FORM_UPLOAD_ATTACHMENT_ID_PREFIX}${reuniaoId}:${fieldKey}:${encodeURIComponent(fileUrl)}`;
}

export function isFormUploadAttachmentId(id: string): boolean {
  return id.startsWith(FORM_UPLOAD_ATTACHMENT_ID_PREFIX);
}

export function agendaFormFileToLeadPDF(
  file: AgendaFormUploadedFile,
  leadId: number,
  options: { id: string; titulo: string; criado_em: string },
): LeadPDF | null {
  const tipo = agendaMimeToMediaTipo(file.mime_type);
  if (!tipo) return null;

  return {
    id: options.id,
    titulo: options.titulo,
    file_url: file.url,
    file_name: file.name,
    file_size: file.size > 0 ? file.size : null,
    lead_id: leadId,
    folder_id: null,
    criado_em: options.criado_em,
    tipo,
    mime_type: file.mime_type,
  };
}

export function buildLeadFormUploadAttachments(input: {
  leadId: number;
  reuniaoId: string;
  respostaFormulario: string;
  criado_em: string;
  formFieldDefs: FormField[];
}): LeadPDF[] {
  const parsed = parseRespostaFormulario(input.respostaFormulario);
  const items: LeadPDF[] = [];
  const seenUrls = new Set<string>();

  const pushFile = (file: AgendaFormUploadedFile, fieldKey: string, label: string) => {
    if (!file.url.trim() || seenUrls.has(file.url)) return;
    const leadPdf = agendaFormFileToLeadPDF(file, input.leadId, {
      id: formUploadAttachmentId(input.reuniaoId, fieldKey, file.url),
      titulo: label,
      criado_em: input.criado_em,
    });
    if (!leadPdf) return;
    seenUrls.add(file.url);
    items.push(leadPdf);
  };

  const fileFields = filterCustomFormFields(input.formFieldDefs).filter(
    (field) => field.field_type === 'file' && field.visible !== false,
  );

  if (fileFields.length > 0) {
    for (const field of fileFields) {
      const raw = parsed[field.field_key];
      if (!raw?.trim()) continue;
      const files = parseAgendaFormUploadFieldValue(raw);
      for (const file of files) {
        pushFile(file, field.field_key, `${field.field_label} — ${file.name}`);
      }
    }
    return items;
  }

  for (const file of extractAgendaFormUploads(input.respostaFormulario)) {
    pushFile(file, 'form', file.name);
  }

  return items;
}

/** Evita duplicar anexos quando a mesma URL já existe em marketing_medias. */
export function mergeLeadAttachmentsDedupeByUrl(
  primary: LeadPDF[],
  extras: LeadPDF[],
): LeadPDF[] {
  const urls = new Set(primary.map((item) => item.file_url).filter(Boolean));
  const merged = [...primary];

  for (const extra of extras) {
    if (!extra.file_url?.trim() || urls.has(extra.file_url)) continue;
    urls.add(extra.file_url);
    merged.push(extra);
  }

  return merged.sort(
    (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
  );
}
