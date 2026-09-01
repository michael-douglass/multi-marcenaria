import { CobrancasPageAura } from '@/components/cobrancas/CobrancasPageAura'

/** Véu do álbum: lâmpada de galeria no topo e grelha de folha de contato. */
export function BibliotecaPageAura({ className }: { className?: string }) {
  return <CobrancasPageAura className={className} variant="acervo" />
}
