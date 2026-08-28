import type { DatabaseUser, TipoUsuario } from '@/hooks/useUsers';

/** Papéis de colaborador que podem receber sinalização de lead. */
export const LEAD_SINALIZACAO_DESTINATARIO_ROLES = [
  'admin',
  'vendedor',
  'marketing',
] as const;

export type LeadSinalizacaoDestinatarioRole =
  (typeof LEAD_SINALIZACAO_DESTINATARIO_ROLES)[number];

/** Botão Sinalizar: apenas usuários cadastrados como Colaborador (não Lead nem Prestador). */
export function canShowLeadSinalizarButton(
  tipoUsuario: string | null | undefined,
): boolean {
  return (tipoUsuario ?? 'colaborador') === 'colaborador';
}

export function isColaboradorTipo(tipo: TipoUsuario | string | null | undefined): boolean {
  return (tipo ?? 'colaborador') === 'colaborador';
}

/** Colaboradores ativos com perfil admin, vendedor ou marketing — destinos da sinalização. */
export function filterLeadSinalizacaoDestinatarios(
  users: DatabaseUser[] | undefined,
): DatabaseUser[] {
  return (users ?? []).filter(
    (u) =>
      isColaboradorTipo(u.tipo_usuario) &&
      LEAD_SINALIZACAO_DESTINATARIO_ROLES.includes(
        u.role as LeadSinalizacaoDestinatarioRole,
      ),
  );
}
