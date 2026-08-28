import { GarboBrandLoader } from '@/components/ui/garbo-brand-loader';

/** Fallback enquanto uma rota lazy carrega. */
export function RouteLoadingFallback() {
  return (
    <GarboBrandLoader
      variant="inline"
      size="md"
      message="Carregando página…"
    />
  );
}
