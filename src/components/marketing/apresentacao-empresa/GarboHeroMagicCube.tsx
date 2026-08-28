import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface GarboHeroMagicCubeProps {
  className?: string;
  /** Dispara quando a onda chega nas colunas do centro (logo). */
  onLensFocus?: (focused: boolean) => void;
}

interface CubeCell {
  id: string;
  row: number;
  col: number;
  isCenter: boolean;
}

/** Atraso entre colunas — forma a onda (mais lenta) */
const COL_STAGGER_MS = 420;
/** Atraso vertical dentro da coluna */
const ROW_STAGGER_MS = 90;
/** Duração do giro de um cubinho */
const SPIN_MS = 1600;
/** Pausa após a onda chegar ao fim, antes de recomeçar */
const WAVE_PAUSE_MS = 2800;
/** Quanto tempo o zoom na logo permanece ativo */
const LENS_HOLD_MS = 1800;

/**
 * Cubo mágico no banner:
 * - cubos invisíveis e parados
 * - só aparecem quando a onda os levanta (sem girar)
 * - ao cruzar o centro, avisa para zoom na logo (lentes)
 */
export function GarboHeroMagicCube({ className, onLensFocus }: GarboHeroMagicCubeProps) {
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(6);
  const [waveKey, setWaveKey] = useState(0);
  const [waveActive, setWaveActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mqMobile = window.matchMedia('(max-width: 639px)');

    const sync = () => {
      setReducedMotion(mqMotion.matches);
      if (mqMobile.matches) {
        setRows(4);
        setCols(4);
      } else {
        setRows(4);
        setCols(6);
      }
    };

    sync();
    mqMotion.addEventListener('change', sync);
    mqMobile.addEventListener('change', sync);
    return () => {
      mqMotion.removeEventListener('change', sync);
      mqMobile.removeEventListener('change', sync);
    };
  }, []);

  const centerCols = useMemo(() => {
    if (cols <= 2) return [0, cols - 1].filter((c, i, a) => a.indexOf(c) === i);
    const mid = (cols - 1) / 2;
    return [Math.floor(mid), Math.ceil(mid)].filter((c, i, a) => a.indexOf(c) === i);
  }, [cols]);

  const cells = useMemo<CubeCell[]>(() => {
    const list: CubeCell[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        list.push({
          id: `cube-${row}-${col}`,
          row,
          col,
          isCenter: centerCols.includes(col),
        });
      }
    }
    return list;
  }, [rows, cols, centerCols]);

  useEffect(() => {
    if (reducedMotion || cols === 0) {
      onLensFocus?.(false);
      return;
    }

    let cancelled = false;
    const timers: number[] = [];

    const waveDuration =
      SPIN_MS + (cols - 1) * COL_STAGGER_MS + (rows - 1) * ROW_STAGGER_MS;

    /** Momento em que a onda chega no centro da grade (logo) */
    const lensAt = centerCols[0] * COL_STAGGER_MS + SPIN_MS * 0.28;

    const runWave = () => {
      if (cancelled) return;
      setWaveActive(true);
      setWaveKey((k) => k + 1);
      onLensFocus?.(false);

      const lensOnId = window.setTimeout(() => {
        if (!cancelled) onLensFocus?.(true);
      }, lensAt);
      timers.push(lensOnId);

      const lensOffId = window.setTimeout(() => {
        if (!cancelled) onLensFocus?.(false);
      }, lensAt + LENS_HOLD_MS);
      timers.push(lensOffId);

      const hideId = window.setTimeout(() => {
        if (!cancelled) setWaveActive(false);
      }, waveDuration);
      timers.push(hideId);

      const nextId = window.setTimeout(() => {
        if (!cancelled) runWave();
      }, waveDuration + WAVE_PAUSE_MS);
      timers.push(nextId);
    };

    const startId = window.setTimeout(runWave, 400);
    timers.push(startId);

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      onLensFocus?.(false);
    };
  }, [cols, rows, reducedMotion, centerCols, onLensFocus]);

  return (
    <div
      className={cn('garbo-magic-cube pointer-events-none absolute inset-0 z-[2]', className)}
      aria-hidden
      style={{ perspective: '1400px', perspectiveOrigin: '50% 40%' }}
    >
      <div
        className="absolute inset-[2.5%] grid gap-[2px] sm:inset-[3.5%] sm:gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {cells.map((cell) => {
          const delayMs = cell.col * COL_STAGGER_MS + cell.row * ROW_STAGGER_MS;

          return (
            <div
              key={cell.id}
              className="garbo-magic-cell relative min-h-0 min-w-0"
              style={{
                transformStyle: 'preserve-3d',
                transformOrigin: 'center center',
                background: 'transparent',
              }}
            >
              {waveActive && (
                <div
                  key={`${cell.id}-${waveKey}`}
                  className={cn(
                    'garbo-magic-lift absolute inset-0 rounded-[2px]',
                    cell.isCenter && 'garbo-magic-lens',
                  )}
                  style={{
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'center bottom',
                    animationDelay: `${delayMs}ms`,
                    border: cell.isCenter
                      ? '1px solid rgba(242,216,146,0.65)'
                      : '1px solid rgba(242,216,146,0.45)',
                    background: cell.isCenter
                      ? `
                        radial-gradient(circle at 35% 30%, rgba(255,250,244,0.35), transparent 45%),
                        radial-gradient(circle at 50% 50%, rgba(242,216,146,0.18), rgba(8,6,4,0.12) 70%),
                        linear-gradient(145deg, rgba(242,216,146,0.2), rgba(26,18,12,0.25))
                      `
                      : 'linear-gradient(145deg, rgba(242,216,146,0.22), rgba(26,18,12,0.35) 55%, rgba(8,6,4,0.2))',
                    boxShadow: cell.isCenter
                      ? 'inset 0 0 0 1px rgba(242,216,146,0.55), 0 0 28px rgba(242,216,146,0.28), inset 0 0 24px rgba(255,250,244,0.12)'
                      : 'inset 0 0 0 1px rgba(242,216,146,0.4), 0 0 22px rgba(242,216,146,0.18)',
                    backdropFilter: cell.isCenter ? 'blur(1.5px) saturate(1.15)' : undefined,
                  }}
                >
                  <div
                    className="absolute inset-y-0 right-0 w-[5px] origin-right sm:w-[6px]"
                    style={{
                      background: 'linear-gradient(90deg, rgba(28,20,14,0.7), rgba(8,6,4,0.45))',
                      transform: 'rotateY(90deg)',
                      backfaceVisibility: 'hidden',
                    }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-[5px] origin-bottom sm:h-[6px]"
                    style={{
                      background: 'linear-gradient(180deg, rgba(26,18,12,0.65), rgba(6,5,4,0.4))',
                      transform: 'rotateX(-90deg)',
                      backfaceVisibility: 'hidden',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
