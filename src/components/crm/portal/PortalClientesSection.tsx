import { useMemo } from 'react'
import { Lock } from 'lucide-react'
import type { PortalComissaoLead, PortalPermissao, PortalSaque } from '@/lib/crm-portal'
import {
  buildPrestadorLeadEtiquetasMap,
  leadEtiquetaKey,
  normalizePermissao,
  podeAbrirLeadPortal,
  sumSaquesPendentes,
} from '@/lib/crm-portal'
import { fmtCur } from '@/lib/utils'
import { PortalLeadEtiquetas } from '@/components/crm/portal/PortalLeadEtiquetas'

interface PortalClientesSectionProps {
  leads: PortalComissaoLead[]
  churnedLeads: PortalComissaoLead[]
  permissoes: PortalPermissao[]
  prestadorId: string
  saques: PortalSaque[]
  totalRetirado: number
  onOpen: (lead: PortalComissaoLead) => void
  onSemPermissao: () => void
}

export function PortalClientesSection({
  leads,
  churnedLeads,
  permissoes,
  prestadorId,
  saques,
  totalRetirado,
  onOpen,
  onSemPermissao,
}: PortalClientesSectionProps) {
  const etiquetasMap = useMemo(
    () => buildPrestadorLeadEtiquetasMap(leads, sumSaquesPendentes(saques), totalRetirado),
    [leads, saques, totalRetirado],
  )
  const permOf = (leadId: number) =>
    normalizePermissao(permissoes.find(p => p.leadId === leadId), leadId, prestadorId)

  const todos = [...leads, ...churnedLeads]

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 pb-28 pt-10 md:px-14">
      <div>
        <div className="mb-5 h-px w-10 bg-amber-400/30" />
        <h2 className="font-display text-3xl tracking-wide text-white md:text-4xl">Clientes</h2>
        <p className="mt-1 text-sm text-white/40">Só o que foi liberado para você neste portal.</p>
      </div>
      {todos.length === 0 ? (
        <p className="py-10 text-center text-sm text-white/35">Nenhum cliente vinculado ainda.</p>
      ) : (
        todos.map(lead => {
          const perm = permOf(lead.leadId)
          const podeAbrir = podeAbrirLeadPortal(perm)
          return (
            <button
              key={`${lead.leadId}-${lead.fieldId}`}
              type="button"
              onClick={() => (podeAbrir ? onOpen(lead) : onSemPermissao())}
              className="flex flex-col gap-2 rounded-xl p-4 text-left"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${podeAbrir ? 'rgba(240,210,140,0.22)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-white">{lead.leadNome}</p>
                {!podeAbrir && <Lock size={12} className="opacity-40" />}
              </div>
              <p className="text-xs text-white/40">{lead.leadStatus}</p>
              <PortalLeadEtiquetas etiquetas={etiquetasMap.get(leadEtiquetaKey(lead)) ?? []} />
              <div className="flex flex-wrap gap-1">
                {perm.podeVerDetalhes && <PermBadge label="Detalhes" />}
                {perm.podeVerLousa && <PermBadge label="Lousa" />}
                {perm.podeVerOrcamento && <PermBadge label="Orçamento" />}
                {perm.podeVerFotos && <PermBadge label="Fotos" />}
              </div>
              <p className="text-sm" style={{ color: '#f2d892' }}>{fmtCur(lead.comissao)}</p>
            </button>
          )
        })
      )}
    </div>
  )
}

function PermBadge({ label }: { label: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
      style={{
        color: 'rgba(240,210,140,0.75)',
        border: '1px solid rgba(240,210,140,0.25)',
        background: 'rgba(240,210,140,0.06)',
        fontFamily: 'Raleway, sans-serif',
      }}
    >
      {label}
    </span>
  )
}
