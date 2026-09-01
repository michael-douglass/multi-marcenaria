const STORAGE_KEY = 'movelaria.furniture-favorites';

function readList(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(types: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

export function loadFurnitureFavorites(): Set<string> {
  return new Set(readList());
}

export function isFurnitureFavorite(type: string, favorites: Set<string>): boolean {
  return favorites.has(type);
}

export function toggleFurnitureFavorite(type: string, current: Set<string>): Set<string> {
  const next = new Set(current);
  if (next.has(type)) next.delete(type);
  else next.add(type);
  writeList([...next]);
  return next;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Favoritos que batem com a busca vêm primeiro (ex.: cadeira favorita ao digitar “cadeira”). */
export function rankFurnitureByFavorite<T extends { type: string; label: string; keywords?: string[] }>(
  items: T[],
  query: string,
  favorites: Set<string>,
): T[] {
  const needle = normalize(query);
  const score = (item: T) => {
    const fav = favorites.has(item.type) ? 2 : 0;
    if (!needle) return fav;
    const hay = normalize(`${item.label} ${item.type} ${(item.keywords ?? []).join(' ')}`);
    const exact = hay.startsWith(needle) || normalize(item.label).startsWith(needle) ? 1 : 0;
    return fav * 10 + exact;
  };
  return [...items].sort((a, b) => score(b) - score(a));
}
