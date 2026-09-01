/** Quem pode ser titular de tarefa/lembrete no sistema (CRM + Casa). */

export type TitularAgendaGrupo = 'equipe' | 'montador';

export interface TitularAgenda {
  id: string;
  nome: string;
  avatar_url: string | null;
  perfil_casa: string | null;
  crm_roles: string[];
  grupo: TitularAgendaGrupo;
}

const CASA_PAPEL_LABEL: Record<string, string> = {
  montador: 'montador',
  montador_admin: 'montador admin',
  administrador: 'admin',
  administrador_obras: 'adm. obras',
  financeiro: 'financeiro',
};

const CRM_PAPEL_LABEL: Record<string, string> = {
  admin: 'admin',
  vendedor: 'vendedor',
  marketing: 'marketing',
  projetista: 'projetista',
  projetista_admin: 'projetista admin',
};

const CASA_MONTADOR_PERFIS = new Set(['montador', 'montador_admin']);

export function titularAgendaGrupo(perfilCasa: string | null | undefined): TitularAgendaGrupo {
  return CASA_MONTADOR_PERFIS.has(perfilCasa ?? '') ? 'montador' : 'equipe';
}

export function formatTitularAgendaPapel(
  perfilCasa: string | null | undefined,
  crmRoles: readonly string[] | null | undefined,
): string {
  const labels: string[] = [];
  const seen = new Set<string>();
  const push = (label: string | undefined) => {
    if (!label || seen.has(label)) return;
    seen.add(label);
    labels.push(label);
  };

  push(CASA_PAPEL_LABEL[perfilCasa ?? '']);
  for (const role of crmRoles ?? []) {
    if (role === 'nenhum') continue;
    push(CRM_PAPEL_LABEL[role] ?? role);
  }

  return labels.length > 0 ? labels.join(' · ') : 'equipe';
}

export function sortTitularesAgenda<T extends { nome: string }>(users: T[]): T[] {
  return [...users].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function groupTitularesAgenda(users: TitularAgenda[]): {
  equipe: TitularAgenda[];
  montadores: TitularAgenda[];
} {
  const equipe: TitularAgenda[] = [];
  const montadores: TitularAgenda[] = [];
  for (const user of sortTitularesAgenda(users)) {
    if (user.grupo === 'montador') montadores.push(user);
    else equipe.push(user);
  }
  return { equipe, montadores };
}

export function mapTitularAgendaRow(row: Record<string, unknown>): TitularAgenda {
  const perfilCasa = row.perfil_casa ? String(row.perfil_casa) : null;
  const crmRoles = Array.isArray(row.crm_roles) ? row.crm_roles.map(String) : [];
  return {
    id: String(row.id),
    nome: String(row.nome ?? 'Usuário'),
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    perfil_casa: perfilCasa,
    crm_roles: crmRoles,
    grupo: (row.grupo === 'montador' ? 'montador' : titularAgendaGrupo(perfilCasa)),
  };
}
