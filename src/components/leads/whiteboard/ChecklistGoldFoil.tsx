import { cn } from '@/lib/utils';

interface ChecklistGoldFoilProps {
  className?: string;
}

/**
 * Folha de ouro no catálogo — CSS, sem abrir palco 3D.
 */
export function ChecklistGoldFoil({ className }: ChecklistGoldFoilProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(90% 50% at 50% 0%, rgba(242,216,146,0.16), transparent 55%)',
            'linear-gradient(180deg, rgba(42,24,18,0.08), transparent 40%)',
          ].join(', '),
        }}
      />
    </div>
  );
}
