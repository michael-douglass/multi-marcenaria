import { cn } from '@/lib/utils';

interface AmbienteAtmosphereFoilProps {
  className?: string;
  intensity?: number;
}

/**
 * Véu de luz quente — CSS, não WebGL.
 * O navegador só aguenta poucos palcos 3D ao mesmo tempo; o 3D fica reservado aos móveis.
 */
export function AmbienteAtmosphereFoil({ className, intensity = 1 }: AmbienteAtmosphereFoilProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ opacity: Math.min(1, Math.max(0.15, intensity * 0.72)) }}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(70% 55% at 78% 16%, rgba(255,246,234,0.18), transparent 58%)',
            'radial-gradient(80% 70% at 12% 88%, rgba(242,216,146,0.12), transparent 52%)',
            'linear-gradient(180deg, rgba(58,36,28,0.22), transparent 42%)',
          ].join(', '),
        }}
      />
    </div>
  );
}
