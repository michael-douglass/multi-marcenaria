import { isEmpresaSchema } from '@/lib/empresa-tables';

export interface AgendaPublicLinkOptions {
  empresaSlug?: string | null;
  schemaEmpresa?: string | null;
}

/** Link público para clientes agendarem reuniões. */
export function linkPublicoAgenda(
  agendaSlug: string,
  options?: AgendaPublicLinkOptions,
  origin = window.location.origin,
): string {
  if (options?.empresaSlug) {
    return `${origin}/agendar/${options.empresaSlug}/${agendaSlug}`;
  }

  if (options?.schemaEmpresa && isEmpresaSchema(options.schemaEmpresa)) {
    const schemaSlug = options.schemaEmpresa.replace(/^emp_/, '');
    return `${origin}/agendar/${schemaSlug}/${agendaSlug}`;
  }

  return `${origin}/agendar/${agendaSlug}`;
}
