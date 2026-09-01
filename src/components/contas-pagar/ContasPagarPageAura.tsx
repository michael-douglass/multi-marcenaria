import { CobrancasPageAura } from '@/components/cobrancas/CobrancasPageAura'

/** Véu do livro-caixa de saídas — o brilho de ouro nasce no canto oposto ao de cobranças. */
export function ContasPagarPageAura({ className }: { className?: string }) {
  return <CobrancasPageAura className={className} variant="pagar" />
}
