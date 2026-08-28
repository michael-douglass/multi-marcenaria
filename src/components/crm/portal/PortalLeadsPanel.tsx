import { useMemo, useState } from 'react'
import { BadgeCheck, CalendarDays, Search, X } from 'lucide-react'
import type { PortalComissaoLead, PortalLeadEtiqueta, PortalSaque } from '@/lib/crm-portal'
import {
  buildPrestadorLeadEtiquetasMap,
  leadEtiquetaKey,
  prestadorLeadMatchesSearch,
  splitLeadsByCurrentMonth,
  sumSaquesPendentes,
} from '@/lib/crm-portal'
import { PortalLeadCard } from '@/components/crm/portal/PortalLeadCard'

interface PortalLeadsPanelProps {
  leads: PortalComissaoLead[]
  saques: PortalSaque[]
  totalRetirado: number
  podeAbrirLead: (leadId: number) => boolean
  onOpen: (lead: PortalComissaoLead) => void
  onSemPermissao: () => void
}

export function PortalLeadsPanel({
  leads,
  saques,
  totalRetirado,
  podeAbrirLead,
  onOpen,
  onSemPermissao,
}: PortalLeadsPanelProps) {
  const [busca, setBusca] = useState('')
  const etiquetasMap = useMemo(
    () => buildPrestadorLeadEtiquetasMap(leads, sumSaquesPendentes(saques), totalRetirado),
    [leads, saques, totalRetirado],
  )
  const filtrados = useMemo(
    () => leads.filter(lead => prestadorLeadMatchesSearch(lead, busca)),
    [leads, busca],
  )
  const { mesAtual, outrosMeses, mesLabel } = useMemo(
    () => splitLeadsByCurrentMonth(filtrados),
    [filtrados],
  )
  const pagos = filtrados.filter(l => (etiquetasMap.get(leadEtiquetaKey(l)) ?? []).includes('cliente_pagou'))

  const etiquetasOf = (lead: PortalComissaoLead): PortalLeadEtiqueta[] =>
    etiquetasMap.get(leadEtiquetaKey(lead)) ?? []

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        <input
          className="w-full rounded-lg border bg-white/5 py-2 pl-9 pr-9 text-sm text-white outline-none placeholder:text-white/30"
          style={{ borderColor: 'rgba(240,210,140,0.2)' }}
          placeholder="Buscar cliente"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        {busca && (
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40" onClick={() => setBusca('')}>
            <X className="h-4 w-4" />
          </button>
        )}
      </label>

      <LeadGroup
        title={mesLabel}
        subtitle="Leads deste mês"
        icon={CalendarDays}
        leads={mesAtual}
        empty="Nenhum lead neste mês."
        etiquetasOf={etiquetasOf}
        podeAbrirLead={podeAbrirLead}
        onOpen={onOpen}
        onSemPermissao={onSemPermissao}
      />
      <LeadGroup
        title="Cliente pagou"
        subtitle="Vendas já fechadas"
        icon={BadgeCheck}
        leads={pagos}
        empty="Nenhuma venda paga ainda."
        variant="pago"
        etiquetasOf={etiquetasOf}
        podeAbrirLead={podeAbrirLead}
        onOpen={onOpen}
        onSemPermissao={onSemPermissao}
      />
      {outrosMeses.length > 0 && (
        <LeadGroup
          title="Outros meses"
          subtitle="Histórico"
          icon={CalendarDays}
          leads={outrosMeses}
          empty="—"
          etiquetasOf={etiquetasOf}
          podeAbrirLead={podeAbrirLead}
          onOpen={onOpen}
          onSemPermissao={onSemPermissao}
        />
      )}
    </div>
  )
}

function LeadGroup({
  title,
  subtitle,
  icon: Icon,
  leads,
  empty,
  variant,
  etiquetasOf,
  podeAbrirLead,
  onOpen,
  onSemPermissao,
}: {
  title: string
  subtitle: string
  icon: typeof CalendarDays
  leads: PortalComissaoLead[]
  empty: string
  variant?: 'pago'
  etiquetasOf: (lead: PortalComissaoLead) => PortalLeadEtiqueta[]
  podeAbrirLead: (leadId: number) => boolean
  onOpen: (lead: PortalComissaoLead) => void
  onSemPermissao: () => void
}) {
  const pago = variant === 'pago'
  return (
    <section
      className="overflow-hidden rounded-2xl"
      style={{
        background: pago
          ? 'linear-gradient(165deg, rgba(12,28,18,0.96), rgba(6,10,8,1))'
          : 'linear-gradient(165deg, rgba(22,18,12,0.92), rgba(8,8,8,1))',
        border: `1px solid ${pago ? 'rgba(74,222,128,0.28)' : 'rgba(240,210,140,0.2)'}`,
      }}
    >
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3.5" style={{ borderColor: pago ? 'rgba(74,222,128,0.18)' : 'rgba(240,210,140,0.15)' }}>
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              background: pago ? 'rgba(74,222,128,0.14)' : 'rgba(240,210,140,0.12)',
              border: `1px solid ${pago ? 'rgba(74,222,128,0.35)' : 'rgba(240,210,140,0.28)'}`,
            }}
          >
            <Icon size={16} style={{ color: pago ? 'rgba(74,222,128,0.95)' : 'rgba(240,210,140,0.9)' }} />
          </div>
          <div>
            <h3 className="font-display text-base capitalize tracking-wide text-white/90">{title}</h3>
            <p className="text-[11px] text-white/40">{subtitle}</p>
          </div>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs tabular-nums"
          style={{
            color: pago ? 'rgba(74,222,128,0.98)' : 'rgba(240,210,140,0.95)',
            border: `1px solid ${pago ? 'rgba(74,222,128,0.32)' : 'rgba(240,210,140,0.25)'}`,
          }}
        >
          {leads.length}
        </span>
      </header>
      <div className="max-h-[min(42vh,360px)] space-y-2 overflow-y-auto p-3">
        {leads.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/35">{empty}</p>
        ) : (
          leads.map(lead => (
            <PortalLeadCard
              key={`${lead.leadId}-${lead.fieldId}`}
              lead={lead}
              etiquetas={etiquetasOf(lead)}
              podeAbrir={podeAbrirLead(lead.leadId)}
              onOpen={onOpen}
              onSemPermissao={onSemPermissao}
            />
          ))
        )}
      </div>
    </section>
  )
}
