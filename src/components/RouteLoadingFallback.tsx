import { BrandLoader } from '@/components/ui/brand-loader';

/** Fallback enquanto uma rota lazy carrega. */
export function RouteLoadingFallback() {
  return (
    <BrandLoader
      variant="inline"
      size="md"
      message="Carregando página…"
    />
  );
}
