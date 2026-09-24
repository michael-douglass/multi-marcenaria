import { OrcamentoSlideExportMenu } from '@/components/orcamento-slides/OrcamentoSlideExportMenu';
import { useOrcamentoSlideExportBackground } from '@/contexts/OrcamentoSlideExportBackgroundContext';
import { cn } from '@/lib/utils';

interface OrcamentoSlideExportByIdButtonProps {
  orcamentoId: string;
  /** Nome amigável do arquivo (cliente ou identificador). */
  titulo: string;
  className?: string;
  /** Variante compacta para a lista do card do lead. */
  compact?: boolean;
}

/**
 * Enfileira exportação PDF/imagens em segundo plano (fora do card do lead).
 * Continua mesmo com orçamento fechado/minimizado ou card fechado.
 */
export function OrcamentoSlideExportByIdButton({
  orcamentoId,
  titulo,
  className,
  compact = false,
}: OrcamentoSlideExportByIdButtonProps) {
  const { startBackgroundExport, isExportingOrcamento } = useOrcamentoSlideExportBackground();
  const isExporting = isExportingOrcamento(orcamentoId);

  return (
    <OrcamentoSlideExportMenu
      portalMode="inline"
      onExport={(viewport, format) => {
        startBackgroundExport({ orcamentoId, titulo, viewport, format });
      }}
      isExporting={isExporting}
      label="Exportar"
      className={cn(
        compact &&
          'h-8 gap-1 px-2 text-xs shadow-none bg-amber-600/90 hover:bg-amber-700 border-amber-500/20',
        className,
      )}
    />
  );
}
