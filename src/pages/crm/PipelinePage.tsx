import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calendar, LayoutGrid, List, Plus, Search, UserRound } from 'lucide-react'
import { CrmPageFrame } from '@/components/crm/CrmPageFrame'
import { KanbanPageZoomControls, KanbanPageZoomShell, PageZoomProvider } from '@/components/page-zoom'
import { CRM_KANBAN_COLUMN_SHELL_CLASS } from '@/lib/crm-kanban-layout'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import { PipelineLeadCard } from '@/components/crm/PipelineLeadCard'
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
  leadMatchesDateFilter,
  uniqueLeadOrigins,
  uniqueLeadVendors,
  resolvePipelineColumns,
  resolveQuadroColumns,
  type CrmDateFilter,
  type CrmLeadCard,
} from '@/lib/crm-pipeline'
import { cn, fmtCur, fmtDate } from '@/lib/utils'
import { showToast } from '@/lib/toast'

export function PipelinePage() {
  const { kanbanSlug } = useParams()
  const navigate = useNavigate()
  const { crmProfile, userProfile } = useApp()
  const canEditMarkup = canAccessCrmPath('/markup', crmProfile, userProfile)
  const { data, loading, error, mover, salvar, criar } = useCrmPipeline()
  const { resumos } = useCrmMarkupResumos()
  const markupApi = useCrmMarkup(canEditMarkup)
  const resumoPorLead = useMemo(() => markupResumoMap(resumos), [resumos])
  const [busca, setBusca] = useState('')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [vendedorId, setVendedorId] = useState('all')
  const [origem, setOrigem] = useState('all')
  const [dateFilter, setDateFilter] = useState<CrmDateFilter>('all')
  const [selected, setSelected] = useState<CrmLeadCard | null>(null)
  const [creating, setCreating] = useState(false)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [markupAberto, setMarkupAberto] = useState<MarkupOrcamento | null>(null)
  const [savingMarkup, setSavingMarkup] = useState(false)

  const etapas = useMemo(
    () => [...data.etapas].sort((a, b) => a.ordem - b.ordem).map(e => e.nome).filter(Boolean),
    [data.etapas],
  )
  const quadros = useMemo(
    () => [...data.quadros].sort((a, b) => a.ordem - b.ordem),
    [data.quadros],
  )
  const quadro = kanbanSlug
    ? quadros.find(q => q.slug === kanbanSlug) ?? null
    : null

  const vendedores = useMemo(() => uniqueLeadVendors(data.leads), [data.leads])
  const origens = useMemo(() => uniqueLeadOrigins(data.leads), [data.leads])
  const leadsHoje = useMemo(
    () => data.leads.filter(lead => leadMatchesDateFilter(lead, 'today')).length,
    [data.leads],
  )
  const leadsFiltrados = useMemo(
    () => filterPipelineLeads(data.leads, { busca, vendedorId, origem, dateFilter }),
    [data.leads, busca, vendedorId, origem, dateFilter],
  )
  const valorQuadro = useMemo(
    () => leadsFiltrados.reduce((sum, lead) => sum + Number(lead.valorOrcamento || lead.valorNegocio || 0), 0),
    [leadsFiltrados],
  )

  const colunas = useMemo(() => {
    if (quadro) return resolveQuadroColumns(quadro, leadsFiltrados)
    return resolvePipelineColumns(etapas, leadsFiltrados)
  }, [quadro, etapas, leadsFiltrados])

  const statusOptions = useMemo(
    () => collectStatusOptions(etapas, quadros),
    [etapas, quadros],
  )

  const handleDrop = async (leadId: number, statusAlvo: string) => {
    setOverCol(null)
    setDraggingId(null)
    if (!leadId || !statusAlvo) return
    const lead = data.leads.find(item => item.id === leadId)
    if (!lead || lead.status === statusAlvo) return
    try {
      await mover(leadId, statusAlvo)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível mover o lead.', 'error')
    }
  }

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
    <PageZoomProvider>
      <CrmPageFrame>
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" className="gap-2" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo lead</span>
          </Button>
          <div className="flex items-center gap-2">
            {viewMode === 'kanban' && <KanbanPageZoomControls compact />}
            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium',
                  viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
                onClick={() => setViewMode('kanban')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium',
                  viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
                onClick={() => setViewMode('list')}
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-border/80 bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Leads</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">{leadsFiltrados.length}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Leads hoje</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">{leadsHoje}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor no quadro</p>
            <p className="text-lg font-semibold tabular-nums text-success">{fmtCur(valorQuadro)}</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Atenção</p>
            <p className="text-lg font-semibold tabular-nums text-amber-300">
              {leadsFiltrados.filter(l => l.darAtencao).length}
            </p>
          </div>
        </div>

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
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <select className="glass-input w-full" value={dateFilter} onChange={e => setDateFilter(e.target.value as CrmDateFilter)}>
              <option value="all">Todas as datas</option>
              <option value="today">Hoje</option>
              <option value="current_month">Mês atual</option>
              <option value="week">Últimos 7 dias</option>
              <option value="month">Último mês</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pipeline"
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-semibold',
                !kanbanSlug
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground',
              )}
            >
              Pipeline
            </Link>
            {quadros.map(item => (
              <Link
                key={item.id}
                to={`/pipeline/${encodeURIComponent(item.slug)}`}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs font-semibold',
                  kanbanSlug === item.slug
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                {item.nome}
              </Link>
            ))}
          </div>
        </div>

        {loading && <LoadingState variant="page" message="Carregando o quadro de vendas..." />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && colunas.length === 0 && (
          <EmptyState message="Nenhuma etapa configurada neste quadro." />
        )}

        {!loading && !error && viewMode === 'list' && (
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Etapa</th>
                    <th className="px-3 py-2">Origem</th>
                    <th className="px-3 py-2">Chegada</th>
                    <th className="px-3 py-2">Vendedor</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsFiltrados.map(lead => (
                    <tr
                      key={lead.id}
                      className="cursor-pointer border-t border-border/40 hover:bg-accent/40"
                      onClick={() => setSelected(lead)}
                    >
                      <td className="px-3 py-2 font-medium text-foreground">{lead.nome}</td>
                      <td className="px-3 py-2 text-muted-foreground">{lead.status}</td>
                      <td className="px-3 py-2 text-muted-foreground">{lead.origem ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(lead.dataChegada)}</td>
                      <td className="px-3 py-2 text-gold">{lead.vendedorNome ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-success">
                        {fmtCur(Number(lead.valorOrcamento || lead.valorNegocio))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && viewMode === 'kanban' && colunas.length > 0 && (
          <KanbanPageZoomShell contentLayout="kanban" contentSignal={`${colunas.length}-${leadsFiltrados.length}-${kanbanSlug ?? 'pipeline'}`}>
            <div className="flex h-full min-h-[22rem] w-max min-w-full gap-3 pb-1">
              {colunas.map(coluna => {
                const isOver = overCol === coluna.id
                return (
                  <div
                    key={coluna.id}
                    className={cn(CRM_KANBAN_COLUMN_SHELL_CLASS, isOver && 'border-primary/60 bg-primary/[0.03] shadow-md ring-1 ring-primary/20')}
                    onDragOver={e => {
                      e.preventDefault()
                      setOverCol(coluna.id)
                    }}
                    onDragLeave={() => setOverCol(current => current === coluna.id ? null : current)}
                    onDrop={e => {
                      e.preventDefault()
                      const dropped = Number(e.dataTransfer.getData('text/plain'))
                      void handleDrop(dropped, coluna.statusAlvo)
                    }}
                  >
                    <div className="shrink-0 rounded-t-xl border-b border-border/60 bg-muted/25 px-2.5 py-2.5 sm:px-3 sm:py-3">
                      <h3 className="line-clamp-2 text-[11px] font-semibold leading-snug tracking-tight text-foreground sm:text-xs">
                        {coluna.title}
                      </h3>
                      <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {coluna.items.length} {coluna.items.length === 1 ? 'lead' : 'leads'}
                      </p>
                    </div>
                    <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-2 sm:p-2.5">
                      <div className="flex w-full min-w-0 flex-col gap-2 sm:gap-2.5">
                        {coluna.items.length === 0 ? (
                          <p className="py-8 text-center text-[11px] text-muted-foreground">
                            {isOver ? 'Soltar aqui' : 'Nenhum lead'}
                          </p>
                        ) : (
                          coluna.items.map(lead => (
                            <PipelineLeadCard
                              key={lead.id}
                              lead={lead}
                              dragging={draggingId === lead.id}
                              markupResumo={resumoPorLead.get(lead.id) ?? null}
                              canOpenMarkup={canEditMarkup}
                              onOpen={setSelected}
                              onOpenMarkup={abrirMarkupDoLead}
                              onDragStart={setDraggingId}
                              onDragEnd={() => {
                                setDraggingId(null)
                                setOverCol(null)
                              }}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </KanbanPageZoomShell>
        )}

        {kanbanSlug && !loading && !quadro && !error && (
          <EmptyState message="Este quadro não existe. Escolha outro no topo." />
        )}
      </CrmPageFrame>

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
          const current = selected
          await abrirMarkupDoLead(current, orcamentoId)
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
    </PageZoomProvider>
  )
}
