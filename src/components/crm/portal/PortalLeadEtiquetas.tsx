import type { PortalLeadEtiqueta } from '@/lib/crm-portal'

const LABELS: Record<PortalLeadEtiqueta, string> = {
  cliente_pagou: 'Cliente pagou',
  voce_ja_sacou: 'Você já sacou esse valor',
}

export function PortalLeadEtiquetas({ etiquetas }: { etiquetas: PortalLeadEtiqueta[] }) {
  if (etiquetas.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {etiquetas.map(tag => (
        <span
          key={tag}
          className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
          style={{
            color: tag === 'cliente_pagou' ? 'rgba(74,222,128,0.95)' : 'rgba(240,210,140,0.9)',
            border: `1px solid ${tag === 'cliente_pagou' ? 'rgba(74,222,128,0.35)' : 'rgba(240,210,140,0.3)'}`,
            background: tag === 'cliente_pagou' ? 'rgba(74,222,128,0.1)' : 'rgba(240,210,140,0.08)',
            fontFamily: 'Raleway, sans-serif',
          }}
        >
          {LABELS[tag]}
        </span>
      ))}
    </div>
  )
}
