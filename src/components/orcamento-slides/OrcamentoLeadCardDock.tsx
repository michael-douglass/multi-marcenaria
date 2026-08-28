import { useEffect, useState } from 'react';
import { Contact, Maximize2 } from 'lucide-react';
import { LeadModal } from '@/components/leads/LeadModal';
import { cn } from '@/lib/utils';

interface OrcamentoLeadCardDockProps {
  leadId: number;
  leadNome?: string | null;
  /** Classe extra no botão da miniatura (ex.: alinhamento no rodapé). */
  className?: string;
  /** Abre o card do lead imediatamente (ex.: clique na lista de contratos). */
  defaultOpen?: boolean;
  /** Fixa o atalho no canto inferior direito da tela. */
  position?: 'inline' | 'fixed';
}

/**
 * Miniatura do card do lead na tela de criar/editar orçamento ou contrato.
 * Fechado: ícone compacto (fica acima do botão Próximo, ou no canto da tela).
 * Aberto: LeadModal completo com todas as opções.
 */
export function OrcamentoLeadCardDock({
  leadId,
  leadNome,
  className,
  defaultOpen = false,
  position = 'inline',
}: OrcamentoLeadCardDockProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [currentLeadId, setCurrentLeadId] = useState(leadId);
  const nomeExibido = (leadNome || 'Lead').trim() || 'Lead';

  useEffect(() => {
    setCurrentLeadId(leadId);
  }, [leadId]);

  return (
    <>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={cn(
            'flex max-w-[min(260px,calc(100vw-8rem))] items-center gap-2',
            'rounded-xl border border-gold-border-subtle/40 bg-mahogany-panel/95 px-2.5 py-1.5',
            'shadow-md shadow-black/20 backdrop-blur-md',
            'text-left transition-all duration-200',
            'hover:border-gold/50 hover:bg-mahogany-elevated hover:shadow-gold/10',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            position === 'fixed' && 'fixed bottom-4 right-4 z-40 md:bottom-6 md:right-6',
            className,
          )}
          title={`Abrir card: ${nomeExibido}`}
          aria-label={`Abrir card do lead ${nomeExibido}`}
        >
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              'border border-gold/30 bg-gradient-to-br from-gold/20 via-amber-400/10 to-transparent',
              'shadow-inner shadow-gold/10',
            )}
            aria-hidden
          >
            <Contact className="h-4 w-4 text-gold" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-cream-muted leading-tight">
              Card do lead
            </span>
            <span className="block truncate text-xs font-medium text-cream-secondary leading-snug">
              {nomeExibido}
            </span>
          </span>
          <Maximize2 className="h-3.5 w-3.5 shrink-0 text-gold/70" aria-hidden />
        </button>
      )}

      <LeadModal
        isOpen={expanded}
        onClose={() => setExpanded(false)}
        leadId={currentLeadId}
        isEditMode
        onLeadDuplicated={(newLeadId) => setCurrentLeadId(newLeadId)}
        onLeadCreated={(newLeadId) => setCurrentLeadId(newLeadId)}
      />
    </>
  );
}
