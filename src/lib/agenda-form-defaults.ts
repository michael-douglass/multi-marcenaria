import type { FormField } from '@/hooks/useAgendaFormFields';

/** Campos padrão do formulário público de agendamento (seed por config). */
export const DEFAULT_AGENDA_FORM_FIELDS = [
  {
    field_key: 'nome_aluno',
    field_label: 'Nome do Aluno',
    field_type: 'text' as const,
    placeholder: 'Digite o nome do aluno',
    visible: true,
    required: true,
    ordem: 1,
  },
  {
    field_key: 'telefone',
    field_label: 'Telefone (WhatsApp)',
    field_type: 'tel' as const,
    placeholder: '(00) 00000-0000',
    visible: true,
    required: true,
    ordem: 2,
  },
  {
    field_key: 'email',
    field_label: 'E-mail',
    field_type: 'email' as const,
    placeholder: 'email@exemplo.com',
    visible: false,
    required: false,
    ordem: 3,
  },
  {
    field_key: 'idade_aluno',
    field_label: 'Idade do Aluno',
    field_type: 'number' as const,
    placeholder: 'Ex: 10',
    visible: true,
    required: false,
    ordem: 4,
  },
  {
    field_key: 'ano_escolar',
    field_label: 'Ano Escolar',
    field_type: 'text' as const,
    placeholder: 'Ex: 5º Ano',
    visible: true,
    required: false,
    ordem: 5,
  },
  {
    field_key: 'nome_responsavel',
    field_label: 'Nome do Responsável',
    field_type: 'text' as const,
    placeholder: 'Nome completo do responsável',
    visible: true,
    required: true,
    ordem: 6,
  },
];

/** Campos padrão prontos para exibir no formulário público quando o banco ainda não tem perguntas salvas. */
export function buildDefaultFormFields(configId: string): FormField[] {
  const now = new Date().toISOString();

  return DEFAULT_AGENDA_FORM_FIELDS.map((field, index) => ({
    id: `default-${field.field_key}`,
    config_id: configId,
    field_key: field.field_key,
    field_label: field.field_label,
    field_type: field.field_type,
    placeholder: field.placeholder ?? null,
    options: null,
    visible: field.visible,
    required: field.required,
    ordem: field.ordem ?? index + 1,
    criado_em: now,
    atualizado_em: now,
  }));
}
