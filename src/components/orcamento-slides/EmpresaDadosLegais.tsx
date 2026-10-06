import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { useEmpresa, GARBO_CNPJ, GARBO_RAZAO_SOCIAL } from '@/contexts/EmpresaContext';

interface EmpresaDadosLegaisProps {
  color?: string;
  className?: string;
  style?: CSSProperties;
  /** compact = uma linha; stacked = rótulos empilhados (capa / PDF). */
  variant?: 'stacked' | 'inline';
  align?: 'left' | 'center' | 'right';
}

/**
 * Razão social e CNPJ da casa — aparecem na capa e no slide de investimento
 * (e, portanto, no PDF/impressão da apresentação).
 */
export function EmpresaDadosLegais({
  color = 'rgba(242, 216, 146, 0.88)',
  className,
  style,
  variant = 'stacked',
  align = 'left',
}: EmpresaDadosLegaisProps) {
  const { empresa } = useEmpresa();
  const razao = empresa?.razao_social?.trim() || GARBO_RAZAO_SOCIAL;
  const cnpj = empresa?.cnpj?.trim() || GARBO_CNPJ;
  const textAlign = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  if (variant === 'inline') {
    return (
      <p
        className={cn('w-full max-w-full tracking-wide', textAlign, className)}
        style={{
          color,
          fontSize: 'clamp(0.7rem, 1.6cqi, 0.82rem)',
          letterSpacing: '0.06em',
          lineHeight: 1.5,
          ...style,
        }}
      >
        Razão Social: {razao}
        <span aria-hidden style={{ opacity: 0.45 }}>
          {' '}
          ·{' '}
        </span>
        CNPJ: {cnpj}
      </p>
    );
  }

  return (
    <div
      className={cn('w-full max-w-full space-y-1', textAlign, className)}
      style={{ color, ...style }}
    >
      <p
        className="m-0"
        style={{
          fontSize: 'clamp(0.68rem, 1.55cqi, 0.8rem)',
          letterSpacing: '0.04em',
          lineHeight: 1.45,
        }}
      >
        <span
          className="block opacity-80"
          style={{
            fontSize: '0.65em',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          Razão Social
        </span>
        {razao}
      </p>
      <p
        className="m-0"
        style={{
          fontSize: 'clamp(0.68rem, 1.55cqi, 0.8rem)',
          letterSpacing: '0.04em',
          lineHeight: 1.45,
        }}
      >
        <span
          className="block opacity-80"
          style={{
            fontSize: '0.65em',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          CNPJ
        </span>
        {cnpj}
      </p>
    </div>
  );
}
