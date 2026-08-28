import type { ComissaoLead } from '@/hooks/usePontuaGarboFinanceiro';
import type { PrestadorLeadEtiqueta } from '@/lib/prestador-lead-etiquetas';
import { PrestadorLeadEtiquetas } from '@/components/prestador/PrestadorLeadEtiquetas';
import { Eye, Lock } from 'lucide-react';

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function statusColor(status: string): string {
  if (status.includes('Venda Realizada')) return '#22c55e';
  if (status.includes('Negociação')) return '#3b82f6';
  if (status.includes('Experimental')) return '#f59e0b';
  return '#94a3b8';
}

interface PrestadorPortalLeadCardProps {
  lead: ComissaoLead;
  etiquetas?: PrestadorLeadEtiqueta[];
  podeAbrir: boolean;
  onOpenDetalhes: (lead: ComissaoLead) => void;
  onSemPermissao: () => void;
}

export function PrestadorPortalLeadCard({
  lead,
  etiquetas = [],
  podeAbrir,
  onOpenDetalhes,
  onSemPermissao,
}: PrestadorPortalLeadCardProps) {
  const handleClick = () => {
    if (podeAbrir) onOpenDetalhes(lead);
    else onSemPermissao();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-xl p-4 flex flex-col gap-2 text-left w-full transition-all duration-200 group"
      style={{
        background: podeAbrir
          ? 'rgba(255,255,255,0.05)'
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${podeAbrir ? 'rgba(240,210,140,0.22)' : 'rgba(255,255,255,0.08)'}`,
        backdropFilter: 'blur(12px)',
        cursor: 'pointer',
        boxShadow: podeAbrir ? '0 4px 24px rgba(0,0,0,0.25)' : undefined,
      }}
      onMouseEnter={(e) => {
        if (!podeAbrir) return;
        e.currentTarget.style.borderColor = 'rgba(240,210,140,0.45)';
        e.currentTarget.style.background = 'rgba(240,210,140,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = podeAbrir
          ? 'rgba(240,210,140,0.22)'
          : 'rgba(255,255,255,0.08)';
        e.currentTarget.style.background = podeAbrir
          ? 'rgba(255,255,255,0.05)'
          : 'rgba(255,255,255,0.04)';
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ background: statusColor(lead.leadStatus) }}
          />
          <span className="text-white/40 text-xs truncate">{lead.leadStatus}</span>
        </div>
        {podeAbrir ? (
          <Eye
            size={14}
            className="shrink-0 opacity-40 group-hover:opacity-90 transition-opacity"
            style={{ color: '#f2d892' }}
          />
        ) : (
          <Lock size={12} className="shrink-0 opacity-30" />
        )}
      </div>
      <p className="text-white font-medium text-sm leading-tight">{lead.leadNome}</p>
      <PrestadorLeadEtiquetas etiquetas={etiquetas} />
      <p className="text-white/30 text-xs">{lead.fieldNome}</p>
      <div className="mt-auto pt-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-white/30 text-xs">
          {BRL(lead.valorOrcamento)} × {lead.percentual}%
        </span>
        <span className="text-sm font-semibold" style={{ color: '#f2d892' }}>
          {BRL(lead.comissao)}
        </span>
      </div>
      {podeAbrir && (
        <span
          className="text-[10px] tracking-wide uppercase opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'rgba(240,210,140,0.65)', fontFamily: 'Raleway, sans-serif' }}
        >
          Abrir projeto
        </span>
      )}
    </button>
  );
}
