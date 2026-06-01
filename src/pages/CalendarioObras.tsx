import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useObras } from '../hooks/useObras'
import { useTiposObra } from '../hooks/useTiposObra'
import { useGruposObra } from '../hooks/useGruposObra'
import { useApp } from '../context/AppContext'
import { ObraDetalheModal } from '../components/obras/ObraDetalheModal'
import { ObraFormModal } from '../components/obras/ObraFormModal'
import { LoadingState, ErrorState } from '../components/ui/EmptyState'
import { fmtDate } from '../lib/utils'
import type { ObraFull, ObraInput, StatusKanbanObra } from '../types'

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

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS   = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

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
function toISO(d: Date): string { return d.toISOString().slice(0, 10) }
function fmtDayHeader(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}/${MONTHS[d.getMonth()]}`
}
function obrasForDay(obras: ObraFull[], iso: string): ObraFull[] {
  return obras.filter(o => {
    const s = o.data_prevista_inicio ?? iso
    const e = o.data_prevista_fim   ?? iso
    return iso >= s && iso <= e
  })
}

// ── Popup do dia ─────────────────────────────────────────────
function DayPopup({
  date, obras, onClose, onObraClick,
}: {
  date: Date
  obras: ObraFull[]
  onClose: () => void
  onObraClick: (o: ObraFull) => void
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
              {fmtDayHeader(date)}
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
              return (
                <button
                  key={o.id}
                  onClick={() => onObraClick(o)}
                  className="w-full text-left rounded-lg p-3 transition-all hover:brightness-110"
                  style={{
                    backgroundColor: `${cor}14`,
                    border: `1px solid ${cor}33`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-cream text-sm leading-tight truncate">
                        {o.cliente_nome}
                      </p>
                      {o.tipo_obra_nome && (
                        <p className="text-xs text-[#8a6a55] mt-0.5">{o.tipo_obra_nome}</p>
                      )}
                      {o.montador_nome && (
                        <p className="text-xs text-[#8a6a55]">Montador: {o.montador_nome}</p>
                      )}
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
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase"
                      style={{ backgroundColor: `${cor}22`, color: cor }}
                    >
                      {STATUS_LABEL[o.status_kanban]}
                    </span>
                  </div>
                </button>
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

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [selectedDay, setSelectedDay]     = useState<Date | null>(null)
  const [detalheObra, setDetalheObra]     = useState<ObraFull | null>(null)
  const [editObra, setEditObra]           = useState<ObraFull | null>(null)
  const [obraForm, setObraForm]           = useState<ObraInput>(BLANK_OBRA)
  const [savingObra, setSavingObra]       = useState(false)
  const [actioning, setActioning]         = useState<string | null>(null)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const todayISO   = toISO(new Date())
  const weekLabel  = `${days[0].getDate()}/${MONTHS[days[0].getMonth()]} — ${days[6].getDate()}/${MONTHS[days[6].getMonth()]} ${days[6].getFullYear()}`

  const selectedISO    = selectedDay ? toISO(selectedDay) : null
  const selectedObras  = selectedISO ? obrasForDay(obrasHook.data, selectedISO) : []

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
  const handleFinalizar = async (id: string) => {
    setActioning(id)
    try { await obrasHook.finalizarObra(id) } finally { setActioning(null) }
  }

  return (
    <div className="fade-in">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>
            Calendário de Obras
          </h1>
          <p className="section-label mt-1">Clique em um dia para ver as obras</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-outline btn-md" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hoje</button>
          <button type="button" className="btn btn-outline btn-md p-2" onClick={() => setWeekStart(d => addDays(d, -7))}><ChevronLeft size={16} /></button>
          <span className="text-sm text-[#d4a853] font-semibold min-w-[190px] text-center">{weekLabel}</span>
          <button type="button" className="btn btn-outline btn-md p-2" onClick={() => setWeekStart(d => addDays(d, 7))}><ChevronRight size={16} /></button>
        </div>
      </div>

      {obrasHook.loading && <LoadingState />}
      {!obrasHook.loading && obrasHook.error && <ErrorState message={obrasHook.error} />}

      {!obrasHook.loading && !obrasHook.error && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {days.map(day => {
            const iso      = toISO(day)
            const isToday  = iso === todayISO
            const dayObras = obrasForDay(obrasHook.data, iso)
            const hasObras = dayObras.length > 0

            return (
              <div
                key={iso}
                onClick={() => hasObras && setSelectedDay(day)}
                className={[
                  'glass-card p-2 flex flex-col min-h-[180px] transition-all',
                  isToday ? 'ring-1 ring-[#d4a853]/40' : '',
                  hasObras ? 'cursor-pointer hover:brightness-110' : '',
                ].join(' ')}
              >
                {/* Header do dia */}
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

                {/* Preview das obras */}
                <div className="flex flex-col gap-1 flex-1">
                  {dayObras.length === 0 ? (
                    <p className="text-[0.62rem] text-[#4a3328] mt-2 text-center">—</p>
                  ) : (
                    dayObras.slice(0, 3).map(o => (
                      <div
                        key={o.id}
                        className="rounded p-1 text-[0.62rem]"
                        style={{
                          backgroundColor: `${STATUS_COLORS[o.status_kanban]}18`,
                          borderLeft: `2px solid ${STATUS_COLORS[o.status_kanban]}`,
                        }}
                      >
                        <p className="font-semibold text-cream leading-tight truncate">{o.cliente_nome}</p>
                        {o.montador_nome && <p className="text-[#8a6a55] truncate">{o.montador_nome}</p>}
                      </div>
                    ))
                  )}
                  {dayObras.length > 3 && (
                    <p className="text-[0.62rem] text-[#d4a853] text-center">+{dayObras.length - 3} mais</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legenda */}
      {!obrasHook.loading && !obrasHook.error && (
        <div className="mt-6 flex flex-wrap gap-3">
          {Object.entries(STATUS_COLORS).map(([key, cor]) => (
            <div key={key} className="flex items-center gap-1.5 text-[0.7rem] text-[#8a6a55]">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cor }} />
              {STATUS_LABEL[key as StatusKanbanObra]}
            </div>
          ))}
        </div>
      )}

      {/* Popup do dia selecionado */}
      {selectedDay && !detalheObra && !editObra && (
        <DayPopup
          date={selectedDay}
          obras={selectedObras}
          onClose={() => setSelectedDay(null)}
          onObraClick={o => { setDetalheObra(o) }}
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
        onFinalizar={handleFinalizar}
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
          canEditMontador
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}
