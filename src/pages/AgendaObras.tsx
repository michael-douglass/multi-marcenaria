import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Settings, Plus, X, Pencil, Search, CalendarDays } from 'lucide-react'
import { useObras } from '@/hooks/useObras'
import { useTiposObra } from '../hooks/useTiposObra'
import { useGruposObra } from '../hooks/useGruposObra'
import { useApp } from '../context/AppContext'
import { Modal } from '../components/ui/Modal'
import { Field } from '../components/ui/Field'
import { LoadingState, ErrorState } from '../components/ui/EmptyState'
import { ObraDetalheModal } from '../components/obras/ObraDetalheModal'
import { ObraFormModal } from '../components/obras/ObraFormModal'
import { BriefingModeloEditor } from '../components/obras/briefing/BriefingModeloEditor'
import { useBriefingModelos } from '../hooks/useBriefingModelos'
import {
  buildPendingObraArquivo,
  revokePendingObraArquivoUrl,
  uploadObraArquivo,
  type PendingObraArquivo,
} from '../lib/obra-arquivos'
import { applyMontadorAdminObraDefaults, getObraMontadorIds } from '../lib/obra-montadores'
import { parseObraComissaoItens } from '../lib/obra-comissao'
import { ObraComissaoStrip } from '../components/obras/ObraComissaoStrip'
import { ObraCard } from '../components/obras/ObraCard'
import { ObraEmAbertoCount } from '../components/obras/ObraEmAbertoCount'
import { ObraPedidoMaterialAlert } from '../components/obras/ObraPedidoMaterialAlert'
import { ObraMarkupCustosToolbar } from '../components/obras/ObraMarkupCustosToolbar'
import { ObrasViewTabs } from '../components/obras/ObrasViewTabs'
import { countObrasEmAberto, countObrasSemPedidoMaterial, filterObrasSemPedidoMaterial } from '../lib/obra-pedido-material'
import {
  getObraMarkupCustos,
  getFiltroMarkupDaObra,
  sumPedidoAFazerCustos,
} from '../lib/obra-markup-custos'
import { useMarkupCustosPorLeads } from '../hooks/useMarkupCustosPorLeads'
import { useMarkupCustosFiltrosPorObra } from '../hooks/useMarkupCustosFiltrosPorObra'
import { useLeadMidiasPorObras } from '../hooks/useLeadMidiasPorObras'
import { getObraLeadMidias } from '../lib/obra-lead-midias'
import { canViewMarkupCustos as roleCanViewMarkupCustos } from '../lib/role-access'
import { applyAgendaMesFiltro, describeAgendaMesFiltro } from '../lib/obra-mes-filtro'
import {
  readAgendaMesFiltroPrefs,
  writeAgendaMesFiltroPrefs,
  type AgendaMesFiltro,
} from '../lib/agenda-mes-filtro-storage'
import { filtrarObrasFila, groupObrasFilaPorData } from '../lib/obra-fila'
import { getStatusEfetivo, groupObrasAgendaKanban } from '../lib/obra-progresso'
import {
  parseAgendaObraView,
  setAgendaObraViewParam,
  type AgendaObraView,
} from '../lib/obra-views'
import { ObraPageHeader } from '../components/obras/ObraPageHeader'
import {
  KANBAN_COL_CLASS,
  KANBAN_COL_SHORT,
  kanbanColHeaderClass,
  kanbanColHeaderStyle,
} from '../components/obras/obra-kanban-layout'
import type {
  ObraFull, ObraInput, StatusKanbanObra,
  TipoObraInput, GrupoObraInput, TipoObra, GrupoObra,
  MarkupCustosFiltro,
} from '../types'
import {
  canConfigObrasTiposGrupos,
  canConfigBriefingTemplates,
  canDeleteBriefingTemplates,
  canOpenAgendaConfig,
  canDeleteObras,
  canEditObras,
  canManageAllObras,
  canEditComissao,
  canAplicarComissao,
  canViewMontadoresConclusaoObra,
} from '../lib/obra-permissions'
import {
  KanbanPageZoomControls,
  KanbanPageZoomShell,
  KanbanPageToolbar,
  PageZoomProvider,
} from '../components/page-zoom'
import { AgendaMesFilterBar } from '../components/obras/AgendaMesFilterBar'
import { AgendaEntregaKpiStrip } from '../components/obras/AgendaEntregaKpiStrip'
import {
  describeAgendaEntregaDestaque,
  filterObrasPorEntregaDestaque,
  summarizeAgendaEntrega,
  type AgendaEntregaDestaque,
} from '../lib/agenda-entrega-resumo'
import { CalendarioObrasContent } from '@/pages/CalendarioObras'

// ── Colunas do Kanban ────────────────────────────────────────
const COLUNAS: { key: StatusKanbanObra; label: string; cor: string }[] = [
  { key: 'datas_em_aberto', label: 'Datas em Aberto', cor: '#6b7280' },
  { key: 'datas_em_atraso', label: 'Datas em Atraso', cor: '#ef4444' },
  { key: 'datas_definidas', label: 'Datas Definidas', cor: '#3b82f6' },
  { key: 'em_andamento',    label: 'Em Andamento',    cor: '#f59e0b' },
  { key: 'concluida',       label: 'Concluída',       cor: '#10b981' },
  { key: 'cancelada',       label: 'Cancelada',       cor: '#9ca3af' },
]

// ── Blank forms ──────────────────────────────────────────────
const BLANK_OBRA: ObraInput = {
  cliente_nome: '', cliente_id: null, lousa: null, descricao: null, endereco_obra: null,
  tipo_obra_id: null, grupo_obra_id: null, montador_admin_id: null, montador_id: null, montador_ids: [],
  data_prevista_inicio: null, data_prevista_fim: null, tempo_maximo_horas: null,
  status_kanban: 'datas_em_aberto', pedido_material_feito: false, data_entrega_pedido: null,
  numero_pedido_cort_claud: null,
  comissao_habilitada: false, comissao_itens: [],
}
const BLANK_TIPO: TipoObraInput = {
  nome: '', descricao: null, tempo_medio_horas: null, tempo_maximo_horas_default: null, ativo: true,
}
const BLANK_GRUPO: GrupoObraInput = {
  nome: '', descricao: null, montador_admin_id: null, ativo: true,
}

// ── Helpers ──────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }

function computeKanbanKey(obra: ObraFull): StatusKanbanObra {
  return getStatusEfetivo(obra)
}

