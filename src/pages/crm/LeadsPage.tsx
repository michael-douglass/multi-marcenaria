import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Plus, Search, UserRound, X } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { PipelineLeadModal } from '@/components/crm/PipelineLeadModal'
import { MarkupCalculatorSheet } from '@/components/crm/MarkupCalculatorSheet'
import { useCrmPipeline } from '@/hooks/useCrmPipeline'
import { useCrmMarkup, useCrmMarkupResumos } from '@/hooks/useCrmMarkup'
import { useApp } from '@/context/AppContext'
import { canAccessCrmPath } from '@/lib/crm-identity'
import { markupResumoMap, orcamentosDoLead, resumoComoLista } from '@/lib/crm-markup'
import type { MarkupOrcamento } from '@/lib/markup-types'
import {
  collectStatusOptions,
  filterPipelineLeads,
  uniqueLeadOrigins,
  uniqueLeadVendors,
  type CrmDateFilter,
  type CrmLeadCard,
} from '@/lib/crm-pipeline'
import { fmtCur, fmtDate } from '@/lib/utils'
import { showToast } from '@/lib/toast'

export function LeadsPage() {
  const navigate = useNavigate()
  const { crmProfile, userProfile } = useApp()
  const canEditMarkup = canAccessCrmPath('/markup', crmProfile, userProfile)
  const { data, loading, error, salvar, criar } = useCrmPipeline()
  const { resumos } = useCrmMarkupResumos()
  const markupApi = useCrmMarkup(canEditMarkup)
  const resumoPorLead = useMemo(() => markupResumoMap(resumos), [resumos])
  const [busca, setBusca] = useState('')
  const [vendedorId, setVendedorId] = useState('all')
  const [origem, setOrigem] = useState('all')
  const [status, setStatus] = useState('all')
  const [dateFilter, setDateFilter] = useState<CrmDateFilter>('all')
  const [selected, setSelected] = useState<CrmLeadCard | null>(null)
  const [creating, setCreating] = useState(false)
  const [markupAberto, setMarkupAberto] = useState<MarkupOrcamento | null>(null)
  const [savingMarkup, setSavingMarkup] = useState(false)

  const etapas = useMemo(
    () => [...data.etapas].sort((a, b) => a.ordem - b.ordem).map(e => e.nome),
    [data.etapas],
  )
  const statusOptions = useMemo(
    () => collectStatusOptions(etapas, data.quadros),
    [etapas, data.quadros],
  )
  const vendedores = useMemo(() => uniqueLeadVendors(data.leads), [data.leads])
  const origens = useMemo(() => uniqueLeadOrigins(data.leads), [data.leads])
  const leads = useMemo(
    () => filterPipelineLeads(data.leads, { busca, vendedorId, origem, dateFilter, status }),
    [data.leads, busca, vendedorId, origem, dateFilter, status],
  )
  const hasActiveFilters = busca.trim() !== ''
    || vendedorId !== 'all'
    || origem !== 'all'
    || status !== 'all'
    || dateFilter !== 'all'

  const abrirMarkupDoLead = async (current: CrmLeadCard, orcamentoId?: string) => {
    setSelected(null)
    setCreating(false)
    try {
      if (orcamentoId) {
        setMarkupAberto(await markupApi.obter(orcamentoId))
        return
      }
      const resumo = resumoPorLead.get(current.id)
      if (resumo) setMarkupAberto(await markupApi.obter(resumo.orcamento_id))
      else setMarkupAberto(await markupApi.criar(current.id, current.nome))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível abrir o markup.', 'error')
    }
  }

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Leads"
        subtitle={`${leads.length} de ${data.leads.length} cadastros`}
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/pipeline')}>
              Ver quadro
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Novo lead
            </Button>
          </div>
        )}
        below={(
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="relative block min-w-[220px] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="glass-input w-full pl-9"
                placeholder="Buscar nome, telefone ou origem"
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </label>
            <label className="flex min-w-[160px] items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
              <select className="glass-input w-full" value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
                <option value="all">Todos os vendedores</option>
                <option value="unassigned">Sem vendedor</option>
                {vendedores.map(item => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[150px] items-center gap-2">
              <select className="glass-input w-full" value={origem} onChange={e => setOrigem(e.target.value)}>
                <option value="all">Todas as origens</option>
                {origens.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[150px] items-center gap-2">
              <select className="glass-input w-full" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="all">Todos os status</option>
                {statusOptions.map(item => (
                  <option key={`${item.group}-${item.value}`} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[150px] items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
              <select className="glass-input w-full" value={dateFilter} onChange={e => setDateFilter(e.target.value as CrmDateFilter)}>
                <option value="all">Todas as datas</option>
                <option value="today">Hoje</option>
                <option value="current_month">Mês atual</option>
                <option value="week">Últimos 7 dias</option>
                <option value="month">Último mês</option>
              </select>
            </label>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  setBusca('')
                  setVendedorId('all')
                  setOrigem('all')
                  setStatus('all')
                  setDateFilter('all')
                }}
              >
                <X className="h-4 w-4" />
                Limpar filtros
              </Button>
            )}
          </div>
        )}
      />

      {loading && <LoadingState variant="page" message="Carregando leads..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && leads.length === 0 && (
        <EmptyState message="Nenhum lead encontrado com esse filtro." />
      )}

      {!loading && !error && leads.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="obra-scroll-x-mobile overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-[0.7rem] uppercase tracking-wide text-[#b8957f]">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">Vendedor</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer border-t border-[rgba(240,210,140,0.12)] hover:bg-white/5"
                    onClick={() => setSelected(lead)}
                  >
                    <td className="px-3 py-2 font-semibold text-[#f2d892]">
                      <span className="inline-flex items-center gap-1.5">
                        {lead.nome}
                        {lead.darAtencao && (
                          <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
                            Atenção
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#edd9c4]">{lead.telefone || '—'}</td>
                    <td className="px-3 py-2 text-[#d4bc9f]">{lead.email || '—'}</td>
                    <td className="px-3 py-2 text-[#d4bc9f]">{lead.origem || '—'}</td>
                    <td className="px-3 py-2 text-[#d4bc9f]">{lead.vendedorNome || '—'}</td>
                    <td className="px-3 py-2 text-[#edd9c4]">{lead.status}</td>
                    <td className="px-3 py-2 text-[#d4bc9f]">{fmtDate(lead.dataChegada)}</td>
                    <td className="px-3 py-2 text-right text-[#4ade80]">
                      {Number(lead.valorOrcamento || lead.valorNegocio) > 0
                        ? fmtCur(Number(lead.valorOrcamento || lead.valorNegocio))
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PipelineLeadModal
        lead={selected}
        creating={creating}
        statusOptions={statusOptions}
        canOpenMarkup={canEditMarkup}
        markupItens={selected
          ? (orcamentosDoLead(markupApi.data.orcamentos, selected.id).length
              ? orcamentosDoLead(markupApi.data.orcamentos, selected.id)
              : resumoComoLista(resumoPorLead.get(selected.id)))
          : []}
        onOpenMarkup={async orcamentoId => {
          if (!selected) return
          await abrirMarkupDoLead(selected, orcamentoId)
        }}
        onOpenLousa={() => {
          if (!selected) return
          const leadId = selected.id
          setSelected(null)
          navigate(`/leads/${leadId}/lousa`)
        }}
        onOpenContrato={() => {
          setSelected(null)
          navigate('/contratos')
        }}
        onOpenSlides={() => {
          setSelected(null)
          navigate('/orcamento-slides')
        }}
        onOpenAgenda={() => {
          setSelected(null)
          navigate('/agenda-comercial')
        }}
        onClose={() => {
          setSelected(null)
          setCreating(false)
        }}
        onSave={salvar}
        onCreate={async input => {
          await criar(input)
        }}
      />

      <MarkupCalculatorSheet
        open={!!markupAberto}
        orcamento={markupAberto}
        config={markupApi.data.config}
        produtos={markupApi.data.produtos}
        categorias={markupApi.data.categorias}
        despesas={markupApi.data.despesas}
        servicos={markupApi.data.servicos}
        saving={savingMarkup}
        onClose={() => setMarkupAberto(null)}
        onSave={async input => {
          setSavingMarkup(true)
          try {
            await markupApi.salvar(input)
            setMarkupAberto(null)
          } finally {
            setSavingMarkup(false)
          }
        }}
      />
    </CrmPageFrame>
  )
}
