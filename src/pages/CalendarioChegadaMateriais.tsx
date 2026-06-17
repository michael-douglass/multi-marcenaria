import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Search, X } from 'lucide-react'
import { useObras } from '@/hooks/useObras'
import { useTiposObra } from '@/hooks/useTiposObra'
import { useGruposObra } from '@/hooks/useGruposObra'
import { useApp } from '@/context/AppContext'
import { ObraDetalheModal } from '@/components/obras/ObraDetalheModal'
import { ObraFormModal } from '@/components/obras/ObraFormModal'
import { ObraMontadorBadge } from '@/components/obras/ObraMontadorBadge'
import { ObraPedidoMaterialAlert } from '@/components/obras/ObraPedidoMaterialAlert'
import { ObraPedidoMaterialBadge } from '@/components/obras/ObraPedidoMaterialBadge'
import { ObraPedidoMaterialToggle } from '@/components/obras/ObraPedidoMaterialToggle'
import { ObraDataEntregaInput } from '@/components/obras/ObraDataEntregaInput'
import { ObraPageHeader } from '@/components/obras/ObraPageHeader'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import {
  KANBAN_COL_CLASS,
  kanbanColHeaderClass,
  kanbanColHeaderStyle,
} from '@/components/obras/obra-kanban-layout'
import {
  KanbanPageZoomControls,
  KanbanPageZoomShell,
  KanbanPageToolbar,
  PageZoomProvider,
} from '@/components/page-zoom'
import {
  addDaysISO,
  buildChegadaMaterialColunas,
  colKeyFromDropTarget,
  formatWeekRangeLabel,
  getWeekDayISOs,
  groupObrasPorChegadaMaterial,
  type ChegadaMaterialColKey,
} from '@/lib/obra-chegada-material'
import { countObrasSemPedidoMaterial } from '@/lib/obra-pedido-material'
import { canEditObras, canDeleteObras } from '@/lib/obra-permissions'
import { fmtDate } from '@/lib/utils'
import type { ObraFull, ObraInput } from '@/types'

const BLANK_OBRA: ObraInput = {
  cliente_nome: '', cliente_id: null, lousa: null, descricao: null, endereco_obra: null,
  tipo_obra_id: null, grupo_obra_id: null, montador_admin_id: null, montador_id: null, montador_ids: [],
  data_prevista_inicio: null, data_prevista_fim: null, tempo_maximo_horas: null,
  status_kanban: 'datas_em_aberto', pedido_material_feito: false, data_entrega_pedido: null,
  numero_pedido_cort_claud: null,
  comissao_habilitada: false, comissao_itens: [],
}

interface MaterialCardProps {
  obra: ObraFull
  canEdit: boolean
  isDragging: boolean
  updatingPedido: boolean
  updatingData: boolean
  onDetalhe: (obra: ObraFull) => void
  onEdit: (obra: ObraFull) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onTogglePedido: (obra: ObraFull, feito: boolean) => void
  onUpdateDataEntrega: (obra: ObraFull, data: string | null) => void
}

