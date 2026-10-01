import { isSchemaApiExposed } from './empresa-tables';

export const MARKUP_PUBLIC_TABLES = {
  categorias: 'CRM-multi-empresas>markup_categorias<',
  produtos: 'CRM-multi-empresas>markup_produtos<',
  config: 'CRM-multi-empresas>markup_config<',
  despesaTemplates: 'CRM-multi-empresas>markup_despesa_templates<',
  servicoTemplates: 'CRM-multi-empresas>markup_servico_templates<',
  orcamentos: 'CRM-multi-empresas>markup_orcamentos<',
  orcamentoLinhas: 'CRM-multi-empresas>markup_orcamento_linhas<',
  regrasConstrutivas: 'CRM-multi-empresas>markup_regras_construtivas<',
  leadNegociacoes: 'CRM-multi-empresas>lead_negociacoes<',
  leadNegociadorConfig: 'CRM-multi-empresas>lead_negociador_config<',
} as const;

export type MarkupTableKey = keyof typeof MARKUP_PUBLIC_TABLES;

export function resolveMarkupTable(
  schema: string | null | undefined,
  key: MarkupTableKey,
): string {
  if (isSchemaApiExposed(schema)) {
    const local: Record<MarkupTableKey, string> = {
      categorias: 'markup_categorias',
      produtos: 'markup_produtos',
      config: 'markup_config',
      despesaTemplates: 'markup_despesa_templates',
      servicoTemplates: 'markup_servico_templates',
      orcamentos: 'markup_orcamentos',
      orcamentoLinhas: 'markup_orcamento_linhas',
      regrasConstrutivas: 'markup_regras_construtivas',
      leadNegociacoes: 'lead_negociacoes',
      leadNegociadorConfig: 'lead_negociador_config',
    };
    return local[key];
  }
  return MARKUP_PUBLIC_TABLES[key];
}

export function markupSchemaExtra(schema: string | null | undefined): Record<string, string> {
  return isSchemaApiExposed(schema) ? {} : { schema_nome: schema ?? '' };
}

export const markupProdutosQueryKey = (schema: string | null | undefined) =>
  ['markup-produtos', schema] as const;

export const markupCategoriasQueryKey = (schema: string | null | undefined) =>
  ['markup-categorias', schema] as const;

export const markupConfigQueryKey = (schema: string | null | undefined) =>
  ['markup-config', schema] as const;

export const markupDespesaTemplatesQueryKey = (schema: string | null | undefined) =>
  ['markup-despesa-templates', schema] as const;

export const markupServicoTemplatesQueryKey = (schema: string | null | undefined) =>
  ['markup-servico-templates', schema] as const;

export const markupOrcamentosQueryKey = (schema: string | null | undefined, leadId?: number | null) =>
  ['markup-orcamentos', schema, leadId ?? 'all'] as const;

export const markupLeadResumoMapQueryKey = (schema: string | null | undefined) =>
  ['markup-lead-resumo-map', schema] as const;

export const markupRegrasConstrutivasQueryKey = (schema: string | null | undefined) =>
  ['markup-regras-construtivas', schema] as const;

export const leadNegociacoesQueryKey = (
  schema: string | null | undefined,
  leadId?: number | null,
) => ['lead-negociacoes', schema, leadId ?? 'all'] as const;

export const leadNegociadorConfigQueryKey = (
  schema: string | null | undefined,
  leadId?: number | null,
) => ['lead-negociador-config', schema, leadId ?? 'none'] as const;

export const MARKUP_TIMBRADO_BUCKET = 'markup-timbrado';