// ObraModal agora vive em src/components/obras/ObraFormModal.tsx
// Alias local para não quebrar as referências abaixo
const ObraModal = ObraFormModal

// ── Modal Configurações (tipos e grupos) ─────────────────────
function ConfigModal({
  open, onClose, tipos, grupos, montadores, tiposHook, gruposHook,
  briefingHook, canEditTiposGrupos, canEditBriefings, canDeleteBriefings,
}: {
  open: boolean
  onClose: () => void
  tipos: TipoObra[]
  grupos: GrupoObra[]
  montadores: { id: string; nome?: string | null; email: string }[]
  tiposHook: ReturnType<typeof useTiposObra>
  gruposHook: ReturnType<typeof useGruposObra>
  briefingHook: ReturnType<typeof useBriefingModelos>
  canEditTiposGrupos: boolean
  canEditBriefings: boolean
  canDeleteBriefings: boolean
}) {
  const defaultTab = canEditTiposGrupos ? 'tipos' : 'briefings'
  const [tab, setTab] = useState<'tipos' | 'grupos' | 'briefings'>(defaultTab)
  const [tipoForm, setTipoForm] = useState<TipoObraInput>(BLANK_TIPO)
  const [tipoEdit, setTipoEdit] = useState<string | null>(null)
  const [grupoForm, setGrupoForm] = useState<GrupoObraInput>(BLANK_GRUPO)
  const [grupoEdit, setGrupoEdit] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && canEditBriefings) {
      void briefingHook.reload()
    }
  }, [open, canEditBriefings, briefingHook.reload])

  const saveTipo = async () => {
    if (!tipoForm.nome.trim()) return
    setSaving(true)
    try {
      if (tipoEdit) await tiposHook.update(tipoEdit, tipoForm)
      else await tiposHook.create(tipoForm)
      setTipoForm(BLANK_TIPO); setTipoEdit(null)
    } finally { setSaving(false) }
  }

  const saveGrupo = async () => {
    if (!grupoForm.nome.trim()) return
    setSaving(true)
    try {
      if (grupoEdit) await gruposHook.update(grupoEdit, grupoForm)
      else await gruposHook.create(grupoForm)
      setGrupoForm(BLANK_GRUPO); setGrupoEdit(null)
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="CONFIGURAÇÕES DE OBRAS" wide>
      <div className="flex flex-wrap gap-2 mb-4">
        {canEditTiposGrupos && (
          <>
            <button onClick={() => setTab('tipos')} className={`btn btn-md ${tab === 'tipos' ? 'btn-gold' : 'btn-outline'}`}>Tipos de Obra</button>
            <button onClick={() => setTab('grupos')} className={`btn btn-md ${tab === 'grupos' ? 'btn-gold' : 'btn-outline'}`}>Grupos de Obra</button>
          </>
        )}
        {canEditBriefings && (
          <button onClick={() => setTab('briefings')} className={`btn btn-md ${tab === 'briefings' ? 'btn-gold' : 'btn-outline'}`}>Briefings Pré-Obra</button>
        )}
      </div>

      {tab === 'briefings' && canEditBriefings && (
        <BriefingModeloEditor
          modelos={briefingHook.data}
          hook={briefingHook}
          canEdit={canEditBriefings}
          canDelete={canDeleteBriefings}
          loading={briefingHook.loading}
          error={briefingHook.error}
        />
      )}

      {tab === 'tipos' && canEditTiposGrupos && (
        <div className="space-y-3">
          <Field label="Nome *">
            <input className="glass-input" value={tipoForm.nome} onChange={e => setTipoForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Montagem Completa" />
          </Field>
          <div className="flex gap-2">
            <Field label="Tempo médio (h)">
              <input type="number" min={0} className="glass-input" value={tipoForm.tempo_medio_horas ?? ''} onChange={e => setTipoForm(p => ({ ...p, tempo_medio_horas: e.target.value ? Number(e.target.value) : null }))} />
            </Field>
            <Field label="Tempo máx. padrão (h)">
              <input type="number" min={0} className="glass-input" value={tipoForm.tempo_maximo_horas_default ?? ''} onChange={e => setTipoForm(p => ({ ...p, tempo_maximo_horas_default: e.target.value ? Number(e.target.value) : null }))} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button onClick={saveTipo} disabled={saving} className="btn btn-gold btn-md">{saving ? 'Salvando...' : tipoEdit ? 'Atualizar' : 'Adicionar'}</button>
            {tipoEdit && <button onClick={() => { setTipoForm(BLANK_TIPO); setTipoEdit(null) }} className="btn btn-outline btn-md">Cancelar</button>}
          </div>
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
            {tipos.map(t => (
              <div key={t.id} className="flex items-center justify-between glass-card p-2 text-sm">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{t.nome}</p>
                  <p className="text-[0.7rem] text-[var(--color-text-muted)]">Médio: {t.tempo_medio_horas ?? '—'}h / Máx.: {t.tempo_maximo_horas_default ?? '—'}h</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setTipoEdit(t.id); setTipoForm({ nome: t.nome, descricao: t.descricao ?? null, tempo_medio_horas: t.tempo_medio_horas ?? null, tempo_maximo_horas_default: t.tempo_maximo_horas_default ?? null, ativo: t.ativo }) }} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-gold-muted)]"><Pencil size={12} /></button>
                  <button onClick={() => tiposHook.remove(t.id)} className="p-1 text-[var(--color-text-muted)] hover:text-red-600"><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'grupos' && canEditTiposGrupos && (
        <div className="space-y-3">
          <Field label="Nome *">
            <input className="glass-input" value={grupoForm.nome} onChange={e => setGrupoForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Grupo Zona Sul" />
          </Field>
          <Field label="Montador Admin do Grupo">
            <select className="glass-input" value={grupoForm.montador_admin_id ?? ''} onChange={e => setGrupoForm(p => ({ ...p, montador_admin_id: e.target.value || null }))}>
              <option value="">— Nenhum —</option>
              {montadores.map(m => <option key={m.id} value={m.id}>{m.nome ?? m.email}</option>)}
            </select>
          </Field>
          <div className="flex gap-2">
            <button onClick={saveGrupo} disabled={saving} className="btn btn-gold btn-md">{saving ? 'Salvando...' : grupoEdit ? 'Atualizar' : 'Adicionar'}</button>
            {grupoEdit && <button onClick={() => { setGrupoForm(BLANK_GRUPO); setGrupoEdit(null) }} className="btn btn-outline btn-md">Cancelar</button>}
          </div>
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
            {grupos.map(g => (
              <div key={g.id} className="flex items-center justify-between glass-card p-2 text-sm">
                <p className="font-semibold text-[var(--color-text-primary)]">{g.nome}</p>
                <div className="flex gap-1">
                  <button onClick={() => { setGrupoEdit(g.id); setGrupoForm({ nome: g.nome, descricao: g.descricao ?? null, montador_admin_id: g.montador_admin_id ?? null, ativo: g.ativo }) }} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-gold-muted)]"><Pencil size={12} /></button>
                  <button onClick={() => gruposHook.remove(g.id)} className="p-1 text-[var(--color-text-muted)] hover:text-red-600"><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Página principal ─────────────────────────────────────────
export function AgendaObras() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = parseAgendaObraView(searchParams.get('view'))

  const handleViewChange = useCallback((next: AgendaObraView) => {
    setSearchParams(setAgendaObraViewParam(searchParams, next), { replace: true })
  }, [searchParams, setSearchParams])

  if (view === 'calendario') {
    return (
      <PageZoomProvider pageKey="calendario_obras">
        <CalendarioObrasContent
          pageView={view}
          onPageViewChange={handleViewChange}
        />
      </PageZoomProvider>
    )
  }

  return (
    <PageZoomProvider pageKey={view === 'filas' ? 'agenda_obras_filas' : 'agenda_obras'}>
      <AgendaObrasContent view={view} onViewChange={handleViewChange} />
    </PageZoomProvider>
  )
}

function AgendaObrasContent({
  view,
  onViewChange,
}: {
  view: 'filas' | 'kanban'
  onViewChange: (view: AgendaObraView) => void
}) {
  const { roles, userProfile } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const obrasHook = useObras()
  const tiposHook = useTiposObra()
  const gruposHook = useGruposObra()
  const briefingHook = useBriefingModelos()
  const isFilas = view === 'filas'

  const isMontadorAdmin = roles.includes('MontadorAdmin')
  const isMontador = roles.includes('Montador') && !isMontadorAdmin
  const canEdit = canEditObras(roles)
  const canEditMontador = canEdit
  const canEditDates = canEdit
  const canConfigTiposGrupos = canConfigObrasTiposGrupos(roles)
  const canConfigBriefings = canConfigBriefingTemplates(roles)
  const canConfig = canOpenAgendaConfig(roles)
  const canDeleteBriefingModelos = canDeleteBriefingTemplates(roles)
  const canDelete = canDeleteObras(roles)
  const isObrasAdmin = canManageAllObras(roles) || isMontadorAdmin
  const canViewMontadoresConclusao = canViewMontadoresConclusaoObra(roles)
  const canViewMarkupCustos = roleCanViewMarkupCustos(roles)

  const { custosByLead, loading: loadingMarkupCustos } = useMarkupCustosPorLeads(
    obrasHook.data,
    canViewMarkupCustos,
  )
  const { midiasByLead, loading: loadingLeadMidias } = useLeadMidiasPorObras(obrasHook.data, true)
  const {
    filtrosPorObra: markupCustosFiltrosPorObra,
    loading: loadingMarkupFiltros,
    salvarFiltroObra,
  } = useMarkupCustosFiltrosPorObra(canViewMarkupCustos)

  const handleMarkupCustosFiltroObra = useCallback(
    (obraId: string, next: MarkupCustosFiltro) => {
      void salvarFiltroObra(obraId, next).catch(err => {
        alert(err instanceof Error ? err.message : 'Não foi possível salvar o filtro desta obra.')
      })
    },
    [salvarFiltroObra],
  )

  const totalPedidoAFazer = useMemo(
    () => (
      canViewMarkupCustos
        ? sumPedidoAFazerCustos(obrasHook.data, custosByLead, markupCustosFiltrosPorObra)
        : 0
    ),
    [canViewMarkupCustos, obrasHook.data, custosByLead, markupCustosFiltrosPorObra],
  )

  const draftKey = userProfile?.id ? `movelaria-obra-rascunho-${userProfile.id}` : null

  const [obraOpen, setObraOpen] = useState(false)
  const [editObra, setEditObra] = useState<ObraFull | null>(null)
  const [obraForm, setObraForm] = useState<ObraInput>(BLANK_OBRA)
  const [savingObra, setSavingObra] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingObraArquivo[]>([])
  const [hasDraft, setHasDraft] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)

  // Inicializa hasDraft quando o usuário carrega
  useEffect(() => {
    if (!draftKey) return
    try {
      const saved = localStorage.getItem(draftKey)
      if (!saved) return
      const d = JSON.parse(saved) as ObraInput
      setHasDraft(!!(d.cliente_nome?.trim() || d.descricao || d.endereco_obra || d.lousa))
    } catch { /* ignorar */ }
  }, [draftKey])

  // Persiste rascunho enquanto o formulário de nova obra estiver aberto
  useEffect(() => {
    if (!obraOpen || editObra !== null || !draftKey) return
    const hasContent = !!(obraForm.cliente_nome?.trim() || obraForm.descricao || obraForm.endereco_obra || obraForm.lousa)
    if (hasContent) {
      localStorage.setItem(draftKey, JSON.stringify(obraForm))
      setHasDraft(true)
    }
  }, [obraForm, obraOpen, editObra, draftKey])
  const [configOpen, setConfigOpen] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)
  const [togglingPedidoMaterial, setTogglingPedidoMaterial] = useState<string | null>(null)
  const [updatingDataEntrega, setUpdatingDataEntrega] = useState<string | null>(null)
  const [updatingNumeroPedidoCortClaud, setUpdatingNumeroPedidoCortClaud] = useState<string | null>(null)
  const [updatingMontadores, setUpdatingMontadores] = useState<string | null>(null)

  const handleUpdateDataEntrega = async (obra: ObraFull, data: string | null) => {
    if (!canEdit) return
    setUpdatingDataEntrega(obra.id)
    try {
      await obrasHook.update(obra.id, { data_entrega_pedido: data })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível atualizar a data de entrega.')
    } finally {
      setUpdatingDataEntrega(null)
    }
  }

  const handleUpdateNumeroPedidoCortClaud = async (obra: ObraFull, numero: string | null) => {
    if (!canEdit) return
    setUpdatingNumeroPedidoCortClaud(obra.id)
    try {
      await obrasHook.update(obra.id, { numero_pedido_cort_claud: numero })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível atualizar o número do pedido.')
    } finally {
      setUpdatingNumeroPedidoCortClaud(null)
    }
  }

  const [busca, setBusca] = useState('')
  const [dataDiaFiltro, setDataDiaFiltro] = useState('')
  const [somenteSemPedido, setSomenteSemPedido] = useState(false)
  const [entregaDestaque, setEntregaDestaque] = useState<AgendaEntregaDestaque | null>(null)
  const [mesFiltro, setMesFiltro] = useState<AgendaMesFiltro>(
    () => readAgendaMesFiltroPrefs().filtro,
  )
  const [filtroMinimized, setFiltroMinimized] = useState(
    () => readAgendaMesFiltroPrefs().minimized,
  )
  const [detalheObra, setDetalheObra] = useState<ObraFull | null>(null)
  const [applyingComissao, setApplyingComissao] = useState(false)
  const obraFromUrl = searchParams.get('obra')

  const clearObraDaUrl = useCallback(() => {
    if (!searchParams.has('obra')) return
    const next = new URLSearchParams(searchParams)
    next.delete('obra')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!userProfile?.id) return
    const prefs = readAgendaMesFiltroPrefs(userProfile.id)
    setMesFiltro(prefs.filtro)
    setFiltroMinimized(prefs.minimized)
  }, [userProfile?.id])

  useEffect(() => {
    writeAgendaMesFiltroPrefs(userProfile?.id, {
      filtro: mesFiltro,
      minimized: filtroMinimized,
    })
  }, [userProfile?.id, mesFiltro, filtroMinimized])

  // Mantém o modal de detalhes sincronizado após iniciar/concluir obra
  useEffect(() => {
    if (!detalheObra) return
    const fresh = obrasHook.data.find(o => o.id === detalheObra.id)
    if (fresh) setDetalheObra(fresh)
    else setDetalheObra(null)
  }, [obrasHook.data, detalheObra?.id])

  // Clique na busca do menu: abre o card da obra pelo ?obra=
  useEffect(() => {
    if (!obraFromUrl) return
    const found = obrasHook.data.find(o => o.id === obraFromUrl)
    if (found) setDetalheObra(found)
  }, [obraFromUrl, obrasHook.data])

  // ── Drag and drop ──────────────────────────────────────────
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<StatusKanbanObra | null>(null)

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverCol(null)
  }

  const handleDragOver = (e: React.DragEvent, col: StatusKanbanObra) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(col)
  }

  const handleDrop = async (e: React.DragEvent, col: StatusKanbanObra) => {
    e.preventDefault()
    const id = draggingId ?? e.dataTransfer.getData('text/plain')
    setDraggingId(null)
    setDragOverCol(null)
    if (!id) return
    const obra = obrasHook.data.find(o => o.id === id)
    if (!obra || computeKanbanKey(obra) === col) return
    try {
      if (obra.status_kanban === 'concluida' && col !== 'concluida' && col !== 'cancelada') {
        await obrasHook.reabrirObra(id, col)
        return
      }
      // Ao tirar da coluna Concluída, zera finalização para a comissão
      // voltar a aparecer em "Previsão" no Meu Financeiro do montador.
      const payload: Partial<ObraInput> = { status_kanban: col }
      if (col !== 'concluida' && obra.finalizado_em) {
        payload.finalizado_em = null
      }
      await obrasHook.update(id, payload)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível mover a obra.')
    }
  }

  const handleEntregaDestaque = useCallback((key: AgendaEntregaDestaque) => {
    setEntregaDestaque(prev => (prev === key ? null : key))
  }, [])

  const handleMesFiltroChange = useCallback((value: AgendaMesFiltro) => {
    setEntregaDestaque(null)
    setMesFiltro(value)
  }, [])

  const entregaResumo = useMemo(
    () => summarizeAgendaEntrega(obrasHook.data),
    [obrasHook.data],
  )

  const obrasDoMes = useMemo(
    () => (
      entregaDestaque
        ? filterObrasPorEntregaDestaque(obrasHook.data, entregaDestaque)
        : applyAgendaMesFiltro(obrasHook.data, mesFiltro)
    ),
    [obrasHook.data, mesFiltro, entregaDestaque],
  )

  const obrasFiltradas = useMemo(() => {
    let lista = obrasDoMes
    if (somenteSemPedido) {
      lista = filterObrasSemPedidoMaterial(lista)
    }
    const q = busca.trim().toLowerCase()
    if (!q) return lista
    return lista.filter(o => {
      const haystack = [
        o.cliente_nome,
        o.lousa,
        o.endereco_obra,
        o.tipo_obra_nome,
        o.grupo_obra_nome,
        o.montador_nome,
        o.montador_admin_nome,
        o.status_kanban,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [obrasDoMes, busca, somenteSemPedido])

  const obrasFila = useMemo(
    () => filtrarObrasFila(obrasHook.data, {
      busca,
      mesFiltro,
      dataDia: dataDiaFiltro,
    }),
    [obrasHook.data, busca, mesFiltro, dataDiaFiltro],
  )

  const obrasFilaColunas = useMemo(
    () => groupObrasFilaPorData(obrasFila),
    [obrasFila],
  )

  const listaAtiva = isFilas ? obrasFila : obrasFiltradas
  const filtroLabel = useMemo(
    () => (
      isFilas
        ? (
            dataDiaFiltro
              ? `Dia ${dataDiaFiltro.split('-').reverse().join('/')}`
              : describeAgendaMesFiltro(mesFiltro)
          )
        : (
            entregaDestaque
              ? describeAgendaEntregaDestaque(entregaDestaque)
              : describeAgendaMesFiltro(mesFiltro)
          )
    ),
    [isFilas, dataDiaFiltro, entregaDestaque, mesFiltro],
  )
  const totalBase = isFilas
    ? obrasHook.data.length
    : (entregaDestaque || mesFiltro.mode === 'all'
      ? obrasHook.data.length
      : obrasDoMes.length)

  const obrasByCol = useMemo(
    () => groupObrasAgendaKanban(obrasFiltradas),
    [obrasFiltradas],
  )

  const obrasEmAbertoCount = useMemo(
    () => countObrasEmAberto(obrasHook.data),
    [obrasHook.data],
  )

  const semPedidoMaterialCount = useMemo(
    () => countObrasSemPedidoMaterial(obrasHook.data),
    [obrasHook.data],
  )

  useEffect(() => {
    if (semPedidoMaterialCount === 0) setSomenteSemPedido(false)
  }, [semPedidoMaterialCount])

  const clearPendingFiles = useCallback(() => {
    setPendingFiles(prev => {
      prev.forEach(revokePendingObraArquivoUrl)
      return []
    })
  }, [])

  const handleAddFiles = useCallback(async (files: File[]) => {
    const pending = await Promise.all(files.map(file => buildPendingObraArquivo(file)))
    setPendingFiles(prev => [...prev, ...pending])
  }, [])

  const handleRemoveFile = useCallback((localId: string) => {
    setPendingFiles(prev => {
      const item = prev.find(p => p.localId === localId)
      if (item) revokePendingObraArquivoUrl(item)
      return prev.filter(p => p.localId !== localId)
    })
  }, [])

  const buildNovaObraForm = (base: ObraInput = BLANK_OBRA) =>
    applyMontadorAdminObraDefaults(
      base,
      userProfile?.id,
      gruposHook.data,
      isMontadorAdmin,
    )

  const openNew = () => {
    setEditObra(null)
    let restored = false
    if (draftKey) {
      try {
        const saved = localStorage.getItem(draftKey)
        if (saved) {
          const draft = JSON.parse(saved) as ObraInput
          const hasContent = !!(draft.cliente_nome?.trim() || draft.descricao || draft.endereco_obra || draft.lousa)
          if (hasContent) {
            setObraForm(buildNovaObraForm({ ...BLANK_OBRA, ...draft }))
            restored = true
          } else {
            setObraForm(buildNovaObraForm())
          }
        } else {
          setObraForm(buildNovaObraForm())
        }
      } catch {
        setObraForm(buildNovaObraForm())
      }
    } else {
      setObraForm(buildNovaObraForm())
    }
    setDraftRestored(restored)
    clearPendingFiles()
    setObraOpen(true)
  }

  const clearDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey)
    setHasDraft(false)
    setDraftRestored(false)
    setObraForm(BLANK_OBRA)
  }
  const openEdit = (obra: ObraFull) => {
    setEditObra(obra)
    setObraForm({
      cliente_nome: obra.cliente_nome,
      cliente_id: obra.cliente_id ?? null,
      lousa: obra.lousa ?? null,
      descricao: obra.descricao ?? null,
      endereco_obra: obra.endereco_obra ?? null,
      tipo_obra_id: obra.tipo_obra_id ?? null,
      grupo_obra_id: obra.grupo_obra_id ?? null,
      montador_admin_id: obra.montador_admin_id ?? null,
      montador_id: obra.montador_id ?? null,
      montador_ids: getObraMontadorIds(obra),
      data_prevista_inicio: obra.data_prevista_inicio ?? null,
      data_prevista_fim: obra.data_prevista_fim ?? null,
      tempo_maximo_horas: obra.tempo_maximo_horas ?? null,
      status_kanban: obra.status_kanban,
      pedido_material_feito: obra.pedido_material_feito ?? false,
      data_entrega_pedido: obra.data_entrega_pedido ?? null,
      numero_pedido_cort_claud: obra.numero_pedido_cort_claud ?? null,
      dias_trabalho: obra.dias_trabalho ?? null,
      horario_inicio: obra.horario_inicio ?? null,
      horario_fim: obra.horario_fim ?? null,
      comissao_habilitada: obra.comissao_habilitada ?? false,
      comissao_itens: parseObraComissaoItens(obra),
    })
    clearPendingFiles()
    setObraOpen(true)
  }

  const handleObraChange = (k: keyof ObraInput, v: string | null | number | string[] | boolean) => {
    setObraForm(p => {
      const next = { ...p, [k]: v }

      // Ao selecionar tipo de obra, preenche o prazo máximo com o padrão do tipo
      if (k === 'tipo_obra_id' && v) {
        const tipo = tiposHook.data.find(t => t.id === v)
        if (tipo?.tempo_maximo_horas_default != null) {
          next.tempo_maximo_horas = Number(tipo.tempo_maximo_horas_default)
        }
      }

      // Auto-compute status when dates change (atraso permanente não volta a "definidas")
      if ((k === 'data_prevista_inicio' || k === 'data_prevista_fim') && !editObra?.iniciado_em) {
        const fim = k === 'data_prevista_fim' ? (v as string) : p.data_prevista_fim
        if (editObra?.atraso_permanente || (fim && fim < today())) {
          next.status_kanban = 'datas_em_atraso'
        } else if (fim) {
          next.status_kanban = 'datas_definidas'
        } else if (!p.data_prevista_inicio && !p.data_prevista_fim) {
          next.status_kanban = 'datas_em_aberto'
        }
      }
      return next
    })
  }

  const saveObra = async () => {
    if (!obraForm.cliente_nome.trim()) return
    setSavingObra(true)
    try {
      const formToSave = editObra
        ? applyMontadorAdminObraDefaults(obraForm, userProfile?.id, gruposHook.data, isMontadorAdmin)
        : buildNovaObraForm(obraForm)
      if (editObra) {
        await obrasHook.update(editObra.id, formToSave, { syncComissao: canEditComissao(roles) })
      } else {
        const obraId = await obrasHook.create(formToSave)
        // Upload pending files sequentially after creation
        for (const pending of pendingFiles) {
          try {
            await uploadObraArquivo(obraId, pending)
            revokePendingObraArquivoUrl(pending)
          } catch { /* ignora erro individual de arquivo */ }
        }
        clearPendingFiles()
        // Obra criada com sucesso — apaga rascunho
        if (draftKey) localStorage.removeItem(draftKey)
        setHasDraft(false)
        setDraftRestored(false)
      }
      setObraOpen(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível salvar a obra.')
    } finally { setSavingObra(false) }
  }

  const handleIniciar = async (id: string) => {
    setActioning(id)
    try {
      await obrasHook.iniciarObra(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível iniciar a obra.')
    } finally { setActioning(null) }
  }

  const handleConcluir = async (id: string) => {
    setActioning(id)
    try {
      await obrasHook.concluirObra(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível concluir a obra.')
    } finally { setActioning(null) }
  }

  const handleReabrir = async (id: string) => {
    setActioning(id)
    try {
      await obrasHook.reabrirObra(id)
      setDetalheObra(prev => prev?.id === id ? null : prev)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível reabrir a obra.')
    } finally { setActioning(null) }
  }

  const handleTogglePedidoMaterial = async (obra: ObraFull, feito: boolean) => {
    if (!canEdit) return
    setTogglingPedidoMaterial(obra.id)
    try {
      await obrasHook.update(obra.id, { pedido_material_feito: feito })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível atualizar o pedido de material.')
    } finally {
      setTogglingPedidoMaterial(null)
    }
  }

  const handleUpdateMontadores = async (obra: ObraFull, montadorIds: string[]) => {
    if (!canEditMontador) return
    setUpdatingMontadores(obra.id)
    try {
      await obrasHook.update(obra.id, { montador_ids: montadorIds })
      setDetalheObra(prev => {
        if (!prev || prev.id !== obra.id) return prev
        const nomes = montadorIds.map(id => {
          const m = gruposHook.montadores.find(x => x.id === id)
          return m?.nome?.trim() || m?.email?.split('@')[0] || 'Montador'
        })
        return {
          ...prev,
          montador_ids: montadorIds,
          montador_nomes: nomes,
          montador_id: montadorIds[0] ?? null,
          montador_nome: nomes[0] ?? null,
        }
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível atualizar os montadores da obra.')
    } finally {
      setUpdatingMontadores(null)
    }
  }

  const handleUpdateMontadorAdmin = async (obra: ObraFull, montadorAdminId: string | null) => {
    if (!canEditMontador) return
    setUpdatingMontadores(obra.id)
    try {
      await obrasHook.update(obra.id, { montador_admin_id: montadorAdminId })
      setDetalheObra(prev => {
        if (!prev || prev.id !== obra.id) return prev
        const admin = montadorAdminId
          ? gruposHook.montadores.find(x => x.id === montadorAdminId)
          : null
        return {
          ...prev,
          montador_admin_id: montadorAdminId,
          montador_admin_nome: admin
            ? (admin.nome?.trim() || admin.email.split('@')[0] || 'Admin')
            : null,
        }
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível atualizar o montador administrador.')
    } finally {
      setUpdatingMontadores(null)
    }
  }

  const handleAplicarComissao = async (obraId: string) => {
    setApplyingComissao(true)
    try {
      await obrasHook.aplicarComissao(obraId)
      setDetalheObra(prev => prev?.id === obraId ? { ...prev, comissao_gerada: true } : prev)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível gerar os pagamentos.')
    } finally {
      setApplyingComissao(false)
    }
  }

  const handleExcluir = async (obra: ObraFull) => {
    const nome = obra.cliente_nome.trim() || 'esta obra'
    if (!confirm(`Excluir a obra de "${nome}"? Essa ação não pode ser desfeita.`)) return

    setActioning(obra.id)
    try {
      await obrasHook.remove(obra.id)
      if (detalheObra?.id === obra.id) {
        setDetalheObra(null)
        clearObraDaUrl()
      }
      if (editObra?.id === obra.id) setObraOpen(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível excluir a obra.')
    } finally {
      setActioning(null)
    }
  }

  return (
    <div
      className={[
        'obra-page-shell obra-page-shell--agenda fade-in flex flex-none min-w-0 flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden',
        isFilas ? 'obra-page-shell--filas' : '',
      ].filter(Boolean).join(' ')}
    >
      <KanbanPageToolbar className="agenda-kanban-toolbar">
        {!isFilas && (
          <AgendaEntregaKpiStrip
            resumo={entregaResumo}
            active={entregaDestaque}
            onSelect={handleEntregaDestaque}
          />
        )}
        <ObraPageHeader
          title={isFilas ? 'Filas de Obras' : 'Agenda de Obras'}
          subtitle={
            <>
              {listaAtiva.length} de {totalBase} obra{totalBase !== 1 ? 's' : ''}
              {' · '}
              <span className={entregaDestaque && !isFilas ? 'text-[#f2d892]' : 'text-[#f2d892] capitalize'}>{filtroLabel}</span>
              {busca && <span className="ml-1 text-[#f2d892]">· filtrado</span>}
              {!isFilas && somenteSemPedido && (
                <span className="ml-1 text-[#fbbf24]">· só sem pedido</span>
              )}
            </>
          }
          actions={
            <div className="obra-page-header__actions-inner">
              <ObrasViewTabs value={view} onChange={onViewChange} />
              {!isFilas && (
                <div className="obra-page-header__badges flex flex-col items-start gap-1">
                  {canViewMarkupCustos && (
                    <ObraMarkupCustosToolbar
                      totalPedidoAFazer={totalPedidoAFazer}
                      loading={loadingMarkupCustos || loadingMarkupFiltros}
                      filtroPedidosAtivo={somenteSemPedido}
                      onPedidoAFazerClick={() => setSomenteSemPedido(v => !v)}
                    />
                  )}
                  <ObraPedidoMaterialAlert
                    count={semPedidoMaterialCount}
                    compact
                    active={somenteSemPedido}
                    onClick={() => setSomenteSemPedido(v => !v)}
                  />
                  <ObraEmAbertoCount count={obrasEmAbertoCount} compact />
                </div>
              )}
              <div
                className={
                  filtroMinimized
                    ? 'agenda-toolbar-inline'
                    : 'agenda-toolbar-inline agenda-toolbar-inline--expanded'
                }
              >
                <AgendaMesFilterBar
                  value={mesFiltro}
                  onChange={handleMesFiltroChange}
                  minimized={filtroMinimized}
                  onMinimizedChange={setFiltroMinimized}
                />
                {isFilas && (
                  <div className="agenda-toolbar-day-filter flex min-w-0 items-center gap-1.5">
                    <CalendarDays size={12} className="shrink-0 text-[#edd9c4]" aria-hidden />
                    <input
                      type="date"
                      className="glass-input agenda-toolbar-search__input min-w-0 max-w-[10.5rem]"
                      value={dataDiaFiltro}
                      onChange={e => setDataDiaFiltro(e.target.value)}
                      aria-label="Filtrar por dia"
                      title="Filtrar por dia"
                    />
                    {dataDiaFiltro && (
                      <button
                        type="button"
                        onClick={() => setDataDiaFiltro('')}
                        className="text-[#edd9c4] hover:text-[#f2d892] transition-colors p-1"
                        aria-label="Limpar filtro de dia"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}
                <div className="obra-page-search agenda-toolbar-search relative min-w-0 flex-1">
                  <Search
                    size={12}
                    className="agenda-toolbar-search__icon absolute left-2.5 top-1/2 -translate-y-1/2 text-[#edd9c4] pointer-events-none"
                  />
                  <input
                    className="glass-input agenda-toolbar-search__input w-full"
                    placeholder="Buscar..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    aria-label="Buscar por cliente, montador, endereço ou tipo"
                  />
                  {busca && (
                    <button
                      type="button"
                      onClick={() => setBusca('')}
                      className="agenda-toolbar-search__clear absolute right-2 top-1/2 -translate-y-1/2 text-[#edd9c4] hover:text-[#f2d892] transition-colors"
                      aria-label="Limpar busca"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
              <KanbanPageZoomControls compact className="obra-toolbar-zoom shrink-0" />
              <div className="obra-page-header__action-buttons">
                {canConfig && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-toolbar-icon sm:btn-md"
                    onClick={() => setConfigOpen(true)}
                    aria-label="Configurações"
                    title="Configurações"
                  >
                    <Settings size={14} className="shrink-0" />
                    <span className="hidden sm:inline">Configurações</span>
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-gold btn-sm sm:btn-md relative"
                    onClick={openNew}
                    aria-label="Nova obra"
                  >
                    <Plus size={14} className="shrink-0" />
                    <span className="sm:hidden">Nova</span>
                    <span className="hidden sm:inline">Nova Obra</span>
                    {hasDraft && (
                      <span
                        className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[rgba(10,4,2,0.8)] bg-amber-400"
                        title="Rascunho salvo"
                      />
                    )}
                  </button>
                )}
              </div>
            </div>
          }
        />
      </KanbanPageToolbar>

      {/* Estados de carregamento/erro */}
      {obrasHook.loading && obrasHook.data.length === 0 && <LoadingState />}
      {!obrasHook.loading && obrasHook.error && obrasHook.data.length === 0 && (
        <ErrorState message={obrasHook.error} />
      )}

      {/* Filas — uma coluna por data de entrega; cards minimizados; sem obras sem data */}
      {isFilas && (obrasHook.data.length > 0 || (!obrasHook.loading && !obrasHook.error)) && (
        <KanbanPageZoomShell
          showScrollArrows
          horizontalScrollbar
          verticalScrollbar
          contentSignal={`${obrasFila.length}-${obrasFilaColunas.length}-${mesFiltro.mode}-${dataDiaFiltro}-${busca}`}
          className="min-h-0 flex-1"
        >
          {obrasFilaColunas.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#d4bc9f]">
              Nenhuma obra com datas nesta fila
            </div>
          ) : (
            <div className="obras-fila-board obra-scroll-x-mobile flex h-full min-h-0 w-max min-w-full gap-3 pb-1">
              {obrasFilaColunas.map(col => (
                <div
                  key={col.iso}
                  className="obras-fila-col flex w-[220px] min-w-[220px] max-w-[240px] shrink-0 flex-col gap-2"
                >
                  <div
                    className={kanbanColHeaderClass(false, col.cor)}
                    style={kanbanColHeaderStyle(false, col.cor)}
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className="kanban-col-title block min-w-0"
                        style={{ color: col.cor }}
                        title={col.iso}
                      >
                        {col.label}
                      </span>
                      <span className="block text-[0.55rem] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        {col.atrasada ? 'Atraso' : col.hoje ? 'Hoje' : 'Prazo'}
                      </span>
                    </div>
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold"
                      style={{ backgroundColor: `${col.cor}33`, color: col.cor }}
                    >
                      {col.obras.length}
                    </span>
                  </div>
                  <div
                    className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg"
                    style={{ minHeight: 80 }}
                  >
                    {col.obras.map(obra => (
                      <div key={obra.id} className="flex flex-col gap-1 min-w-0">
                        <ObraComissaoStrip
                          obra={obra}
                          prestadorId={userProfile?.id}
                          showAll={!isMontador}
                          variant="compact"
                        />
                        <ObraCard
                          obra={obra}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          isMontador={isMontador}
                          montadorUserId={userProfile?.id}
                          roles={roles}
                          actioning={actioning}
                          isDragging={false}
                          draggable={false}
                          startMinimized
                          onDetalhe={o => setDetalheObra(o)}
                          onEdit={openEdit}
                          onIniciar={handleIniciar}
                          onConcluir={handleConcluir}
                          onReabrir={handleReabrir}
                          onExcluir={handleExcluir}
                          onTogglePedidoMaterial={handleTogglePedidoMaterial}
                          togglingPedidoMaterial={togglingPedidoMaterial}
                          onUpdateDataEntrega={handleUpdateDataEntrega}
                          updatingDataEntrega={updatingDataEntrega}
                          canViewMontadoresConclusao={canViewMontadoresConclusao}
                          montadores={gruposHook.montadores}
                          canEditMontador={canEditMontador}
                          onUpdateMontadores={handleUpdateMontadores}
                          onUpdateMontadorAdmin={handleUpdateMontadorAdmin}
                          updatingMontadores={updatingMontadores}
                          showMarkupCustos={canViewMarkupCustos}
                          markupCustos={getObraMarkupCustos(obra, custosByLead)}
                          markupCustosFiltro={getFiltroMarkupDaObra(markupCustosFiltrosPorObra, obra.id)}
                          onMarkupCustosFiltroChange={filtro => handleMarkupCustosFiltroObra(obra.id, filtro)}
                          leadMidias={getObraLeadMidias(obra, midiasByLead)}
                          loadingLeadMidias={loadingLeadMidias}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </KanbanPageZoomShell>
      )}

      {/* Kanban */}
      {!isFilas && (obrasHook.data.length > 0 || (!obrasHook.loading && !obrasHook.error)) && (
        <KanbanPageZoomShell
          showScrollArrows
          horizontalScrollbar
          verticalScrollbar
          contentSignal={`${obrasHook.data.length}-${mesFiltro.mode}-${mesFiltro.mode === 'month' ? `${mesFiltro.mes}-${mesFiltro.ano}` : 'all'}-${busca}-${somenteSemPedido}-${entregaDestaque ?? 'none'}-${obrasFiltradas.length}`}
          className="min-h-0 flex-1"
        >
          <div className="agenda-kanban-board obra-scroll-x-mobile flex w-max min-w-full gap-4 pb-1">
          {COLUNAS.map(col => {
            const obras = obrasByCol[col.key]
            const isOver = dragOverCol === col.key && draggingId !== null
            return (
              <div
                key={col.key}
                className={KANBAN_COL_CLASS}
                onDragOver={canEdit ? e => handleDragOver(e, col.key) : undefined}
                onDragLeave={canEdit ? () => setDragOverCol(null) : undefined}
                onDrop={canEdit ? e => handleDrop(e, col.key) : undefined}
              >
                <div
                  className={kanbanColHeaderClass(isOver, col.cor)}
                  style={kanbanColHeaderStyle(isOver, col.cor)}
                >
                  <span
                    className="kanban-col-title min-w-0 flex-1"
                    style={{ color: col.cor }}
                    title={col.label}
                  >
                    {KANBAN_COL_SHORT[col.key]}
                  </span>
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold"
                    style={{ backgroundColor: `${col.cor}33`, color: col.cor }}
                  >
                    {obras.length}
                  </span>
                </div>

                {/* Cards */}
                <div
                  className="flex flex-col gap-2 overflow-y-auto rounded-lg transition-all"
                  style={{
                    flex: 1,
                    minHeight: 80,
                    border: isOver ? `2px dashed ${col.cor}66` : '2px solid transparent',
                    backgroundColor: isOver ? `${col.cor}08` : undefined,
                    padding: isOver ? '4px' : undefined,
                  }}
                >
                  {obras.length === 0 && !isOver ? (
                    <div className="text-center py-8 text-[0.75rem] text-[#d4bc9f]">Nenhuma obra</div>
                  ) : obras.length === 0 && isOver ? (
                    <div className="flex items-center justify-center py-8 text-[0.75rem]" style={{ color: col.cor }}>
                      Soltar aqui
                    </div>
                  ) : (
                    obras.map(obra => (
                      <div key={obra.id} className="flex flex-col gap-1 min-w-0">
                        <ObraComissaoStrip
                          obra={obra}
                          prestadorId={userProfile?.id}
                          showAll={!isMontador}
                        />
                        <ObraCard
                          obra={obra}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          isMontador={isMontador}
                          montadorUserId={userProfile?.id}
                          roles={roles}
                          actioning={actioning}
                          isDragging={draggingId === obra.id}
                          onDetalhe={o => setDetalheObra(o)}
                          onEdit={openEdit}
                          onIniciar={handleIniciar}
                          onConcluir={handleConcluir}
                          onReabrir={handleReabrir}
                          onExcluir={handleExcluir}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onTogglePedidoMaterial={handleTogglePedidoMaterial}
                          togglingPedidoMaterial={togglingPedidoMaterial}
                          onUpdateDataEntrega={handleUpdateDataEntrega}
                          updatingDataEntrega={updatingDataEntrega}
                          canViewMontadoresConclusao={canViewMontadoresConclusao}
                          montadores={gruposHook.montadores}
                          canEditMontador={canEditMontador}
                          onUpdateMontadores={handleUpdateMontadores}
                          onUpdateMontadorAdmin={handleUpdateMontadorAdmin}
                          updatingMontadores={updatingMontadores}
                          showMarkupCustos={canViewMarkupCustos}
                          markupCustos={getObraMarkupCustos(obra, custosByLead)}
                          markupCustosFiltro={getFiltroMarkupDaObra(markupCustosFiltrosPorObra, obra.id)}
                          onMarkupCustosFiltroChange={filtro => handleMarkupCustosFiltroObra(obra.id, filtro)}
                          leadMidias={getObraLeadMidias(obra, midiasByLead)}
                          loadingLeadMidias={loadingLeadMidias}
                          />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
          </div>
        </KanbanPageZoomShell>
      )}

      {/* Modal detalhe (lousa + imagens) */}
      <ObraDetalheModal
        open={!!detalheObra}
        obra={detalheObra}
        canEdit={canEdit}
        canUpload={canEdit}
        isMontador={isMontador}
        montadorUserId={userProfile?.id}
        actioning={actioning}
        onClose={() => { setDetalheObra(null); clearObraDaUrl() }}
        onEdit={obra => { setDetalheObra(null); clearObraDaUrl(); setTimeout(() => openEdit(obra), 80) }}
        onIniciar={handleIniciar}
        onConcluir={handleConcluir}
        onReabrir={handleReabrir}
        canDelete={canDelete}
        onExcluir={handleExcluir}
        canAplicarComissao={canAplicarComissao(roles)}
        applyingComissao={applyingComissao}
        onAplicarComissao={handleAplicarComissao}
        prestadorId={userProfile?.id}
        showAllComissao={!isMontador}
        onUpdateDataEntrega={handleUpdateDataEntrega}
        updatingDataEntrega={updatingDataEntrega === detalheObra?.id}
        onUpdateNumeroPedidoCortClaud={handleUpdateNumeroPedidoCortClaud}
        updatingNumeroPedidoCortClaud={updatingNumeroPedidoCortClaud === detalheObra?.id}
        showMarkupCustos={canViewMarkupCustos}
        markupCustos={detalheObra ? getObraMarkupCustos(detalheObra, custosByLead) : null}
        markupCustosFiltro={
          detalheObra
            ? getFiltroMarkupDaObra(markupCustosFiltrosPorObra, detalheObra.id)
            : undefined
        }
        onMarkupCustosFiltroChange={
          detalheObra
            ? filtro => handleMarkupCustosFiltroObra(detalheObra.id, filtro)
            : undefined
        }
        montadores={gruposHook.montadores}
        canEditMontador={canEditMontador}
        onUpdateMontadores={handleUpdateMontadores}
        onUpdateMontadorAdmin={handleUpdateMontadorAdmin}
        updatingMontadores={updatingMontadores === detalheObra?.id}
        leadMidias={detalheObra ? getObraLeadMidias(detalheObra, midiasByLead) : []}
        loadingLeadMidias={loadingLeadMidias}
      />

      {/* Modal obra (edição) */}
      <ObraModal
        open={obraOpen}
        obra={editObra}
        form={obraForm}
        onChange={handleObraChange}
        onClose={() => setObraOpen(false)}
        onSave={saveObra}
        saving={savingObra}
        tipos={tiposHook.data}
        grupos={gruposHook.data}
        montadores={gruposHook.montadores}
        canEditDates={canEditDates}
        canEditMontador={canEditMontador}
        isAdmin={isObrasAdmin}
        canEditComissao={canEditComissao(roles)}
        pendingFiles={pendingFiles}
        onAddFiles={handleAddFiles}
        onRemoveFile={handleRemoveFile}
        isDraftRestored={draftRestored}
        onClearDraft={clearDraft}
        canEditLousa={canEdit}
      />

      {/* Modal configurações */}
      {canConfig && (
        <ConfigModal
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          tipos={tiposHook.data}
          grupos={gruposHook.data}
          montadores={gruposHook.montadores}
          tiposHook={tiposHook}
          gruposHook={gruposHook}
          briefingHook={briefingHook}
          canEditTiposGrupos={canConfigTiposGrupos}
          canEditBriefings={canConfigBriefings}
          canDeleteBriefings={canDeleteBriefingModelos}
        />
      )}
    </div>
  )
}
