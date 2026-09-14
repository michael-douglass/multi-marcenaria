import { useState } from 'react'
import { Pencil, Loader2, Camera, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { getObraMontadorIds } from '@/lib/obra-montadores'
import { ObraMontadorBadge } from '@/components/obras/ObraMontadorBadge'
import { ObraMontadoresAjudantesField } from '@/components/obras/ObraMontadoresAjudantesField'
import { ObraMontadoresConclusao } from '@/components/obras/ObraMontadoresConclusao'
import { ObraEquipeActionBar } from '@/components/obras/ObraEquipeActionBar'
import { ObraPedidoMaterialBadge } from '@/components/obras/ObraPedidoMaterialBadge'
import { ObraPedidoMaterialToggle } from '@/components/obras/ObraPedidoMaterialToggle'
import { ObraMarkupCustosBlock } from '@/components/obras/ObraMarkupCustosBlock'
import { ObraDataEntregaInput } from '@/components/obras/ObraDataEntregaInput'
import { ObraLeadMidiasStrip } from '@/components/obras/ObraLeadMidiasStrip'
import { ObraWeekCardRoster } from '@/components/obras/ObraWeekCardRoster'
import { ObraTempoBar } from '@/components/obras/ObraTempoBar'
import { getStatusEfetivo } from '@/lib/obra-progresso'
import { fmtDate } from '@/lib/utils'
import type {
  ObraFull,
  StatusKanbanObra,
  UserRole,
  MarkupCustosFiltro,
  MarkupOrcamentoCustos,
  LeadMidia,
} from '@/types'

const COLUNAS: { key: StatusKanbanObra; label: string; cor: string }[] = [
  { key: 'datas_em_aberto', label: 'Datas em Aberto', cor: '#6b7280' },
  { key: 'datas_em_atraso', label: 'Datas em Atraso', cor: '#ef4444' },
  { key: 'datas_definidas', label: 'Datas Definidas', cor: '#3b82f6' },
  { key: 'em_andamento', label: 'Em Andamento', cor: '#f59e0b' },
  { key: 'concluida', label: 'Concluída', cor: '#10b981' },
  { key: 'cancelada', label: 'Cancelada', cor: '#9ca3af' },
]

const STATUS_LABELS: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Datas em Aberto',
  datas_em_atraso: 'Datas em Atraso',
  datas_definidas: 'Datas Definidas',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const STATUS_SHORT: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Atraso',
  datas_definidas: 'Definidas',
  em_andamento: 'Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

function computeKanbanKey(obra: ObraFull): StatusKanbanObra {
  return getStatusEfetivo(obra)
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

export interface ObraCardProps {
  obra: ObraFull
  canEdit: boolean
  canDelete: boolean
  isMontador: boolean
  montadorUserId?: string | null
  roles: UserRole[]
  actioning: string | null
  isDragging: boolean
  onEdit: (obra: ObraFull) => void
  onDetalhe: (obra: ObraFull) => void
  onIniciar: (id: string) => void
  onConcluir: (id: string) => void
  onReabrir: (id: string) => void
  onExcluir: (obra: ObraFull) => void
  onDragStart?: (e: React.DragEvent, id: string) => void
  onDragEnd?: () => void
  /** Se false, desliga arrastar (útil na vista Filas). */
  draggable?: boolean
  /** Inicia no modo compacto (estilo card da semana do calendário). */
  startMinimized?: boolean
  onTogglePedidoMaterial: (obra: ObraFull, feito: boolean) => void
  togglingPedidoMaterial: string | null
  onUpdateDataEntrega: (obra: ObraFull, data: string | null) => void
  updatingDataEntrega: string | null
  canViewMontadoresConclusao: boolean
  montadores: { id: string; nome?: string | null; email: string; perfil: string }[]
  canEditMontador: boolean
  onUpdateMontadores: (obra: ObraFull, montadorIds: string[]) => void
  onUpdateMontadorAdmin: (obra: ObraFull, montadorAdminId: string | null) => void
  updatingMontadores: string | null
  showMarkupCustos?: boolean
  markupCustos?: MarkupOrcamentoCustos | null
  markupCustosFiltro?: MarkupCustosFiltro
  onMarkupCustosFiltroChange?: (filtro: MarkupCustosFiltro) => void
  leadMidias?: LeadMidia[]
  loadingLeadMidias?: boolean
}

export function ObraCard({
  obra,
  canEdit,
  canDelete,
  isMontador,
  montadorUserId,
  roles,
  actioning,
  isDragging,
  onEdit,
  onDetalhe,
  onIniciar,
  onConcluir,
  onReabrir,
  onExcluir,
  onDragStart,
  onDragEnd,
  draggable = true,
  startMinimized = false,
  onTogglePedidoMaterial,
  togglingPedidoMaterial,
  onUpdateDataEntrega,
  updatingDataEntrega,
  canViewMontadoresConclusao,
  montadores,
  canEditMontador,
  onUpdateMontadores,
  onUpdateMontadorAdmin,
  updatingMontadores,
  showMarkupCustos = false,
  markupCustos = null,
  markupCustosFiltro,
  onMarkupCustosFiltroChange,
  leadMidias = [],
  loadingLeadMidias = false,
}: ObraCardProps) {
  const [expanded, setExpanded] = useState(!startMinimized)
  const loading = actioning === obra.id
  const euSouMontadorNaObra = !!montadorUserId && getObraMontadorIds(obra).includes(montadorUserId)
  const marcacaoIndividual = isMontador || euSouMontadorNaObra
  const computedCol = computeKanbanKey(obra)
  const colDef = COLUNAS.find(c => c.key === computedCol)
  const statusCor = colDef?.cor ?? '#6b7280'
  const canDrag = Boolean(draggable && canEdit && onDragStart && onDragEnd)
  const minimized = startMinimized && !expanded

  if (minimized) {
    return (
      <div
        className="cal-week-card obra-card--fila-min"
        style={{
          backgroundColor: `color-mix(in srgb, ${statusCor} 14%, #fffcf8)`,
          borderLeft: `3px solid ${statusCor}`,
          opacity: isDragging ? 0.35 : 1,
        }}
        draggable={canDrag}
        onDragStart={canDrag ? e => onDragStart?.(e, obra.id) : undefined}
        onDragEnd={canDrag ? onDragEnd : undefined}
      >
        <div className="flex items-start gap-1 min-w-0">
          <button
            type="button"
            className="cal-week-card__title flex-1 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer"
            title={obra.cliente_nome}
            onClick={() => onDetalhe(obra)}
          >
            {obra.cliente_nome}
          </button>
          <button
            type="button"
            className="shrink-0 p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-gold-muted)]"
            aria-label="Expandir card"
            title="Expandir"
            onClick={e => { e.stopPropagation(); setExpanded(true) }}
          >
            <ChevronDown size={14} />
          </button>
        </div>
        {obra.lousa && (
          <p className="m-0 text-[0.58rem] text-[var(--color-text-muted)] truncate" title={obra.lousa}>
            {obra.lousa}
          </p>
        )}
        {(obra.data_prevista_inicio || obra.data_prevista_fim) && (
          <p
            className="m-0 text-[0.62rem] font-semibold tabular-nums text-[var(--color-text-secondary)]"
            title="Datas previstas (atual)"
          >
            {obra.data_prevista_inicio ? fmtDate(obra.data_prevista_inicio) : '?'}
            {' → '}
            {obra.data_prevista_fim ? fmtDate(obra.data_prevista_fim) : '?'}
          </p>
        )}
        {(obra.data_prevista_inicio_original || obra.data_prevista_fim_original) && (
          <p
            className="m-0 text-[0.55rem] font-medium tabular-nums text-[var(--color-text-muted)]"
            title="Data original (primeira definida)"
          >
            Original:{' '}
            {obra.data_prevista_inicio_original
              ? fmtDate(obra.data_prevista_inicio_original)
              : '?'}
            {' → '}
            {obra.data_prevista_fim_original
              ? fmtDate(obra.data_prevista_fim_original)
              : '?'}
          </p>
        )}
        <ObraWeekCardRoster
          obra={obra}
          status={computedCol}
          statusColor={statusCor}
          canViewMontadoresConclusao={canViewMontadoresConclusao}
        />
        <ObraTempoBar obra={obra} micro />
        <ObraEquipeActionBar
          obra={obra}
          roles={roles}
          canEdit={canEdit}
          isMontador={isMontador}
          montadorUserId={montadorUserId}
          loading={loading}
          onIniciar={onIniciar}
          onConcluir={onConcluir}
          onReabrir={onReabrir}
          dense
        />
      </div>
    )
  }

  return (
    <div
      className="glass-card p-3 text-sm flex flex-col gap-2 transition-opacity cursor-pointer overflow-hidden w-full min-w-0 box-border"
      draggable={canDrag}
      onDragStart={canDrag ? e => onDragStart?.(e, obra.id) : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onClick={() => onDetalhe(obra)}
      style={{
        opacity: isDragging ? 0.35 : 1,
        cursor: isDragging ? 'grabbing' : 'pointer',
      }}
    >
      <div className="flex items-start gap-1.5 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--color-text-primary)] leading-tight break-words">{obra.cliente_nome}</p>
          {obra.lousa && (
            <p className="text-[0.7rem] text-[var(--color-text-muted)] leading-snug break-words mt-0.5">{obra.lousa}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {startMinimized && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setExpanded(false) }}
              className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-gold-muted)] transition-colors"
              title="Minimizar"
              aria-label="Minimizar card"
            >
              <ChevronUp size={12} />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onEdit(obra) }}
              className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-gold-muted)] transition-colors"
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
              className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-600 transition-colors disabled:opacity-50"
              title="Excluir obra"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          )}
        </div>
      </div>

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

      <ObraMontadoresAjudantesField
        obra={obra}
        montadores={montadores}
        canEdit={canEditMontador}
        loading={updatingMontadores === obra.id}
        onChange={ids => onUpdateMontadores(obra, ids)}
        onChangeAdmin={adminId => onUpdateMontadorAdmin(obra, adminId)}
        compact
      />

      <ObraMontadoresConclusao obra={obra} compact visible={canViewMontadoresConclusao} />

      <ObraLeadMidiasStrip
        midias={leadMidias}
        loading={loadingLeadMidias}
        variant="compact"
      />

      <div className="flex flex-col gap-1.5">
        <ObraPedidoMaterialToggle
          obra={obra}
          canEdit={canEdit}
          loading={togglingPedidoMaterial === obra.id}
          onChange={feito => onTogglePedidoMaterial(obra, feito)}
          compact
        />

        {showMarkupCustos && (
          <ObraMarkupCustosBlock
            custos={markupCustos}
            filtro={markupCustosFiltro}
            onFiltroChange={onMarkupCustosFiltroChange}
            variant="compact"
          />
        )}

        <ObraDataEntregaInput
          obra={obra}
          canEdit={canEdit}
          loading={updatingDataEntrega === obra.id}
          onChange={data => onUpdateDataEntrega(obra, data)}
          compact
        />
      </div>

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
        {(obra.data_prevista_inicio_original || obra.data_prevista_fim_original) && (
          <div className="obra-card-meta-row">
            <span className="obra-card-meta-label">Original</span>
            <span
              className="obra-card-meta-value text-[var(--color-text-muted)]"
              title="Primeira data definida"
            >
              {obra.data_prevista_inicio_original
                ? fmtDate(obra.data_prevista_inicio_original)
                : '?'}
              {' → '}
              {obra.data_prevista_fim_original
                ? fmtDate(obra.data_prevista_fim_original)
                : '?'}
            </span>
          </div>
        )}
        {obra.atraso_permanente && obra.status_kanban !== 'concluida' && obra.status_kanban !== 'cancelada' && (
          <p className="text-[0.72rem] font-semibold text-red-600 m-0">Atraso permanente</p>
        )}
        {obra.tempo_maximo_horas != null && (
          <CardInfoRow label="Prazo máx." value={`${Number(obra.tempo_maximo_horas)}h`} />
        )}
        {duracao(obra) && <CardInfoRow label="Duração" value={duracao(obra)} />}
        {obra.concluido_em_atraso && (
          <p className="text-[0.72rem] font-semibold text-red-600 m-0">Concluída em atraso</p>
        )}
      </div>

      <div className="mt-0.5 flex flex-col gap-1.5 min-w-0">
        <ObraEquipeActionBar
          obra={obra}
          roles={roles}
          canEdit={canEdit}
          isMontador={isMontador}
          montadorUserId={montadorUserId}
          loading={loading}
          onIniciar={onIniciar}
          onConcluir={onConcluir}
          onReabrir={onReabrir}
          compact
        />
        {(marcacaoIndividual || canEdit) && obra.status_kanban !== 'cancelada' && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDetalhe(obra) }}
            className="flex w-full min-w-0 items-center justify-center gap-1 rounded px-2 py-1.5 text-[0.68rem] font-semibold bg-[#f2d892]/20 text-[#f2d892] hover:bg-[#f2d892]/30 transition-colors"
          >
            <Camera size={10} className="shrink-0" />
            <span className="truncate">Progresso</span>
          </button>
        )}
      </div>
    </div>
  )
}
