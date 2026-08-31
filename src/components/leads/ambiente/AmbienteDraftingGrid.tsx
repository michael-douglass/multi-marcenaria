import { cn } from '@/lib/utils';

interface AmbienteDraftingGridProps {
  active?: boolean;
  className?: string;
}

/**
 * Grade de atelier na lousa — CSS, só visível quando uma forma está ativa.
 */
export function AmbienteDraftingGrid({ active = false, className }: AmbienteDraftingGridProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-[12] transition-opacity duration-300',
        active ? 'opacity-100' : 'opacity-0',
        className,
      )}
      style={{
        backgroundImage: [
          'linear-gradient(rgba(242,216,146,0.11) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(242,216,146,0.11) 1px, transparent 1px)',
          'linear-gradient(rgba(242,216,146,0.045) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(242,216,146,0.045) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '12.5% 20%, 12.5% 20%, 4.167% 6.667%, 4.167% 6.667%',
      }}
      aria-hidden
    />
  );
}
