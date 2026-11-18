/**
 * Regra mínima de bloqueio de páginas (multi-empresa, Fase I), sem dependências — usada pelo menu
 * (`app-navigation.ts`) e pelo catálogo (`paginas-catalogo.ts`) sem import circular.
 */

/** Páginas que nunca podem ser bloqueadas (tela inicial/perfil/gestão de usuários da empresa). */
export const PAGINAS_NAO_BLOQUEAVEIS: ReadonlySet<string> = new Set(['meuPerfil', 'configuracoes', 'adminUsuarios'])

/** O id de página está bloqueado para a empresa? */
export function paginaIdBloqueada(id: string, bloqueadas: readonly string[] | null | undefined): boolean {
  if (!bloqueadas?.length) return false
  if (PAGINAS_NAO_BLOQUEAVEIS.has(id)) return false
  return bloqueadas.includes(id)
}
