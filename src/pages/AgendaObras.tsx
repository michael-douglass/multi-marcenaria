import { useState, useMemo, useCallback, useEffect } from 'react'
import { Settings, Plus, X, Pencil, Play, CheckCircle, Loader2, Search, Camera, Trash2 } from 'lucide-react'
import { useObras } from '../hooks/useObras'
import { useTiposObra } from '../hooks/useTiposObra'
import { useGruposObra } from '../hooks/useGruposObra'
import { useApp } from '../context/AppContext'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field } from '../components/ui/Field'
import { LoadingState, ErrorState } from '../components/ui/EmptyState'
import { ObraDetalheModal } from '../components/obras/ObraDetalheModal'
import { ObraFormModal } from '../components/obras/ObraFormModal'
import {
  buildPendingObraArquivo,
  revokePendingObraArquivoUrl,
  uploadObraArquivo,
  type PendingObraArquivo,
} from '../lib/obra-arquivos'
import { applyMontadorAdminObraDefaults, getObraMontadorIds } from '../lib/obra-montadores'
import { parseObraComissaoItens } from '../lib/obra-comissao'
import { ObraComissaoStrip } from '../components/obras/ObraComissaoStrip'
import { ObraMontadorBadge } from '../components/obras/ObraMontadorBadge'
import { ObraEmAbertoCount } from '../components/obras/ObraEmAbertoCount'
import { ObraPedidoMaterialAlert } from '../components/obras/ObraPedidoMaterialAlert'
import { ObraPedidoMaterialBadge } from '../components/obras/ObraPedidoMaterialBadge'
import { ObraPedidoMaterialToggle } from '../components/obras/ObraPedidoMaterialToggle'
import { ObraDataEntregaInput } from '../components/obras/ObraDataEntregaInput'
import { countObrasEmAberto, countObrasSemPedidoMaterial } from '../lib/obra-pedido-material'
import { groupObrasAgendaKanban } from '../lib/obra-progresso'
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
} from '../types'
import { fmtDate } from '../lib/utils'
import {
  canConfigObrasTiposGrupos,
  canDeleteObras,
  canEditObras,
  canManageAllObras,
  canEditComissao,
  canAplicarComissao,
} from '../lib/obra-permissions'
import {
  KanbanPageZoomControls,
  KanbanPageZoomShell,
  KanbanPageToolbar,
  PageZoomProvider,
} from '../components/page-zoom'

// ── Colunas do Kanban ────────────────────────────────────────
const COLUNAS: { key: StatusKanbanObra; label: string; cor: string }[] = [
  { key: 'datas_em_aberto', label: 'Datas em Aberto', cor: '#6b7280' },
  { key: 'datas_em_atraso', label: 'Datas em Atraso', cor: '#ef4444' },
  { key: 'datas_definidas', label: 'Datas Definidas', cor: '#3b82f6' },
  { key: 'em_andamento',    label: 'Em Andamento',    cor: '#f59e0b' },
  { key: 'concluida',       label: 'Concluída',       cor: '#10b981' },
  { key: 'cancelada',       label: 'Cancelada',       cor: '#9ca3af' },
]

const STATUS_LABELS: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Datas em Aberto',
  datas_em_atraso: 'Datas em Atraso',
  datas_definidas: 'Datas Definidas',
  em_andamento:    'Em Andamento',
  concluida:       'Concluída',
  cancelada:       'Cancelada',
}

/** Rótulos curtos para caber no card do Kanban sem cortar. */
const STATUS_SHORT: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Atraso',
  datas_definidas: 'Definidas',
  em_andamento:    'Andamento',
  concluida:       'Concluída',
  cancelada:       'Cancelada',
}

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
  if (
    obra.status_kanban !== 'concluida' &&
    obra.status_kanban !== 'cancelada' &&
    obra.data_prevista_fim &&
    obra.data_prevista_fim < today()
  ) return 'datas_em_atraso'
  return obra.status_kanban
}

