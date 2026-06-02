import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, Search, Filter, CheckCircle, Loader2, CalendarDays } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useObras } from '../hooks/useObras'
import { useTiposObra } from '../hooks/useTiposObra'
import { useGruposObra } from '../hooks/useGruposObra'
import { useApp } from '../context/AppContext'
import { ObraDetalheModal } from '../components/obras/ObraDetalheModal'
import { ObraFormModal } from '../components/obras/ObraFormModal'
import { ObraMontadorBadge } from '../components/obras/ObraMontadorBadge'
import { ObraTempoBar } from '../components/obras/ObraTempoBar'
import { LoadingState, ErrorState } from '../components/ui/EmptyState'
import { filtrarObrasCalendario } from '../lib/obra-progresso'
import { fmtDate } from '../lib/utils'
import type { ObraFull, ObraInput, StatusKanbanObra } from '../types'

type CalView = 'day' | 'week' | 'month'

// ── Constantes ───────────────────────────────────────────────
const STATUS_COLORS: Record<StatusKanbanObra, string> = {
  datas_em_aberto: '#6b7280',
  datas_em_atraso: '#ef4444',
  datas_definidas: '#3b82f6',
  em_andamento:    '#f59e0b',
  concluida:       '#10b981',
  cancelada:       '#9ca3af',
}

const STATUS_LABEL: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Em atraso',
  datas_definidas: 'Agendada',
  em_andamento:    'Em andamento',
  concluida:       'Concluída',
  cancelada:       'Cancelada',
}

