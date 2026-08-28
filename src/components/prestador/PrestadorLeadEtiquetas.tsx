import type { PrestadorLeadEtiqueta } from '@/lib/prestador-lead-etiquetas';
import { PRESTADOR_LEAD_ETIQUETA_LABELS } from '@/lib/prestador-lead-etiquetas';

const STYLES: Record<
  PrestadorLeadEtiqueta,
  { color: string; border: string; background: string }
> = {
  cliente_pagou: {
    color: 'rgba(74,222,128,0.95)',
    border: 'rgba(74,222,128,0.45)',
    background: 'rgba(74,222,128,0.12)',
  },
  voce_ja_sacou: {
    color: 'rgba(240,210,140,0.95)',
    border: 'rgba(240,210,140,0.45)',
    background: 'rgba(240,210,140,0.12)',
  },
};

interface PrestadorLeadEtiquetasProps {
  etiquetas: PrestadorLeadEtiqueta[];
  className?: string;
}

export function PrestadorLeadEtiquetas({ etiquetas, className }: PrestadorLeadEtiquetasProps) {
  if (etiquetas.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ''}`}>
      {etiquetas.map((tag) => {
        const style = STYLES[tag];
        return (
          <span
            key={tag}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              tag === 'voce_ja_sacou' ? 'normal-case tracking-normal' : 'uppercase tracking-wide'
            }`}
            style={{
              color: style.color,
              border: `1px solid ${style.border}`,
              background: style.background,
              fontFamily: 'Raleway, sans-serif',
            }}
          >
            {PRESTADOR_LEAD_ETIQUETA_LABELS[tag]}
          </span>
        );
      })}
    </div>
  );
}