function duracao(obra: ObraFull): string | null {
  if (!obra.iniciado_em || !obra.finalizado_em) return null
  const diff = new Date(obra.finalizado_em).getTime() - new Date(obra.iniciado_em).getTime()
  const h = Math.round(diff / 3_600_000)
  return `${h}h`
}

function CardInfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="obra-card-meta-row">
      <span className="obra-card-meta-label">{label}</span>
      <span className="obra-card-meta-value" title={value}>{value}</span>
    </div>
  )
}

// ── ObraCard ─────────────────────────────────────────────────
interface ObraCardProps {
  obra: ObraFull
  canEdit: boolean
  canDelete: boolean
  isMontador: boolean
  actioning: string | null
  isDragging: boolean
  onEdit: (obra: ObraFull) => void
  onDetalhe: (obra: ObraFull) => void
  onIniciar: (id: string) => void
  onConcluir: (id: string) => void
  onExcluir: (obra: ObraFull) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onTogglePedidoMaterial: (obra: ObraFull, feito: boolean) => void
  togglingPedidoMaterial: string | null
  onUpdateDataEntrega: (obra: ObraFull, data: string | null) => void
  updatingDataEntrega: string | null
}

function ObraCard({ obra, canEdit, canDelete, isMontador, actioning, isDragging, onEdit, onDetalhe, onIniciar, onConcluir, onExcluir, onDragStart, onDragEnd, onTogglePedidoMaterial, togglingPedidoMaterial, onUpdateDataEntrega, updatingDataEntrega }: ObraCardProps) {
  const loading = actioning === obra.id
  const computedCol = computeKanbanKey(obra)
  const colDef = COLUNAS.find(c => c.key === computedCol)

  return (
    <div
      className="glass-card p-3 text-sm flex flex-col gap-2 transition-opacity cursor-pointer overflow-hidden w-full min-w-0 box-border"
      draggable={canEdit}
      onDragStart={canEdit ? e => onDragStart(e, obra.id) : undefined}
      onDragEnd={canEdit ? onDragEnd : undefined}
      onClick={() => onDetalhe(obra)}
      style={{
        opacity: isDragging ? 0.35 : 1,
        cursor: isDragging ? 'grabbing' : 'pointer',
      }}
    >
      {/* Nome + ações */}
      <div className="flex items-start gap-1.5 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#f2d892] leading-tight break-words">{obra.cliente_nome}</p>
          {obra.lousa && (
            <p className="text-[0.7rem] text-[#edd9c4] leading-snug break-words mt-0.5">{obra.lousa}</p>
          )}
        </div>
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-0.5 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onEdit(obra) }}
                className="p-1 rounded text-[#edd9c4] hover:text-[#f2d892] transition-colors"
                title="Editar"
              >
                <Pencil size={12} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                disabled={loading}
                onClick={e => { e.stopPropagation(); onExcluir(obra) }}
                className="p-1 rounded text-[#edd9c4] hover:text-red-400 transition-colors disabled:opacity-50"
                title="Excluir obra"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status + montador */}
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-wide leading-none shrink-0"
          style={{ backgroundColor: `${colDef?.cor}22`, color: colDef?.cor, border: `1px solid ${colDef?.cor}44` }}
          title={STATUS_LABELS[computedCol]}
        >
          {STATUS_SHORT[computedCol]}
        </span>
        <ObraMontadorBadge obra={obra} />
        <ObraPedidoMaterialBadge obra={obra} />
      </div>

      <div className="flex flex-col gap-1.5">
        <ObraPedidoMaterialToggle
          obra={obra}
          canEdit={canEdit}
          loading={togglingPedidoMaterial === obra.id}
          onChange={feito => onTogglePedidoMaterial(obra, feito)}
          compact
        />

        <ObraDataEntregaInput
          obra={obra}
          canEdit={canEdit}
          loading={updatingDataEntrega === obra.id}
          onChange={data => onUpdateDataEntrega(obra, data)}
          compact
        />
      </div>

      {/* Campos informativos */}
      <div className="obra-card-meta">
        <CardInfoRow label="Tipo" value={obra.tipo_obra_nome} />
        <CardInfoRow label="Grupo" value={obra.grupo_obra_nome} />
        <CardInfoRow label="Endereço" value={obra.endereco_obra} />
        {obra.pedido_material_feito && obra.data_entrega_pedido && (
          <CardInfoRow label="Entrega" value={fmtDate(obra.data_entrega_pedido)} />
        )}
        {obra.montador_admin_nome && obra.montador_admin_nome !== obra.montador_nome && (
          <CardInfoRow label="Admin" value={obra.montador_admin_nome} />
        )}
        {(obra.data_prevista_inicio || obra.data_prevista_fim) && (
          <div className="obra-card-meta-row">
            <span className="obra-card-meta-label">Datas</span>
            <span className="obra-card-meta-value">
              {obra.data_prevista_inicio ? fmtDate(obra.data_prevista_inicio) : '?'}
              {' → '}
              {obra.data_prevista_fim ? fmtDate(obra.data_prevista_fim) : '?'}
            </span>
          </div>
        )}
        {obra.tempo_maximo_horas != null && (
          <CardInfoRow label="Prazo máx." value={`${Number(obra.tempo_maximo_horas)}h`} />
        )}
        {duracao(obra) && <CardInfoRow label="Duração" value={duracao(obra)} />}
        {obra.concluido_em_atraso && (
          <p className="text-[0.72rem] font-semibold text-red-400 m-0">Concluída em atraso</p>
        )}
      </div>

      {/* Ações do montador */}
      {(isMontador || canEdit) && (
        <div className="mt-0.5 flex flex-wrap gap-1.5 min-w-0">
          {isMontador && !obra.iniciado_em && (
            <button
              disabled={loading}
              onClick={e => { e.stopPropagation(); onIniciar(obra.id) }}
              className="flex flex-1 min-w-[calc(50%-0.375rem)] items-center justify-center gap-1 rounded px-2 py-1.5 text-[0.68rem] font-semibold bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={10} className="animate-spin shrink-0" /> : <Play size={10} className="shrink-0" />}
              <span className="truncate">Iniciar</span>
            </button>
          )}
          {isMontador && obra.iniciado_em && !obra.finalizado_em && (
            <button
              disabled={loading}
              onClick={e => { e.stopPropagation(); onConcluir(obra.id) }}
              className="flex flex-1 min-w-[calc(50%-0.375rem)] items-center justify-center gap-1 rounded px-2 py-1.5 text-[0.68rem] font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={10} className="animate-spin shrink-0" /> : <CheckCircle size={10} className="shrink-0" />}
              <span className="truncate">Concluir</span>
            </button>
          )}
          {(isMontador || canEdit) && !obra.finalizado_em && obra.status_kanban !== 'concluida' && obra.status_kanban !== 'cancelada' && !obra.iniciado_em && (
            <button
              disabled={loading}
              onClick={e => { e.stopPropagation(); onConcluir(obra.id) }}
              className="flex flex-1 min-w-[calc(50%-0.375rem)] items-center justify-center gap-1 rounded px-2 py-1.5 text-[0.68rem] font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={10} className="animate-spin shrink-0" /> : <CheckCircle size={10} className="shrink-0" />}
              <span className="truncate">Concluir</span>
            </button>
          )}
          
          {/* Sempre permitir registrar progresso se a obra não estiver cancelada e se for montador ou admin */}
          {obra.status_kanban !== 'cancelada' && (
            <button
              onClick={e => { e.stopPropagation(); onDetalhe(obra) }}
              className="flex flex-1 min-w-[calc(50%-0.375rem)] items-center justify-center gap-1 rounded px-2 py-1.5 text-[0.68rem] font-semibold bg-[#f2d892]/20 text-[#f2d892] hover:bg-[#f2d892]/30 transition-colors"
            >
              <Camera size={10} className="shrink-0" />
              <span className="truncate">Progresso</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ObraModal agora vive em src/components/obras/ObraFormModal.tsx
// Alias local para não quebrar as referências abaixo
const ObraModal = ObraFormModal

// ── Modal Configurações (tipos e grupos) ─────────────────────
function ConfigModal({
  open, onClose, tipos, grupos, montadores, tiposHook, gruposHook,
}: {
  open: boolean
  onClose: () => void
  tipos: TipoObra[]
  grupos: GrupoObra[]
  montadores: { id: string; nome?: string | null; email: string }[]
  tiposHook: ReturnType<typeof useTiposObra>
  gruposHook: ReturnType<typeof useGruposObra>
}) {
  const [tab, setTab] = useState<'tipos' | 'grupos'>('tipos')
  const [tipoForm, setTipoForm] = useState<TipoObraInput>(BLANK_TIPO)
  const [tipoEdit, setTipoEdit] = useState<string | null>(null)
  const [grupoForm, setGrupoForm] = useState<GrupoObraInput>(BLANK_GRUPO)
  const [grupoEdit, setGrupoEdit] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
    <Modal open={open} onClose={onClose} title="CONFIGURAÇÕES DE OBRAS">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('tipos')} className={`btn btn-md ${tab === 'tipos' ? 'btn-gold' : 'btn-outline'}`}>Tipos de Obra</button>
        <button onClick={() => setTab('grupos')} className={`btn btn-md ${tab === 'grupos' ? 'btn-gold' : 'btn-outline'}`}>Grupos de Obra</button>
      </div>

      {tab === 'tipos' && (
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
                  <p className="font-semibold text-cream">{t.nome}</p>
                  <p className="text-[0.7rem] text-[#edd9c4]">Médio: {t.tempo_medio_horas ?? '—'}h / Máx.: {t.tempo_maximo_horas_default ?? '—'}h</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setTipoEdit(t.id); setTipoForm({ nome: t.nome, descricao: t.descricao ?? null, tempo_medio_horas: t.tempo_medio_horas ?? null, tempo_maximo_horas_default: t.tempo_maximo_horas_default ?? null, ativo: t.ativo }) }} className="p-1 text-[#edd9c4] hover:text-[#f2d892]"><Pencil size={12} /></button>
                  <button onClick={() => tiposHook.remove(t.id)} className="p-1 text-[#edd9c4] hover:text-red-400"><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'grupos' && (
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
                <p className="font-semibold text-cream">{g.nome}</p>
                <div className="flex gap-1">
                  <button onClick={() => { setGrupoEdit(g.id); setGrupoForm({ nome: g.nome, descricao: g.descricao ?? null, montador_admin_id: g.montador_admin_id ?? null, ativo: g.ativo }) }} className="p-1 text-[#edd9c4] hover:text-[#f2d892]"><Pencil size={12} /></button>
                  <button onClick={() => gruposHook.remove(g.id)} className="p-1 text-[#edd9c4] hover:text-red-400"><X size={12} /></button>
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
  return (
    <PageZoomProvider pageKey="agenda_obras">
      <AgendaObrasContent />
    </PageZoomProvider>
  )
}

function AgendaObrasContent() {
  const { roles, userProfile } = useApp()
  const obrasHook = useObras()
  const tiposHook = useTiposObra()
  const gruposHook = useGruposObra()

  const isMontadorAdmin = roles.includes('MontadorAdmin')
  const isMontador = roles.includes('Montador') && !isMontadorAdmin
  const canEdit = canEditObras(roles)
  const canEditMontador = canEdit
  const canEditDates = canEdit
  const canConfig = canConfigObrasTiposGrupos(roles)
  const canDelete = canDeleteObras(roles)
  const isObrasAdmin = canManageAllObras(roles) || isMontadorAdmin

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
  const [detalheObra, setDetalheObra] = useState<ObraFull | null>(null)
  const [applyingComissao, setApplyingComissao] = useState(false)

  // Mantém o modal de detalhes sincronizado após iniciar/concluir obra
  useEffect(() => {
    if (!detalheObra) return
    const fresh = obrasHook.data.find(o => o.id === detalheObra.id)
    if (fresh) setDetalheObra(fresh)
    else setDetalheObra(null)
  }, [obrasHook.data, detalheObra?.id])

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
      await obrasHook.update(id, { status_kanban: col })
    } catch {
      // erro já visível via toast se necessário
    }
  }

  const obrasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return obrasHook.data
    return obrasHook.data.filter(o => {
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
  }, [obrasHook.data, busca])

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

      // Auto-compute status when dates change
      if ((k === 'data_prevista_inicio' || k === 'data_prevista_fim') && !editObra?.iniciado_em) {
        const fim = k === 'data_prevista_fim' ? (v as string) : p.data_prevista_fim
        if (fim) {
          next.status_kanban = fim < today() ? 'datas_em_atraso' : 'datas_definidas'
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
        ? obraForm
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
      if (detalheObra?.id === obra.id) setDetalheObra(null)
      if (editObra?.id === obra.id) setObraOpen(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível excluir a obra.')
    } finally {
      setActioning(null)
    }
  }

  return (
    <div className="obra-page-shell obra-page-shell--agenda fade-in flex flex-none min-w-0 flex-col overflow-visible md:min-h-0 md:flex-1 md:overflow-hidden">
      <KanbanPageToolbar className="agenda-kanban-toolbar">
        <ObraPageHeader
          title="Agenda de Obras"
          collapseBelowOnMobile
          belowMobileLabel="Busca"
          subtitle={
            <>
              {obrasFiltradas.length} de {obrasHook.data.length} obra{obrasHook.data.length !== 1 ? 's' : ''}
              {busca && <span className="ml-1 text-[#f2d892]">· filtrado</span>}
            </>
          }
          actions={
            <div className="obra-page-header__actions-inner">
              <div className="obra-page-header__badges flex flex-col items-start gap-1">
                <ObraPedidoMaterialAlert count={semPedidoMaterialCount} compact />
                <ObraEmAbertoCount count={obrasEmAbertoCount} compact />
              </div>
              <KanbanPageZoomControls className="obra-toolbar-zoom shrink-0" />
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
          below={
            <div className="obra-page-search relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#edd9c4] pointer-events-none"
              />
              <input
                className="glass-input pl-9 pr-8 w-full"
                placeholder="Buscar por cliente, montador, endereço, tipo..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#edd9c4] hover:text-[#f2d892] transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          }
        />
      </KanbanPageToolbar>

      {/* Estados de carregamento/erro */}
      {obrasHook.loading && <LoadingState />}
      {!obrasHook.loading && obrasHook.error && <ErrorState message={obrasHook.error} />}

      {/* Kanban */}
      {!obrasHook.loading && !obrasHook.error && (
        <KanbanPageZoomShell
          showScrollArrows
          horizontalScrollbar
          verticalScrollbar
          contentSignal={`${obrasHook.data.length}-${busca}-${obrasFiltradas.length}`}
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
                          actioning={actioning}
                          isDragging={draggingId === obra.id}
                          onDetalhe={o => setDetalheObra(o)}
                          onEdit={openEdit}
                          onIniciar={handleIniciar}
                          onConcluir={handleConcluir}
                          onExcluir={handleExcluir}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onTogglePedidoMaterial={handleTogglePedidoMaterial}
                          togglingPedidoMaterial={togglingPedidoMaterial}
                          onUpdateDataEntrega={handleUpdateDataEntrega}
                          updatingDataEntrega={updatingDataEntrega}
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
        actioning={actioning}
        onClose={() => setDetalheObra(null)}
        onEdit={obra => { setDetalheObra(null); setTimeout(() => openEdit(obra), 80) }}
        onIniciar={handleIniciar}
        onConcluir={handleConcluir}
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
        />
      )}
    </div>
  )
}