function MaterialChegadaCard({
  obra,
  canEdit,
  isDragging,
  updatingPedido,
  updatingData,
  onDetalhe,
  onEdit,
  onDragStart,
  onDragEnd,
  onTogglePedido,
  onUpdateDataEntrega,
}: MaterialCardProps) {
  return (
    <div
      className="glass-card p-3 text-sm flex flex-col gap-2 transition-opacity cursor-pointer overflow-hidden w-full min-w-0 box-border"
      draggable={canEdit}
      onDragStart={canEdit ? e => onDragStart(e, obra.id) : undefined}
      onDragEnd={canEdit ? onDragEnd : undefined}
      onClick={() => onDetalhe(obra)}
      style={{ opacity: isDragging ? 0.35 : 1, cursor: isDragging ? 'grabbing' : 'pointer' }}
    >
      <div className="flex items-start gap-1.5 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#d4a853] leading-tight break-words">{obra.cliente_nome}</p>
          {obra.lousa && (
            <p className="text-[0.7rem] text-[#8a6a55] leading-snug break-words mt-0.5">{obra.lousa}</p>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onEdit(obra) }}
            className="p-1 rounded text-[#8a6a55] hover:text-[#d4a853] transition-colors shrink-0"
            title="Editar obra"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        <ObraMontadorBadge obra={obra} />
        <ObraPedidoMaterialBadge obra={obra} />
      </div>

      <div className="flex flex-col gap-1.5">
        <ObraPedidoMaterialToggle
          obra={obra}
          canEdit={canEdit}
          loading={updatingPedido}
          onChange={feito => onTogglePedido(obra, feito)}
          compact
        />
        <ObraDataEntregaInput
          obra={obra}
          canEdit={canEdit}
          loading={updatingData}
          onChange={data => onUpdateDataEntrega(obra, data)}
          compact
        />
      </div>

      <div className="obra-card-meta">
        {obra.tipo_obra_nome && (
          <div className="obra-card-meta-row">
            <span className="obra-card-meta-label">Tipo</span>
            <span className="obra-card-meta-value">{obra.tipo_obra_nome}</span>
          </div>
        )}
        {obra.endereco_obra && (
          <div className="obra-card-meta-row">
            <span className="obra-card-meta-label">Endereço</span>
            <span className="obra-card-meta-value" title={obra.endereco_obra}>{obra.endereco_obra}</span>
          </div>
        )}
        {obra.numero_pedido_cort_claud && (
          <div className="obra-card-meta-row">
            <span className="obra-card-meta-label">Pedido</span>
            <span className="obra-card-meta-value">{obra.numero_pedido_cort_claud}</span>
          </div>
        )}
        {(obra.data_prevista_inicio || obra.data_prevista_fim) && (
          <div className="obra-card-meta-row">
            <span className="obra-card-meta-label">Montagem</span>
            <span className="obra-card-meta-value">
              {obra.data_prevista_inicio ? fmtDate(obra.data_prevista_inicio) : '?'}
              {' → '}
              {obra.data_prevista_fim ? fmtDate(obra.data_prevista_fim) : '?'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ChegadaMateriais() {
  return (
    <PageZoomProvider pageKey="chegada_materiais">
      <ChegadaMateriaisContent />
    </PageZoomProvider>
  )
}

/** @deprecated Use ChegadaMateriais */
export const CalendarioChegadaMateriais = ChegadaMateriais

function ChegadaMateriaisContent() {
  const { roles } = useApp()
  const obrasHook = useObras()
  const tiposHook = useTiposObra()
  const gruposHook = useGruposObra()
  const canEdit = canEditObras(roles)
  const canDelete = canDeleteObras(roles)

  const [viewDate, setViewDate] = useState(() => new Date())
  const [busca, setBusca] = useState('')
  const [detalheObra, setDetalheObra] = useState<ObraFull | null>(null)
  const [editObra, setEditObra] = useState<ObraFull | null>(null)
  const [obraOpen, setObraOpen] = useState(false)
  const [obraForm, setObraForm] = useState<ObraInput>(BLANK_OBRA)
  const [savingObra, setSavingObra] = useState(false)
  const [togglingPedidoMaterial, setTogglingPedidoMaterial] = useState<string | null>(null)
  const [updatingDataEntrega, setUpdatingDataEntrega] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ChegadaMaterialColKey | null>(null)

  const weekDays = useMemo(() => getWeekDayISOs(viewDate), [viewDate])
  const colunas = useMemo(() => buildChegadaMaterialColunas(weekDays), [weekDays])
  const weekLabel = useMemo(() => formatWeekRangeLabel(weekDays), [weekDays])

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
        o.numero_pedido_cort_claud,
        o.data_entrega_pedido,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [obrasHook.data, busca])

  const obrasByCol = useMemo(
    () => groupObrasPorChegadaMaterial(obrasFiltradas, weekDays),
    [obrasFiltradas, weekDays],
  )

  const semPedidoCount = useMemo(
    () => countObrasSemPedidoMaterial(obrasHook.data),
    [obrasHook.data],
  )

  useEffect(() => {
    if (!detalheObra) return
    const fresh = obrasHook.data.find(o => o.id === detalheObra.id)
    if (fresh) setDetalheObra(fresh)
    else setDetalheObra(null)
  }, [obrasHook.data, detalheObra?.id])

  const handleUpdateDataEntrega = async (obra: ObraFull, data: string | null) => {
    if (!canEdit) return
    setUpdatingDataEntrega(obra.id)
    try {
      await obrasHook.update(obra.id, {
        pedido_material_feito: true,
        data_entrega_pedido: data,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível atualizar a data de chegada.')
    } finally {
      setUpdatingDataEntrega(null)
    }
  }

  const handleTogglePedidoMaterial = async (obra: ObraFull, feito: boolean) => {
    if (!canEdit) return
    setTogglingPedidoMaterial(obra.id)
    try {
      await obrasHook.update(obra.id, {
        pedido_material_feito: feito,
        data_entrega_pedido: feito ? obra.data_entrega_pedido : null,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível atualizar o pedido de material.')
    } finally {
      setTogglingPedidoMaterial(null)
    }
  }

  const openEdit = (obra: ObraFull) => {
    setEditObra(obra)
    setObraForm({
      cliente_nome: obra.cliente_nome,
      cliente_id: obra.cliente_id,
      lousa: obra.lousa,
      descricao: obra.descricao,
      endereco_obra: obra.endereco_obra,
      tipo_obra_id: obra.tipo_obra_id,
      grupo_obra_id: obra.grupo_obra_id,
      montador_admin_id: obra.montador_admin_id,
      montador_id: obra.montador_id,
      montador_ids: obra.montador_ids ?? [],
      data_prevista_inicio: obra.data_prevista_inicio,
      data_prevista_fim: obra.data_prevista_fim,
      tempo_maximo_horas: obra.tempo_maximo_horas,
      status_kanban: obra.status_kanban,
      pedido_material_feito: obra.pedido_material_feito,
      data_entrega_pedido: obra.data_entrega_pedido,
      numero_pedido_cort_claud: obra.numero_pedido_cort_claud,
      comissao_habilitada: obra.comissao_habilitada,
      comissao_itens: obra.comissao_itens ?? [],
    })
    setObraOpen(true)
  }

  const saveObra = async () => {
    if (!editObra) return
    setSavingObra(true)
    try {
      await obrasHook.update(editObra.id, obraForm)
      setObraOpen(false)
      setEditObra(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível salvar a obra.')
    } finally {
      setSavingObra(false)
    }
  }

  const handleObraChange = (k: keyof ObraInput, v: string | null | number | string[] | boolean) => {
    setObraForm(p => ({ ...p, [k]: v }))
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverCol(null)
  }

  const handleDrop = async (e: React.DragEvent, col: ChegadaMaterialColKey) => {
    e.preventDefault()
    if (!canEdit) return
    const id = draggingId ?? e.dataTransfer.getData('text/plain')
    setDraggingId(null)
    setDragOverCol(null)
    if (!id) return

    const patch = colKeyFromDropTarget(col)
    if (!patch) return

    const obra = obrasHook.data.find(o => o.id === id)
    if (!obra) return

    try {
      await obrasHook.update(id, patch)
    } catch {
      alert('Não foi possível mover a obra para esta coluna.')
    }
  }

  const goWeek = (dir: -1 | 1) => {
    setViewDate(d => new Date(addDaysISO(d.toISOString().slice(0, 10), dir * 7) + 'T12:00:00'))
  }

  const goToday = useCallback(() => setViewDate(new Date()), [])

  return (
    <div className="obra-page-shell obra-page-shell--chegada-material fade-in flex flex-none flex-col overflow-visible">
      <KanbanPageToolbar className="agenda-kanban-toolbar shrink-0">
        <ObraPageHeader
          title="Chegada de Materiais"
          collapseBelowOnMobile
          belowMobileLabel="Busca"
          subtitle={
            <>
              Semana: <span className="text-[#d4a853]">{weekLabel}</span>
              {' · '}
              {obrasFiltradas.length} obra{obrasFiltradas.length !== 1 ? 's' : ''}
            </>
          }
          actions={
            <div className="obra-page-header__actions-inner">
              <div className="obra-page-header__badges flex flex-col items-start gap-1">
                <ObraPedidoMaterialAlert count={semPedidoCount} compact />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" className="btn btn-outline btn-sm !px-2" onClick={() => goWeek(-1)} aria-label="Semana anterior">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={goToday}>Hoje</button>
                <button type="button" className="btn btn-outline btn-sm !px-2" onClick={() => goWeek(1)} aria-label="Próxima semana">
                  <ChevronRight size={16} />
                </button>
              </div>
              <KanbanPageZoomControls className="obra-toolbar-zoom shrink-0" />
            </div>
          }
          below={
            <div className="obra-page-search relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a6a55] pointer-events-none" />
              <input
                className="glass-input pl-9 pr-8 w-full"
                placeholder="Buscar por cliente, pedido, montador, endereço..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a6a55] hover:text-[#d4a853] transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          }
        />
      </KanbanPageToolbar>

      {obrasHook.loading && <LoadingState />}
      {!obrasHook.loading && obrasHook.error && <ErrorState message={obrasHook.error} />}

      {!obrasHook.loading && !obrasHook.error && (
        <KanbanPageZoomShell
          showScrollArrows
          horizontalScrollbar
          verticalScrollbar
          contentSignal={`${weekLabel}-${busca}-${obrasFiltradas.length}`}
          className="chegada-kanban-shell shrink-0"
        >
          <div className="agenda-kanban-board obra-scroll-x-mobile flex w-max min-w-full gap-4 pb-1">
            {colunas.map(col => {
              const obras = obrasByCol[col.key] ?? []
              const isOver = dragOverCol === col.key && draggingId !== null
              const canDrop = canEdit && colKeyFromDropTarget(col.key) !== null

              return (
                <div
                  key={col.key}
                  className={KANBAN_COL_CLASS}
                  onDragOver={canDrop ? e => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOverCol(col.key)
                  } : undefined}
                  onDragLeave={canDrop ? () => setDragOverCol(null) : undefined}
                  onDrop={canDrop ? e => void handleDrop(e, col.key) : undefined}
                >
                  <div
                    className={kanbanColHeaderClass(isOver, col.cor)}
                    style={kanbanColHeaderStyle(isOver, col.cor)}
                  >
                    <span className="kanban-col-title min-w-0 flex-1" style={{ color: col.cor }} title={col.label}>
                      {col.short}
                    </span>
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold"
                      style={{ backgroundColor: `${col.cor}33`, color: col.cor }}
                    >
                      {obras.length}
                    </span>
                  </div>

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
                      <div className="text-center py-8 text-[0.75rem] text-[#6b5544]">Nenhuma obra</div>
                    ) : obras.length === 0 && isOver ? (
                      <div className="flex items-center justify-center py-8 text-[0.75rem]" style={{ color: col.cor }}>
                        Soltar aqui
                      </div>
                    ) : (
                      obras.map(obra => (
                        <MaterialChegadaCard
                          key={obra.id}
                          obra={obra}
                          canEdit={canEdit}
                          isDragging={draggingId === obra.id}
                          updatingPedido={togglingPedidoMaterial === obra.id}
                          updatingData={updatingDataEntrega === obra.id}
                          onDetalhe={setDetalheObra}
                          onEdit={openEdit}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onTogglePedido={handleTogglePedidoMaterial}
                          onUpdateDataEntrega={handleUpdateDataEntrega}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </KanbanPageZoomShell>
      )}

      <ObraDetalheModal
        open={!!detalheObra}
        obra={detalheObra}
        canEdit={canEdit}
        canUpload={canEdit}
        isMontador={false}
        actioning={null}
        onClose={() => setDetalheObra(null)}
        onEdit={obra => { setDetalheObra(null); setTimeout(() => openEdit(obra), 80) }}
        onIniciar={() => {}}
        onConcluir={() => {}}
        canDelete={canDelete}
        onExcluir={() => {}}
        canAplicarComissao={false}
        applyingComissao={false}
        onAplicarComissao={() => {}}
        showAllComissao
        onUpdateDataEntrega={handleUpdateDataEntrega}
        updatingDataEntrega={updatingDataEntrega === detalheObra?.id}
      />

      <ObraFormModal
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
        canEditDates={canEdit}
        canEditMontador={canEdit}
        isAdmin={canEdit}
        canEditComissao={false}
        pendingFiles={[]}
        onAddFiles={() => {}}
        onRemoveFile={() => {}}
      />
    </div>
  )
}
