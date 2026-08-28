import { Eye, Lock } from 'lucide-react'
import type { PortalComissaoLead, PortalLeadEtiqueta } from '@/lib/crm-portal'
import { fmtCur } from '@/lib/utils'
import { PortalLeadEtiquetas } from '@/components/crm/portal/PortalLeadEtiquetas'

function statusColor(status: string): string {
  if (/ganh|venda realizada/i.test(status)) return '#22c55e'
  if (/negocia/i.test(status)) return '#3b82f6'
  if (/perdid/i.test(status)) return '#ef4444'
  return '#94a3b8'
}

interface PortalLeadCardProps {
  lead: PortalComissaoLead
  etiquetas?: PortalLeadEtiqueta[]
  podeAbrir: boolean
  onOpen: (lead: PortalComissaoLead) => void
  onSemPermissao: () => void
}

export function PortalLeadCard({ lead, etiquetas = [], podeAbrir, onOpen, onSemPermissao }: PortalLeadCardProps) {
  return (
    <button
      type="button"
      onClick={() => (podeAbrir ? onOpen(lead) : onSemPermissao())}
      className="group flex w-full flex-col gap-2 rounded-xl p-4 text-left transition-all"
      style={{
        background: podeAbrir ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${podeAbrir ? 'rgba(240,210,140,0.22)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: statusColor(lead.leadStatus) }} />
          <span className="truncate text-xs text-white/40">{lead.leadStatus}</span>
        </div>
        {podeAbrir
          ? <Eye size={14} className="shrink-0 opacity-40 group-hover:opacity-90" style={{ color: '#f2d892' }} />
          : <Lock size={12} className="shrink-0 opacity-30" />}
      </div>
      <p className="text-sm font-medium leading-tight text-white">{lead.leadNome}</p>
      <PortalLeadEtiquetas etiquetas={etiquetas} />
      <p className="text-xs text-white/30">{lead.fieldNome}</p>
      <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-2">
        <span className="text-xs text-white/30">{fmtCur(lead.valorOrcamento)} × {lead.percentual}%</span>
        <span className="text-sm font-semibold" style={{ color: '#f2d892' }}>{fmtCur(lead.comissao)}</span>
      </div>
    </button>
  )
}
