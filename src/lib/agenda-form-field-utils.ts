import type { FormField, FormFieldType } from '@/hooks/useAgendaFormFields';
import { AGENDA_FILE_CATEGORIES, AGENDA_FILE_CATEGORY_LABELS } from '@/lib/agenda-file-types';
import { parseAgendaFormUploadValue } from '@/lib/agenda-form-uploads';

export const AGENDA_FIELD_TYPE_OPTIONS: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Texto curto' },
  { value: 'date', label: 'Data' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'email', label: 'E-mail' },
  { value: 'tel', label: 'Telefone (WhatsApp)' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Múltipla escolha' },
  { value: 'file', label: 'Documento / Anexo' },
];

export const AGENDA_FILE_TYPE_OPTIONS = AGENDA_FILE_CATEGORIES.map((value) => ({
  value,
  label: AGENDA_FILE_CATEGORY_LABELS[value],
}));

export function createTempFieldId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `temp-${crypto.randomUUID()}`;
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function slugifyFieldKey(label: string, existingKeys: string[]): string {
  const base =
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'campo';

  let key = base;
  let counter = 1;
  while (existingKeys.includes(key)) {
    key = `${base}_${counter}`;
    counter += 1;
  }
  return key;
}

export function parseSelectOptions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatSelectOptions(options: string[] | null | undefined): string {
  return (options ?? []).join('\n');
}

/** Valores salvos como JSON array (ex.: `["Sala","Quarto"]`). Aceita valor legado de opção única. */
export function parseMultiSelectFormValue(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      }
    } catch {
      return [];
    }
  }
  return [trimmed];
}

export function serializeMultiSelectFormValue(values: string[]): string {
  return JSON.stringify(values);
}

export function formatFormResponseValue(raw: string): string {
  const trimmed = raw.trim();

  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDateMatch) {
    return `${isoDateMatch[3]}/${isoDateMatch[2]}/${isoDateMatch[1]}`;
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'object' && parsed[0] !== null && 'url' in (parsed[0] as object)) {
          return parsed
            .map((item) => {
              const file = parseAgendaFormUploadValue(item);
              return file?.name ?? 'Arquivo';
            })
            .join(', ');
        }
        if (typeof parsed[0] === 'string') {
          return parsed.filter((item): item is string => typeof item === 'string').join(', ');
        }
      }
    } catch {
      /* fall through */
    }
  }

  const multi = parseMultiSelectFormValue(raw);
  if (trimmed.startsWith('[') && multi.length > 0) {
    return multi.join(', ');
  }
  return raw;
}

export function hasMultiSelectSelection(raw: string | null | undefined): boolean {
  return parseMultiSelectFormValue(raw).length > 0;
}

/** Chaves reservadas — preenchidas por campos fixos na página pública (card do lead). */
export const AGENDA_NATIVE_LEAD_FIELD_KEYS = [
  'nome_aluno',
  'nome',
  'nome_responsavel',
  'convidado_nome',
  'telefone',
  'email',
] as const;

export function isNativeLeadFormField(fieldKey: string): boolean {
  return (AGENDA_NATIVE_LEAD_FIELD_KEYS as readonly string[]).includes(fieldKey);
}

export function filterCustomFormFields<T extends { field_key: string }>(fields: T[]): T[] {
  return fields.filter((field) => !isNativeLeadFormField(field.field_key));
}

export const NATIVE_PUBLIC_LEAD_FIELDS = {
  nome: {
    field_key: 'convidado_nome',
    field_label: 'Nome',
    placeholder: 'Seu nome completo',
  },
  telefone: {
    field_key: 'telefone',
    field_label: 'Telefone (WhatsApp)',
    placeholder: '(00) 00000-0000',
  },
} as const;

export function parseRespostaFormulario(resposta: string | null): Record<string, string> {
  if (!resposta?.trim()) return {};
  try {
    const parsed = JSON.parse(resposta) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => value != null && String(value).trim() !== '')
        .map(([key, value]) => [key, String(value)]),
    );
  } catch {
    return {};
  }
}

export interface FormResponseDisplayItem {
  key: string;
  label: string;
  value: string;
  formattedValue: string;
}

/** Monta respostas para exibição: só campos do formulário configurado, na ordem certa, com rótulos legíveis. */
export function buildFormResponseDisplayItems(
  resposta: string | null,
  formFields: Pick<FormField, 'field_key' | 'field_label' | 'ordem' | 'visible' | 'field_type'>[],
  options?: { includeNativeLeadFields?: boolean },
): FormResponseDisplayItem[] {
  const parsed = parseRespostaFormulario(resposta);
  if (Object.keys(parsed).length === 0 || formFields.length === 0) return [];

  const fields = (options?.includeNativeLeadFields
    ? [...formFields]
    : filterCustomFormFields(formFields)
  )
    .filter((field) => field.visible !== false && field.field_type !== 'file')
    .sort((a, b) => a.ordem - b.ordem);

  return fields
    .map((field) => {
      const raw = parsed[field.field_key];
      if (!raw?.trim()) return null;
      return {
        key: field.field_key,
        label: field.field_label,
        value: raw,
        formattedValue: formatFormResponseValue(raw),
      };
    })
    .filter((item): item is FormResponseDisplayItem => item !== null);
}

export function summarizeFormResponses(items: FormResponseDisplayItem[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) {
    return `${items[0].label}: ${items[0].formattedValue}`;
  }
  const preview = items
    .slice(0, 2)
    .map((item) => item.formattedValue)
    .join(' · ');
  return items.length > 2 ? `${preview} · +${items.length - 2}` : preview;
}

export function resolveConvidadoFromForm(
  data: Record<string, string>,
  fields: Pick<FormField, 'field_key' | 'field_type'>[],
): { nome: string; whatsapp: string; email: string } {
  const nomeKeys = ['convidado_nome', 'nome_aluno', 'nome', 'nome_responsavel'];
  const nomeField =
    fields.find((f) => nomeKeys.includes(f.field_key)) ??
    fields.find((f) => f.field_type === 'text');

  const telField = fields.find((f) => f.field_type === 'tel');
  const emailField = fields.find((f) => f.field_type === 'email');

  const nome =
    data.convidado_nome?.trim() ||
    (nomeField ? data[nomeField.field_key] : '') ||
    data.nome_aluno ||
    data.nome_responsavel ||
    data.nome ||
    'Não informado';

  const whatsapp =
    data.telefone?.trim() ||
    (telField ? data[telField.field_key] : '') ||
    '';

  const email =
    data.email?.trim() ||
    (emailField ? data[emailField.field_key] : '') ||
    '';

  return { nome, whatsapp, email };
}
