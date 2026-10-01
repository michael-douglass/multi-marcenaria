import { useState } from 'react';
import { Handshake, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatarMoedaMarkup } from '@/lib/markup-calculo';
import { useLeadNegociacoes } from '@/hooks/useLeadNegociacoes';
import { LeadNegociadorDialog } from '@/components/leads/LeadNegociadorDialog';

interface LeadNegociadorContactPanelProps {
  leadId: number | null | undefined;
  leadNome?: string;
  className?: string;
  onValorNegociadoSalvo?: (valor: number) => void;
}

export function LeadNegociadorContactPanel({
  leadId,
  leadNome,
  className,
  onValorNegociadoSalvo,
}: LeadNegociadorContactPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { negociacaoFechada, isLoading } = useLeadNegociacoes(leadId);

  if (!leadId) return null;

  return (
    <div className={cn('w-full min-w-0 space-y-2', className)}>
      {negociacaoFechada ? (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={cn(
            'group relative w-full overflow-hidden rounded-xl border border-gold/40 text-left',
            'bg-gradient-to-r from-gold/16 via-mahogany-elevated/40 to-mahogany-card/25',
            'px-4 py-3 transition-all duration-300',
            'hover:border-gold/60 hover:from-gold/22 hover:shadow-[0_10px_28px_-14px_rgba(242,216,146,0.55)]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
          )}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"
            aria-hidden
          />
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-mahogany-base/50">
              <Handshake className="h-5 w-5 text-gold" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm tracking-wide text-gold">Negociação fechada</p>
              <p className="text-xs text-cream-muted leading-relaxed">
                Valor com o cliente:{' '}
                <span className="font-semibold text-cream tabular-nums">
                  {formatarMoedaMarkup(negociacaoFechada.valor_negociado)}
                </span>
                {' · '}custo ref. {formatarMoedaMarkup(negociacaoFechada.piso)}
                {negociacaoFechada.status === 'aplicada_markup'
                  ? ' · já aplicada no markup'
                  : ' · no valor do orçamento'}
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-gold/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gold">
              Abrir
            </span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={isLoading}
          className={cn(
            'group relative w-full overflow-hidden rounded-xl border border-gold/30 text-left',
            'bg-gradient-to-r from-gold/12 via-mahogany-elevated/35 to-mahogany-card/20',
            'px-4 py-3 transition-all duration-300',
            'hover:border-gold/55 hover:from-gold/18 hover:shadow-[0_10px_28px_-14px_rgba(242,216,146,0.55)]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
            'disabled:opacity-60',
          )}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
            aria-hidden
          />
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-mahogany-base/50">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-gold" aria-hidden />
              ) : (
                <Handshake className="h-5 w-5 text-gold" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm tracking-wide text-gold">Abrir Negociador</p>
              <p className="text-xs text-cream-muted leading-relaxed">
                Ajuste o preço com o cliente e, ao salvar, o valor vai para o orçamento deste
                lead.
              </p>
            </div>
          </div>
        </button>
      )}

      <LeadNegociadorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        leadId={leadId}
        leadNome={leadNome}
        onValorNegociadoSalvo={onValorNegociadoSalvo}
      />
    </div>
  );
}
