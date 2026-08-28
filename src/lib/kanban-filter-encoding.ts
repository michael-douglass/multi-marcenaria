/**
 * Codifica filtros de origem/região no campo text do banco.
 * - null = sem filtro (todas)
 * - um valor = string simples (compatível com registros antigos)
 * - vários = JSON array de strings
 */
export function encodeKanbanFiltroLista(selecionados: string[]): string | null {
  const limpos = selecionados.map((s) => s.trim()).filter(Boolean);
  if (limpos.length === 0) return null;
  if (limpos.length === 1) return limpos[0];
  return JSON.stringify(limpos);
}

/** null = sem filtro; array não vazio = lead deve estar na lista */
export function decodeKanbanFiltroLista(valor: string | null): string[] | null {
  if (valor == null) return null;
  const t = valor.trim();
  if (t === '') return null;
  if (t.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(t);
      if (!Array.isArray(parsed)) return null;
      const strings = parsed.filter((item): item is string => typeof item === 'string').map((s) => s.trim()).filter(Boolean);
      return strings.length ? strings : null;
    } catch {
      return [t];
    }
  }
  return [t];
}
