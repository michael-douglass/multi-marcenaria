import { useState, useMemo } from 'react'
import { Settings, Plus, X, Pencil, Play, CheckCircle, Loader2, Search } from 'lucide-react'
import { useObras } from '../hooks/useObras'
import { useTiposObra } from '../hooks/useTiposObra'
import { useGruposObra } from '../hooks/useGruposObra'
import { useApp } from '../context/AppContext'
import { Modal } from '../components/ui/Modal'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Field } from '../components/ui/Field'
import { LoadingState, ErrorState } from '../components/ui/EmptyState'
import type {
  ObraFull, ObraInput, StatusKanbanObra,
  TipoObraInput, GrupoObraInput, TipoObra, GrupoObra,
} from '../types'
import { fmtDate } from '../lib/utils'

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

// ── Blank forms ──────────────────────────────────────────────
const BLANK_OBRA: ObraInput = {
  cliente_nome: '', cliente_id: null, lousa: null, endereco_obra: null,
  tipo_obra_id: null, grupo_obra_id: null, montador_admin_id: null, montador_id: null,
  data_prevista_inicio: null, data_prevista_fim: null, tempo_maximo_horas: null,
  status_kanban: 'datas_em_aberto',
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
    obra.status_kanban === 'datas_definidas' &&
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

// ── ObraCard ─────────────────────────────────────────────────
interface ObraCardProps {
  obra: ObraFull
  canEdit: boolean
  isMontador: boolean
  actioning: string | null
  onEdit: (obra: ObraFull) => void
  onIniciar: (id: string) => void
  onFinalizar: (id: string) => void
}

function ObraCard({ obra, canEdit, isMontador, actioning, onEdit, onIniciar, onFinalizar }: ObraCardProps) {
  const loading = actioning === obra.id
  const computedCol = computeKanbanKey(obra)
  const colDef = COLUNAS.find(c => c.key === computedCol)

  return (
    <div
      className="glass-card p-3 text-sm flex flex-col gap-1.5"
      style={{ minWidth: 0 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-1">
        <div>
          <p className="font-semibold text-[#d4a853] leading-tight truncate max-w-[160px]">{obra.cliente_nome}</p>
          {obra.lousa && (
            <p className="text-[0.7rem] text-[#8a6a55] truncate max-w-[160px]">{obra.lousa}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className="rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide"
            style={{ backgroundColor: `${colDef?.cor}22`, color: colDef?.cor, border: `1px solid ${colDef?.cor}44` }}
          >
            {STATUS_LABELS[obra.status_kanban]}
          </span>
          {canEdit && (
            <button
              onClick={() => onEdit(obra)}
              className="p-1 rounded text-[#8a6a55] hover:text-[#d4a853] transition-colors"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Campos informativos */}
      <div className="space-y-0.5 text-[0.72rem] text-[#8a6a55]">
        {obra.tipo_obra_nome && <p>Tipo: <span className="text-cream">{obra.tipo_obra_nome}</span></p>}
        {obra.grupo_obra_nome && <p>Grupo: <span className="text-cream">{obra.grupo_obra_nome}</span></p>}
        {obra.endereco_obra && <p>End.: <span className="text-cream">{obra.endereco_obra}</span></p>}
        {obra.montador_nome && <p>Montador: <span className="text-cream">{obra.montador_nome}</span></p>}
        {obra.montador_admin_nome && <p>Admin: <span className="text-cream">{obra.montador_admin_nome}</span></p>}
        {(obra.data_prevista_inicio || obra.data_prevista_fim) && (
          <p>
            Datas:{' '}
            <span className="text-cream">
              {obra.data_prevista_inicio ? fmtDate(obra.data_prevista_inicio) : '?'}
              {' → '}
              {obra.data_prevista_fim ? fmtDate(obra.data_prevista_fim) : '?'}
            </span>
          </p>
        )}
        {obra.tempo_maximo_horas != null && (
          <p>Prazo máx.: <span className="text-cream">{Number(obra.tempo_maximo_horas)}h</span></p>
        )}
        {duracao(obra) && (
          <p>Duração real: <span className="text-cream">{duracao(obra)}</span></p>
        )}
        {obra.concluido_em_atraso && (
          <p className="text-red-400 font-semibold">Concluída em atraso</p>
        )}
      </div>

      {/* Ações do montador */}
      {isMontador && (
        <div className="mt-1 flex gap-1.5">
          {!obra.iniciado_em && (
            <button
              disabled={loading}
              onClick={() => onIniciar(obra.id)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[0.7rem] font-semibold bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
              Iniciar
            </button>
          )}
          {obra.iniciado_em && !obra.finalizado_em && (
            <button
              disabled={loading}
              onClick={() => onFinalizar(obra.id)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[0.7rem] font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
              Finalizar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal Obra (criar / editar) ──────────────────────────────
interface ObraModalProps {
  open: boolean
  obra: ObraFull | null
  form: ObraInput
  onChange: (k: keyof ObraInput, v: string | null | number) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
  tipos: { id: string; nome: string }[]
  grupos: { id: string; nome: string }[]
  montadores: { id: string; nome?: string | null; email: string }[]
  canEditDates: boolean
  canEditMontador: boolean
  isAdmin: boolean
}

function ObraModal({
  open, obra, form, onChange, onClose, onSave, saving,
  tipos, grupos, montadores, canEditDates, canEditMontador, isAdmin,
}: ObraModalProps) {
  const s = (k: keyof ObraInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange(k, e.target.value || null)

  return (
    <Modal open={open} onClose={onClose} title={obra ? 'EDITAR OBRA' : 'NOVA OBRA'}>
      <Field label="Cliente *">
        <input className="glass-input" value={form.cliente_nome} onChange={s('cliente_nome')} placeholder="Nome do cliente" />
      </Field>
      <Field label="Lousa">
        <input className="glass-input" value={form.lousa ?? ''} onChange={s('lousa')} placeholder="Descrição / lousa" />
      </Field>
      <Field label="Endereço da Obra">
        <input className="glass-input" value={form.endereco_obra ?? ''} onChange={s('endereco_obra')} placeholder="Rua, número, bairro..." />
      </Field>

      {isAdmin && (
        <>
          <Field label="Tipo de Obra">
            <select className="glass-input" value={form.tipo_obra_id ?? ''} onChange={s('tipo_obra_id')}>
              <option value="">— Selecione —</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Field>
          <Field label="Grupo de Obra">
            <select className="glass-input" value={form.grupo_obra_id ?? ''} onChange={s('grupo_obra_id')}>
              <option value="">— Selecione —</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </Field>
        </>
      )}

      {canEditMontador && (
        <>
          <Field label="Montador Responsável">
            <select className="glass-input" value={form.montador_id ?? ''} onChange={s('montador_id')}>
              <option value="">— Nenhum —</option>
              {montadores.map(m => (
                <option key={m.id} value={m.id}>{m.nome ?? m.email}</option>
              ))}
            </select>
          </Field>
          <Field label="Montador Admin">
            <select className="glass-input" value={form.montador_admin_id ?? ''} onChange={s('montador_admin_id')}>
              <option value="">— Nenhum —</option>
              {montadores.map(m => (
                <option key={m.id} value={m.id}>{m.nome ?? m.email}</option>
              ))}
            </select>
          </Field>
        </>
      )}

      {canEditDates && (
        <>
          <Field label="Início Previsto">
            <input type="date" className="glass-input" value={form.data_prevista_inicio ?? ''} onChange={s('data_prevista_inicio')} />
          </Field>
          <Field label="Término Previsto">
            <input type="date" className="glass-input" value={form.data_prevista_fim ?? ''} onChange={s('data_prevista_fim')} />
          </Field>
          <Field label="Prazo Máximo (horas)">
            <input
              type="number" min={0} className="glass-input"
              value={form.tempo_maximo_horas ?? ''}
              onChange={e => onChange('tempo_maximo_horas', e.target.value ? Number(e.target.value) : null)}
              placeholder="Ex: 48"
            />
          </Field>
        </>
      )}

      {isAdmin && (
        <Field label="Status">
          <select className="glass-input" value={form.status_kanban ?? 'datas_em_aberto'} onChange={s('status_kanban')}>
            {COLUNAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Field>
      )}

      <ModalFormFooter onClose={onClose} onSave={onSave} saving={saving} label={obra ? 'Salvar' : 'Criar'} />
    </Modal>
  )
}

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
                  <p className="text-[0.7rem] text-[#8a6a55]">Médio: {t.tempo_medio_horas ?? '—'}h / Máx.: {t.tempo_maximo_horas_default ?? '—'}h</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setTipoEdit(t.id); setTipoForm({ nome: t.nome, descricao: t.descricao ?? null, tempo_medio_horas: t.tempo_medio_horas ?? null, tempo_maximo_horas_default: t.tempo_maximo_horas_default ?? null, ativo: t.ativo }) }} className="p-1 text-[#8a6a55] hover:text-[#d4a853]"><Pencil size={12} /></button>
                  <button onClick={() => tiposHook.remove(t.id)} className="p-1 text-[#8a6a55] hover:text-red-400"><X size={12} /></button>
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
                  <button onClick={() => { setGrupoEdit(g.id); setGrupoForm({ nome: g.nome, descricao: g.descricao ?? null, montador_admin_id: g.montador_admin_id ?? null, ativo: g.ativo }) }} className="p-1 text-[#8a6a55] hover:text-[#d4a853]"><Pencil size={12} /></button>
                  <button onClick={() => gruposHook.remove(g.id)} className="p-1 text-[#8a6a55] hover:text-red-400"><X size={12} /></button>
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
  const { role } = useApp()
  const obrasHook = useObras()
  const tiposHook = useTiposObra()
  const gruposHook = useGruposObra()

  const isAdmin = role === 'Administrador'
  const isMontadorAdmin = role === 'MontadorAdmin'
  const isMontador = role === 'Montador'
  const canEdit = isAdmin || isMontadorAdmin
  const canEditMontador = isAdmin || isMontadorAdmin
  const canEditDates = isAdmin || isMontadorAdmin

  const [obraOpen, setObraOpen] = useState(false)
  const [editObra, setEditObra] = useState<ObraFull | null>(null)
  const [obraForm, setObraForm] = useState<ObraInput>(BLANK_OBRA)
  const [savingObra, setSavingObra] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

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

  const obrasByCol = useMemo(() => {
    const map: Record<StatusKanbanObra, ObraFull[]> = {
      datas_em_aberto: [], datas_em_atraso: [],
      datas_definidas: [], em_andamento: [], concluida: [], cancelada: [],
    }
    for (const o of obrasFiltradas) {
      const col = computeKanbanKey(o)
      map[col].push(o)
    }
    return map
  }, [obrasFiltradas])

  const openNew = () => { setEditObra(null); setObraForm(BLANK_OBRA); setObraOpen(true) }
  const openEdit = (obra: ObraFull) => {
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
    setObraOpen(true)
  }

  const handleObraChange = (k: keyof ObraInput, v: string | null | number) => {
    setObraForm(p => {
      const next = { ...p, [k]: v }
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
      if (editObra) await obrasHook.update(editObra.id, obraForm)
      else await obrasHook.create(obraForm)
      setObraOpen(false)
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
    <div className="fade-in flex flex-col h-full">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>Agenda de Obras</h1>
          <p className="section-label mt-1">
            {obrasFiltradas.length} de {obrasHook.data.length} obra{obrasHook.data.length !== 1 ? 's' : ''}
            {busca && <span className="ml-1 text-[#d4a853]">· filtrado</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button type="button" className="btn btn-outline btn-md flex items-center gap-1.5" onClick={() => setConfigOpen(true)}>
              <Settings size={14} /> Configurações
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn btn-gold btn-md flex items-center gap-1.5" onClick={openNew}>
              <Plus size={14} /> Nova Obra
            </button>
          )}
        </div>
      </div>

      {/* Busca */}
      <div className="relative mb-5" style={{ maxWidth: 400 }}>
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a6a55] pointer-events-none"
        />
        <input
          className="glass-input pl-9 pr-8 w-full"
          placeholder="Buscar por cliente, montador, endereço, tipo..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a6a55] hover:text-[#d4a853] transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Estados de carregamento/erro */}
      {obrasHook.loading && <LoadingState />}
      {!obrasHook.loading && obrasHook.error && <ErrorState message={obrasHook.error} />}

      {/* Kanban */}
      {!obrasHook.loading && !obrasHook.error && (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ flex: 1, minHeight: 0 }}>
          {COLUNAS.map(col => {
            const obras = obrasByCol[col.key]
            return (
              <div
                key={col.key}
                className="flex flex-col gap-2 shrink-0"
                style={{ width: 240, minWidth: 240 }}
              >
                {/* Cabeçalho da coluna */}
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ backgroundColor: `${col.cor}18`, border: `1px solid ${col.cor}33` }}
                >
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: col.cor }}>
                    {col.label}
                  </span>
                  <span
                    className="rounded-full w-5 h-5 flex items-center justify-center text-[0.65rem] font-bold"
                    style={{ backgroundColor: `${col.cor}33`, color: col.cor }}
                  >
                    {obras.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 overflow-y-auto" style={{ flex: 1 }}>
                  {obras.length === 0 ? (
                    <div className="text-center py-8 text-[0.75rem] text-[#6b5544]">Nenhuma obra</div>
                  ) : (
                    obras.map(obra => (
                      <ObraCard
                        key={obra.id}
                        obra={obra}
                        canEdit={canEdit}
                        isMontador={isMontador}
                        actioning={actioning}
                        onEdit={openEdit}
                        onIniciar={handleIniciar}
                        onFinalizar={handleFinalizar}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal obra */}
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
        isAdmin={isAdmin || isMontadorAdmin}
      />

      {/* Modal configurações */}
      {isAdmin && (
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
