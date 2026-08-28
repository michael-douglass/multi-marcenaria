import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import './cubo-magico.css';

interface CuboMagicoFundoProps {
  /** Liga o efeito (desligar em previewMode / exportação). */
  enabled?: boolean;
  mobile?: boolean;
  /** dark = foto cinematográfica; warm = painel pêssego/ferragens. */
  variant?: 'dark' | 'warm';
  className?: string;
  /** Atraso extra da onda (ex.: bloco que entra depois na tela). */
  delayMs?: number;
}

interface CuboMagicoLensProps {
  enabled?: boolean;
  /** 'content' = logo (~1.08); 'bg' = fundo (~1.04). */
  kind?: 'content' | 'bg';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

/** Duração total do ciclo (onda + cubo + pausa), em segundos. */
export function cuboMagicoPeriodSec(mobile: boolean): number {
  const cols = mobile ? 4 : 6;
  const rows = 4;
  const lastDelay = (cols - 1) * 0.42 + (rows - 1) * 0.09;
  return +(lastDelay + 1.6 + 2.8).toFixed(2);
}

/** Variável CSS para sincronizar cubos e zoom de lente. */
export function cuboMagicoPeriodStyle(mobile: boolean): CSSProperties {
  return { ['--cm-period' as string]: `${cuboMagicoPeriodSec(mobile)}s` };
}

/**
 * Grade de cubos 3D com onda L→R. Invisível quando parado.
 * Desktop 4×6 · Mobile 4×4.
 */
export function CuboMagicoFundo({
  enabled = true,
  mobile = false,
  variant = 'dark',
  className,
  delayMs = 0,
}: CuboMagicoFundoProps) {
  const reduced = usePrefersReducedMotion();
  const cols = mobile ? 4 : 6;
  const rows = 4;

  const cells = useMemo(() => {
    const list: Array<{ key: string; col: number; row: number; delay: number; lens: boolean }> = [];
    const centerCols =
      cols === 6 ? new Set([2, 3]) : new Set([1, 2]);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const delay = delayMs + col * 420 + row * 90;
        list.push({
          key: `${col}-${row}`,
          col,
          row,
          delay,
          lens: centerCols.has(col),
        });
      }
    }
    return list;
  }, [cols, rows, delayMs]);

  // Período: último atraso relativo + 1.6s + pausa 2.8s
  const periodSec = useMemo(() => cuboMagicoPeriodSec(mobile), [mobile]);

  if (!enabled || reduced) return null;

  return (
    <div
      className={cn('cubo-magico-layer absolute inset-0 z-[3]', className)}
      data-variant={variant}
      data-cubo-magico=""
      aria-hidden
      style={
        {
          '--cm-cols': cols,
          '--cm-rows': rows,
          '--cm-period': `${periodSec}s`,
        } as CSSProperties
      }
    >
      <div className="cubo-magico-scene">
        {cells.map((cell) => (
          <div
            key={cell.key}
            className="cubo-magico-cell"
            data-lens={cell.lens ? 'true' : undefined}
            style={{ animationDelay: `${cell.delay}ms` }}
          >
            <div className="cubo-magico-face" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Envolve logo/texto ou fundo para o zoom de lente sincronizado. */
export function CuboMagicoLens({
  enabled = true,
  kind = 'content',
  className,
  style,
  children,
}: CuboMagicoLensProps) {
  const reduced = usePrefersReducedMotion();
  const active = enabled && !reduced;

  return (
    <div
      className={cn(
        active
          ? kind === 'bg'
            ? 'cubo-magico-lens-bg'
            : 'cubo-magico-lens-target'
          : undefined,
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
