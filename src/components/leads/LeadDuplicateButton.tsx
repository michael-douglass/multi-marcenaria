import { CopyPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LeadDuplicateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  /** No mobile, só ícone (como Compartilhar). */
  iconOnly?: boolean;
}

/**
 * Botão de duplicar lead no cabeçalho do card.
 * Visual mogno/ouro alinhado ao LeadModal — camadas douradas sugerem “cópia”.
 */
export function LeadDuplicateButton({
  onClick,
  disabled,
  isLoading,
  className,
  iconOnly = false,
}: LeadDuplicateButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? 'icon' : 'sm'}
      disabled={disabled || isLoading}
      onClick={onClick}
      title="Duplicar este lead com todas as informações"
      aria-label="Duplicar lead"
      className={cn(
        'group/dup relative overflow-hidden',
        'border-gold-border-subtle/45 bg-mahogany-muted/35 text-cream-secondary',
        'shadow-inner shadow-black/10',
        'transition-[color,background-color,border-color,box-shadow,transform] duration-300 ease-out',
        'hover:border-gold/55 hover:bg-gradient-to-br hover:from-gold/15 hover:via-mahogany-elevated/40 hover:to-gold/5',
        'hover:text-gold hover:shadow-[0_0_20px_-8px_rgba(242,216,146,0.45)]',
        'active:scale-[0.97]',
        'focus-visible:ring-gold/40',
        !iconOnly && 'flex items-center gap-2 px-3',
        iconOnly && 'h-9 w-9',
        className,
      )}
    >
      {/* Brilho sutil ao passar o mouse */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 -translate-x-full opacity-0',
          'bg-gradient-to-r from-transparent via-gold/20 to-transparent',
          'transition-all duration-500 ease-out',
          'group-hover/dup:translate-x-full group-hover/dup:opacity-100',
        )}
      />
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gold" />
      ) : (
        <CopyPlus
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-300',
            'group-hover/dup:scale-110 group-hover/dup:rotate-3',
          )}
        />
      )}
      {!iconOnly && (
        <span className="relative hidden sm:inline text-xs font-semibold tracking-wide uppercase">
          Duplicar
        </span>
      )}
    </Button>
  );
}