const ETAPAS_FILTRO: { value: StatusKanbanObra | ''; label: string }[] = [
  { value: '', label: 'Todas as etapas' },
  { value: 'datas_em_aberto', label: 'Em aberto' },
  { value: 'datas_em_atraso', label: 'Em atraso' },
  { value: 'datas_definidas', label: 'Agendada' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
]

const WEEKDAYS      = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MONTHS        = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const MONTHS_FULL   = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const BLANK_OBRA: ObraInput = {
  cliente_nome: '', cliente_id: null, lousa: null, endereco_obra: null,
  tipo_obra_id: null, grupo_obra_id: null, montador_admin_id: null, montador_id: null,
  data_prevista_inicio: null, data_prevista_fim: null, tempo_maximo_horas: null,
  status_kanban: 'datas_em_aberto',
}

// ── Helpers de data ──────────────────────────────────────────
function startOfWeek(d: Date): Date {
  const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d); r.setMonth(r.getMonth() + n); return r
}
function toISO(d: Date): string { return d.toISOString().slice(0, 10) }
function fmtDayHeader(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}/${MONTHS[d.getMonth()]}`
}
function getMonthGrid(d: Date): Date[] {
  const year = d.getFullYear(), month = d.getMonth()
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const days: Date[] = []
  for (let i = first.getDay(); i > 0; i--)  days.push(new Date(year, month, 1 - i))
  for (let i = 1; i <= last.getDate(); i++)  days.push(new Date(year, month, i))
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++)       days.push(new Date(year, month + 1, i))
  return days
}
const MOBILE_VIEW_MQ = '(max-width: 768px)'

function isMobileCalendario(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_VIEW_MQ).matches
}

function getInitialView(): CalView {
  return isMobileCalendario() ? 'day' : 'week'
}
function obrasForDay(obras: ObraFull[], iso: string): ObraFull[] {
  return obras.filter(o =>
    o.data_prevista_inicio !== null &&
    o.data_prevista_fim    !== null &&
    iso >= o.data_prevista_inicio &&
    iso <= o.data_prevista_fim
  )
}

function hasFiltrosAtivos(busca: string, etapa: StatusKanbanObra | '', data: string): boolean {
  return Boolean(busca.trim() || etapa || data)
}

function podeConcluirObra(obra: ObraFull): boolean {
  return (
    obra.status_kanban !== 'concluida' &&
    obra.status_kanban !== 'cancelada' &&
    !obra.finalizado_em
  )
}

// ── Popup do dia ─────────────────────────────────────────────
function DayPopup({
  date, obras, onClose, onObraClick, onConcluir, canConcluir, actioning,
}: {
  date: Date
  obras: ObraFull[]
  onClose: () => void
  onObraClick: (o: ObraFull) => void
  onConcluir: (id: string) => void
  canConcluir: boolean
  actioning: string | null
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="glass-panel rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(212,168,83,0.18)]">
          <div>
            <p className="font-display text-lg text-[#d4a853] tracking-widest">
              {WEEKDAYS_LONG[date.getDay()]}, {date.getDate()} de {MONTHS_FULL[date.getMonth()]}
            </p>
            <p className="text-xs text-[#8a6a55]">{obras.length} obra{obras.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="btn btn-outline btn-sm !px-2">
            <X size={15} />
          </button>
        </div>

        {/* Lista de obras */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {obras.length === 0 ? (
            <p className="text-center text-sm text-[#8a6a55] py-6">Nenhuma obra neste dia.</p>
          ) : (
            obras.map(o => {
              const cor = STATUS_COLORS[o.status_kanban]
              const loading = actioning === o.id
              return (
                <div
                  key={o.id}
                  className="rounded-lg overflow-hidden transition-all hover:brightness-110"
                  style={{
                    backgroundColor: `${cor}14`,
                    border: `1px solid ${cor}33`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onObraClick(o)}
                    className="w-full text-left p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-cream text-sm leading-tight truncate">
                          {o.cliente_nome}
                        </p>
                        {o.tipo_obra_nome && (
                          <p className="text-xs text-[#8a6a55] mt-0.5">{o.tipo_obra_nome}</p>
                        )}
                        <ObraMontadorBadge obra={o} compact />
                        {o.endereco_obra && (
                          <p className="text-xs text-[#8a6a55] truncate">{o.endereco_obra}</p>
                        )}
                        {(o.data_prevista_inicio || o.data_prevista_fim) && (
                          <p className="text-xs text-[#8a6a55] mt-0.5">
                            {o.data_prevista_inicio ? fmtDate(o.data_prevista_inicio) : '?'}
                            {' → '}
                            {o.data_prevista_fim ? fmtDate(o.data_prevista_fim) : '?'}
                          </p>
                        )}
                        <ObraTempoBar obra={o} />
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase"
                        style={{ backgroundColor: `${cor}22`, color: cor }}
                      >
                        {STATUS_LABEL[o.status_kanban]}
                      </span>
                    </div>
                  </button>

                  {canConcluir && podeConcluirObra(o) && (
                    <div className="px-3 pb-3 pt-0">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => onConcluir(o.id)}
                        className="w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/35 transition-colors disabled:opacity-50"
                      >
                        {loading
                          ? <Loader2 size={12} className="animate-spin" />
                          : <CheckCircle size={12} />
                        }
                        Marcar como Concluída
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Página ───────────────────────────────────────────────────
export function CalendarioObras() {
  const { role } = useApp()
  const obrasHook  = useObras()
  const tiposHook  = useTiposObra()
  const gruposHook = useGruposObra()

  const isAdmin        = role === 'Administrador'
  const isMontadorAdmin = role === 'MontadorAdmin'
  const isMontador      = role === 'Montador'
  const canEdit = isAdmin || isMontadorAdmin
  const canEditMontador = canEdit

  const [view, setView]               = useState<CalView>(() => getInitialView())
  const [viewDate, setViewDate]       = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [detalheObra, setDetalheObra]     = useState<ObraFull | null>(null)
  const [editObra, setEditObra]           = useState<ObraFull | null>(null)
  const [obraForm, setObraForm]           = useState<ObraInput>(BLANK_OBRA)
  const [savingObra, setSavingObra]       = useState(false)
  const [actioning, setActioning]         = useState<string | null>(null)
  const [busca, setBusca]                 = useState('')
  const [etapaFiltro, setEtapaFiltro]     = useState<StatusKanbanObra | ''>('')
  const [dataFiltro, setDataFiltro]       = useState('')

  // No celular, sempre abrir na visão "Dia" (mais legível em telas pequenas)
  useEffect(() => {
    if (isMobileCalendario()) setView('day')
  }, [])

  const obrasFiltradas = useMemo(
    () => filtrarObrasCalendario(obrasHook.data, {
      busca,
      etapa: etapaFiltro,
      data: dataFiltro,
    }),
    [obrasHook.data, busca, etapaFiltro, dataFiltro],
  )

  useEffect(() => {
    if (!dataFiltro) return
    const d = new Date(`${dataFiltro}T12:00:00`)
    if (Number.isNaN(d.getTime())) return
    setViewDate(d)
  }, [dataFiltro])

  const todayISO      = toISO(new Date())
  const filtrosAtivos = hasFiltrosAtivos(busca, etapaFiltro, dataFiltro)

  const weekDays = useMemo(() => {
    const ws = startOfWeek(viewDate)
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  }, [viewDate])

  const monthGrid = useMemo(() => getMonthGrid(viewDate), [viewDate])

  const rangeLabel = useMemo(() => {
    if (view === 'day') {
      const d = viewDate
      return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`
    }
    if (view === 'week') {
      const ws = weekDays[0], we = weekDays[6]
      if (ws.getMonth() === we.getMonth())
        return `${ws.getDate()} – ${we.getDate()} de ${MONTHS_FULL[ws.getMonth()]} ${ws.getFullYear()}`
      return `${ws.getDate()}/${MONTHS[ws.getMonth()]} – ${we.getDate()}/${MONTHS[we.getMonth()]} ${we.getFullYear()}`
    }
    return `${MONTHS_FULL[viewDate.getMonth()]} ${viewDate.getFullYear()}`
  }, [view, viewDate, weekDays])

  function navigate(dir: -1 | 1) {
    if (view === 'day')       setViewDate(d => addDays(d, dir))
    else if (view === 'week') setViewDate(d => addDays(d, dir * 7))
    else                      setViewDate(d => addMonths(d, dir))
  }

  const dayViewObras = obrasForDay(obrasFiltradas, toISO(viewDate))

  const limparFiltros = () => {
    setBusca('')
    setEtapaFiltro('')
    setDataFiltro('')
  }

  // ── Handlers de obra ──────────────────────────────────────
  const openEdit = (obra: ObraFull) => {
    setDetalheObra(null)
    setTimeout(() => {
      setEditObra(obra)
      setObraForm({
        cliente_nome: obra.cliente_nome,
        cliente_id: obra.cliente_id ?? null,
        lousa: obra.lousa ?? null,
        endereco_obra: obra.endereco_obra ?? null,
        tipo_obra_id: obra.tipo_obra_id ?? null,
        grupo_obra_id: obra.grupo_obra_id ?? null,
        montador_admin_id: obra.montador_admin_id ?? null,
        montador_id: obra.montador_id ?? null,
        data_prevista_inicio: obra.data_prevista_inicio ?? null,
        data_prevista_fim: obra.data_prevista_fim ?? null,
        tempo_maximo_horas: obra.tempo_maximo_horas ?? null,
        status_kanban: obra.status_kanban,
      })
    }, 80)
  }

  const handleObraChange = (k: keyof ObraInput, v: string | null | number) => {
    setObraForm(p => {
      const next = { ...p, [k]: v }
      if (k === 'tipo_obra_id' && v) {
        const tipo = tiposHook.data.find(t => t.id === v)
        if (tipo?.tempo_maximo_horas_default != null)
          next.tempo_maximo_horas = Number(tipo.tempo_maximo_horas_default)
      }
      return next
    })
  }

  const saveObra = async () => {
    if (!obraForm.cliente_nome.trim() || !editObra) return
    setSavingObra(true)
    try {
      await obrasHook.update(editObra.id, obraForm)
      setEditObra(null)
    } finally { setSavingObra(false) }
  }

  const handleIniciar = async (id: string) => {
    setActioning(id)
    try { await obrasHook.iniciarObra(id) } finally { setActioning(null) }
  }
  const handleConcluir = async (id: string) => {
    setActioning(id)
    try {
      await obrasHook.concluirObra(id)
      setDetalheObra(null)
    } finally { setActioning(null) }
  }

  const handleExcluir = async (obra: ObraFull) => {
    const nome = obra.cliente_nome.trim() || 'esta obra'
    if (!confirm(`Excluir a obra de "${nome}"? Essa ação não pode ser desfeita.`)) return

    setActioning(obra.id)
    try {
      await obrasHook.remove(obra.id)
      setDetalheObra(null)
      setEditObra(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível excluir a obra.')
    } finally {
      setActioning(null)
    }
  }

  const canConcluir = canEdit || isMontador

  return (
    <div className="fade-in">
      {/* Cabeçalho */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>
              Calendário de Obras
            </h1>
            <p className="section-label mt-1">
              {obrasFiltradas.length} de {obrasHook.data.length} obra{obrasHook.data.length !== 1 ? 's' : ''}
              {filtrosAtivos && <span className="ml-1 text-[#d4a853]">· filtrado</span>}
            </p>
          </div>

          {/* Seletor de visão */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl"
            style={{ backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(212,168,83,0.15)' }}
          >
            {(['day', 'week', 'month'] as CalView[]).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={view === v ? {
                  backgroundColor: 'rgba(212,168,83,0.2)',
                  color: '#d4a853',
                  border: '1px solid rgba(212,168,83,0.3)',
                } : { color: '#8a6a55' }}
              >
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
        </div>

        {/* Navegação */}
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewDate(new Date())}>
            Hoje
          </button>
          <div className="flex items-center gap-1">
            <button type="button" className="btn btn-outline btn-sm p-2" onClick={() => navigate(-1)}>
              <ChevronLeft size={15} />
            </button>
            <span
              className="text-sm text-[#d4a853] font-semibold px-2 text-center"
              style={{ minWidth: view === 'day' ? '240px' : '200px' }}
            >
              {rangeLabel}
            </span>
            <button type="button" className="btn btn-outline btn-sm p-2" onClick={() => navigate(1)}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div
        className="glass-card p-4 mb-5 flex flex-wrap items-end gap-3"
        style={{ borderColor: filtrosAtivos ? 'rgba(212,168,83,0.35)' : undefined }}
      >
        <div className="flex items-center gap-2 text-[#8a6a55] shrink-0 pb-2">
          <Filter size={14} className="text-[#d4a853]" />
          <span className="text-xs font-semibold uppercase tracking-wider">Filtros</span>
        </div>

        <div className="relative flex-1 min-w-[200px]" style={{ maxWidth: 320 }}>
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a6a55] pointer-events-none"
          />
          <input
            className="glass-input pl-9 pr-8 w-full"
            placeholder="Buscar por nome, montador, endereço..."
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

        <div className="min-w-[160px]" style={{ maxWidth: 200 }}>
          <label className="block text-[0.62rem] uppercase tracking-wider text-[#8a6a55] mb-1">
            Etapa
          </label>
          <select
            className="glass-input w-full"
            value={etapaFiltro}
            onChange={e => setEtapaFiltro(e.target.value as StatusKanbanObra | '')}
          >
            {ETAPAS_FILTRO.map(op => (
              <option key={op.value || 'todas'} value={op.value}>{op.label}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[150px]" style={{ maxWidth: 180 }}>
          <label className="block text-[0.62rem] uppercase tracking-wider text-[#8a6a55] mb-1">
            Data
          </label>
          <input
            type="date"
            className="glass-input w-full"
            value={dataFiltro}
            onChange={e => setDataFiltro(e.target.value)}
          />
        </div>

        {filtrosAtivos && (
          <button
            type="button"
            onClick={limparFiltros}
            className="btn btn-outline btn-sm flex items-center gap-1.5 mb-0.5"
          >
            <X size={12} />
            Limpar
          </button>
        )}
      </div>

      {obrasHook.loading && <LoadingState />}
      {!obrasHook.loading && obrasHook.error && <ErrorState message={obrasHook.error} />}

      {!obrasHook.loading && !obrasHook.error && (
        <>
          {/* ════════════ VISÃO DIA ════════════ */}
          {view === 'day' && (
            <div className="space-y-3">
              {dayViewObras.length === 0 ? (
                <div className="glass-card p-10 text-center">
                  <CalendarDays size={36} className="mx-auto mb-3" style={{ color: '#d4a853', opacity: 0.25 }} />
                  <p className="text-[#8a6a55] text-sm">Nenhuma obra para este dia.</p>
                </div>
              ) : dayViewObras.map(o => {
                const cor = STATUS_COLORS[o.status_kanban]
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setDetalheObra(o)}
                    className="w-full text-left glass-card p-4 hover:brightness-110 transition-all"
                    style={{ borderLeft: `3px solid ${cor}` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-cream leading-tight">{o.cliente_nome}</p>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase"
                            style={{ backgroundColor: `${cor}22`, color: cor }}
                          >
                            {STATUS_LABEL[o.status_kanban]}
                          </span>
                          <ObraMontadorBadge obra={o} />
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#8a6a55]">
                          {o.tipo_obra_nome  && <span>{o.tipo_obra_nome}</span>}
                          {o.grupo_obra_nome && <span>Grupo: {o.grupo_obra_nome}</span>}
                          {o.endereco_obra   && <span className="truncate max-w-[220px]">{o.endereco_obra}</span>}
                        </div>
                        {(o.data_prevista_inicio || o.data_prevista_fim) && (
                          <p className="text-xs text-[#8a6a55] mt-1.5">
                            {o.data_prevista_inicio ? fmtDate(o.data_prevista_inicio) : '?'}
                            {' → '}
                            {o.data_prevista_fim ? fmtDate(o.data_prevista_fim) : '?'}
                          </p>
                        )}
                        <ObraTempoBar obra={o} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* ════════════ VISÃO SEMANA ════════════ */}
          {view === 'week' && (
            <div className="overflow-x-auto -mx-1">
              <div
                className="grid gap-2 px-1"
                style={{ gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))' }}
              >
                {weekDays.map(day => {
                  const iso          = toISO(day)
                  const isToday      = iso === todayISO
                  const isDataFiltro = dataFiltro === iso
                  const dayObras     = obrasForDay(obrasFiltradas, iso)
                  const hasObras     = dayObras.length > 0

                  return (
                    <div
                      key={iso}
                      onClick={() => hasObras && setSelectedDay(day)}
                      className={[
                        'glass-card p-2 flex flex-col min-h-[200px] transition-all',
                        isToday      ? 'ring-1 ring-[#d4a853]/40' : '',
                        isDataFiltro ? 'ring-1 ring-[#3b82f6]/50' : '',
                        hasObras     ? 'cursor-pointer hover:brightness-110' : '',
                      ].join(' ')}
                    >
                      <div className={`text-[0.72rem] font-bold mb-2 pb-1.5 border-b border-[rgba(212,168,83,0.12)] flex items-center justify-between ${isToday ? 'text-[#d4a853]' : 'text-[#8a6a55]'}`}>
                        <span>
                          {fmtDayHeader(day)}
                          {isToday && <span className="ml-1 text-[0.6rem] bg-[#d4a853]/20 text-[#d4a853] rounded px-1">hoje</span>}
                        </span>
                        {hasObras && (
                          <span className="rounded-full w-4 h-4 flex items-center justify-center text-[0.6rem] font-bold bg-[rgba(212,168,83,0.2)] text-[#d4a853]">
                            {dayObras.length}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        {dayObras.length === 0 ? (
                          <p className="text-[0.62rem] text-[#4a3328] mt-2 text-center">—</p>
                        ) : (
                          dayObras.slice(0, 2).map(o => (
                            <div
                              key={o.id}
                              className="rounded p-1.5 text-[0.62rem]"
                              style={{
                                backgroundColor: `${STATUS_COLORS[o.status_kanban]}18`,
                                borderLeft: `2px solid ${STATUS_COLORS[o.status_kanban]}`,
                              }}
                            >
                              <p className="font-semibold text-cream leading-tight truncate">{o.cliente_nome}</p>
                              <ObraMontadorBadge obra={o} compact />
                              <ObraTempoBar obra={o} compact />
                            </div>
                          ))
                        )}
                        {dayObras.length > 2 && (
                          <p className="text-[0.62rem] text-[#d4a853] text-center">+{dayObras.length - 2} mais</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ════════════ VISÃO MÊS ════════════ */}
          {view === 'month' && (
            <div className="overflow-x-auto -mx-1">
              <div className="px-1" style={{ minWidth: '420px' }}>
                {/* Cabeçalhos dias da semana */}
                <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                  {WEEKDAYS.map(wd => (
                    <div key={wd} className="text-center text-[0.65rem] font-bold text-[#8a6a55] py-1 uppercase tracking-widest">
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Grade do mês */}
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                  {monthGrid.map((day, idx) => {
                    const iso          = toISO(day)
                    const isToday      = iso === todayISO
                    const isDataFiltro = dataFiltro === iso
                    const isThisMonth  = day.getMonth() === viewDate.getMonth()
                    const dayObras     = obrasForDay(obrasFiltradas, iso)
                    const hasObras     = dayObras.length > 0

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (!isThisMonth) { setViewDate(day); return }
                          if (hasObras) setSelectedDay(day)
                        }}
                        className={[
                          'rounded-lg p-1.5 flex flex-col transition-all',
                          isThisMonth  ? 'glass-card' : 'opacity-30',
                          isToday      ? 'ring-1 ring-[#d4a853]/50' : '',
                          isDataFiltro ? 'ring-1 ring-[#3b82f6]/50' : '',
                          (hasObras || !isThisMonth) ? 'cursor-pointer hover:brightness-110' : '',
                        ].join(' ')}
                        style={{ minHeight: '64px' }}
                      >
                        <span className={[
                          'text-[0.7rem] font-bold self-start w-5 h-5 flex items-center justify-center rounded-full mb-1',
                          isToday
                            ? 'bg-[#d4a853] text-[#1a0f0a]'
                            : isThisMonth ? 'text-[#a08040]' : 'text-[#4a3328]',
                        ].join(' ')}>
                          {day.getDate()}
                        </span>
                        <div className="flex flex-wrap gap-0.5">
                          {dayObras.slice(0, 4).map((o, i) => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: STATUS_COLORS[o.status_kanban] }}
                            />
                          ))}
                          {dayObras.length > 4 && (
                            <span className="text-[0.55rem] text-[#d4a853] font-bold leading-none self-center">
                              +{dayObras.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Legenda */}
          <div className="mt-6 flex flex-wrap gap-3">
            {Object.entries(STATUS_COLORS).map(([key, cor]) => (
              <div key={key} className="flex items-center gap-1.5 text-[0.7rem] text-[#8a6a55]">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} />
                {STATUS_LABEL[key as StatusKanbanObra]}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Popup do dia selecionado (semana / mês) */}
      {selectedDay && !detalheObra && !editObra && (
        <DayPopup
          date={selectedDay}
          obras={obrasForDay(obrasFiltradas, toISO(selectedDay))}
          onClose={() => setSelectedDay(null)}
          onObraClick={o => { setSelectedDay(null); setDetalheObra(o) }}
          onConcluir={handleConcluir}
          canConcluir={canConcluir}
          actioning={actioning}
        />
      )}

      {/* Modal detalhe da obra */}
      <ObraDetalheModal
        open={!!detalheObra}
        obra={detalheObra}
        canEdit={canEdit}
        canUpload={canEdit}
        isMontador={isMontador}
        actioning={actioning}
        onClose={() => { setDetalheObra(null) }}
        onEdit={openEdit}
        onIniciar={handleIniciar}
        onConcluir={handleConcluir}
        canDelete={isAdmin}
        onExcluir={handleExcluir}
      />

      {/* Modal edição */}
      {canEdit && (
        <ObraFormModal
          open={!!editObra}
          obra={editObra}
          form={obraForm}
          onChange={handleObraChange}
          onClose={() => setEditObra(null)}
          onSave={saveObra}
          saving={savingObra}
          tipos={tiposHook.data}
          grupos={gruposHook.data}
          montadores={gruposHook.montadores}
          canEditDates
          canEditMontador={canEditMontador}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
