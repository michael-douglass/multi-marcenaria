import { MarkupCalculatorSheet } from '@/components/markup/MarkupCalculatorSheet';
import {
  closeMarkupSheetSession,
  useMarkupSheetSession,
} from '@/lib/markup-sheet-session';

interface MarkupSheetHostProps {
  leadId: number;
  leadNome?: string;
  onOrcamentoSync?: (valor: number, options?: { force?: boolean }) => boolean | void;
  readOnly?: boolean;
}

/**
 * Hospeda a calculadora no nível do card do lead (não dentro da aba Detalhes).
 * Assim, ao editar quantidade/preço, a aba pode re-renderizar sem desmontar o Sheet.
 */
export function MarkupSheetHost({
  leadId,
  leadNome,
  onOrcamentoSync,
  readOnly = false,
}: MarkupSheetHostProps) {
  const session = useMarkupSheetSession();
  const open = !readOnly && session?.leadId === leadId;

  if (readOnly) return null;

  return (
    <MarkupCalculatorSheet
      key={`markup-host-${leadId}`}
      open={Boolean(open)}
      modal={false}
      onOpenChange={(next) => {
        if (!next) closeMarkupSheetSession();
      }}
      leadId={leadId}
      leadNome={session?.leadNome ?? leadNome}
      orcamentoId={session?.orcamentoId ?? null}
      forceNovo={session?.forceNovo ?? false}
      onPrecoFinalChange={(valor) => {
        onOrcamentoSync?.(valor, { force: true });
      }}
    />
  );
}
