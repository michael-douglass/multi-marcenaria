import { useCallback, useState } from 'react';
import {
  isFurnitureFavorite,
  loadFurnitureFavorites,
  toggleFurnitureFavorite,
} from '@/lib/furniture-favorites';

/** Estrelas de favorito ficam no navegador — a busca passa a mostrar primeiro o que você marcou. */
export function useFurnitureFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFurnitureFavorites());

  const toggle = useCallback((type: string) => {
    setFavorites((current) => toggleFurnitureFavorite(type, current));
  }, []);

  const isFavorite = useCallback(
    (type: string) => isFurnitureFavorite(type, favorites),
    [favorites],
  );

  return { favorites, toggle, isFavorite };
}
