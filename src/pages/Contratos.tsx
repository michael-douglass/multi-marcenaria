import { useState } from 'react'
import { FileText } from 'lucide-react'
import { useContratos } from '../hooks/useContratos'
import { Modal } from '../components/ui/Modal'
import { Field, FieldRow } from '../components/ui/Field'
import { ModalFormFooter } from '../components/ui/ModalFormFooter'
import { Badge } from '../components/ui/Badge'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/EmptyState'
import { fmtDate, fmtCur } from '../lib/utils'
import type { ContratoCRM, ContratoCRMDetalhe, ContratoCRMStatus, ContratoVariavel } from '../types'

type FilterStatus = 'todos' | ContratoCRMStatus

const STATUS_LABEL: Record<ContratoCRMStatus, string> = {
  rascunho: 'Rascunho',
  gerado: 'Gerado',
  enviado: 'Enviado',
  assinado: 'Assinado',
  cancelado: 'Cancelado',
}

const STATUS_COLOR: Record<ContratoCRMStatus, string> = {
  rascunho: 'rgba(156,163,175,0.9)',
  gerado: 'rgba(96,165,250,0.9)',
  enviado: 'rgba(251,191,36,0.9)',
  assinado: 'rgba(74,222,128,0.9)',
  cancelado: 'rgba(248,113,113,0.9)',
}

const STATUS_BG: Record<ContratoCRMStatus, string> = {
  rascunho: 'rgba(156,163,175,0.12)',
  gerado: 'rgba(96,165,250,0.12)',
  enviado: 'rgba(251,191,36,0.12)',
  assinado: 'rgba(74,222,128,0.12)',
  cancelado: 'rgba(248,113,113,0.12)',
}

const STATUSES: ContratoCRMStatus[] = ['rascunho', 'gerado', 'enviado', 'assinado', 'cancelado']

function StatusBadge({ status }: { status: ContratoCRMStatus }) {
  return (
    <span style={{
      padding: '.18rem .65rem',
      borderRadius: 9999,
      fontSize: '.67rem',
      fontWeight: 700,
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      color: STATUS_COLOR[status],
      background: STATUS_BG[status],
      border: `1px solid ${STATUS_COLOR[status]}40`,
      fontFamily: 'Raleway, sans-serif',
    }}>
      {STATUS_LABEL[status]}
    </span>
  )
}

// ── Helpers de exibição de campos ─────────────────────────────

function formatFieldValue(value: string, tipo: string): string {
  if (!value) return '—'
  if (tipo === 'data') {
    try { return new Date(value + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return value }
  }
  if (tipo === 'valor') {
    const n = parseFloat(value.replace(',', '.'))
    return isNaN(n) ? value : fmtCur(n)
  }
  if (tipo === 'cpf') {
    const digits = value.replace(/\D/g, '')
    if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return value
}

function getInputType(tipo: string): string {
  if (tipo === 'data') return 'date'
  if (tipo === 'valor') return 'number'
  return 'text'
}

// ── Modal de edição ──────────────────────────────────────────

interface EditModalProps {
  detalhe: ContratoCRMDetalhe
  onClose: () => void
  onSave: (id: string, nome: string, ident: string, campos: Record<string, string>, status: ContratoCRMStatus) => Promise<void>
}

function EditModal({ detalhe, onClose, onSave }: EditModalProps) {
  const [tab, setTab] = useState<'dados' | 'preview'>('dados')
  const [clienteNome, setClienteNome] = useState(detalhe.cliente_nome)
  const [identificador, setIdentificador] = useState(detalhe.identificador)
  const [status, setStatus] = useState<ContratoCRMStatus>(detalhe.status)
  const [campos, setCampos] = useState<Record<string, string>>(() => {
    const c = { ...detalhe.campos_valores }
    delete c.__modelo_id
    return c as Record<string, string>
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const varMap = new Map<string, ContratoVariavel>(
    (detalhe.variaveis ?? []).map(v => [v.nome, v])
  )

  const camposOrdenados = Object.keys(campos).sort((a, b) => {
    const oa = varMap.get(a)?.ordem ?? 999
    const ob = varMap.get(b)?.ordem ?? 999
    return oa !== ob ? oa - ob : a.localeCompare(b)
  })

  const handleSave = async () => {
    if (!clienteNome.trim()) { setSaveError('Nome do cliente é obrigatório.'); return }
    if (!identificador.trim()) { setSaveError('Identificador é obrigatório.'); return }
    setSaving(true)
    setSaveError(null)
    try {
      const payload: Record<string, string> = { ...campos }
      if (detalhe.campos_valores.__modelo_id) {
        payload.__modelo_id = detalhe.campos_valores.__modelo_id
      }
      await onSave(detalhe.id, clienteNome.trim(), identificador.trim(), payload, status)
      onClose()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`EDITAR — ${detalhe.cliente_nome.toUpperCase()}`}
      wide
    >
      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.12)' }}>
        {(['dados', 'preview'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '.4rem',
              borderRadius: 6,
              border: 'none',
              background: tab === t ? 'rgba(212,168,83,0.18)' : 'transparent',
              color: tab === t ? '#d4a853' : '#8a6a55',
              fontWeight: 600,
              fontSize: '.75rem',
              cursor: 'pointer',
              fontFamily: 'Raleway, sans-serif',
              letterSpacing: '.04em',
              transition: 'all .15s',
            }}
          >
            {t === 'dados' ? '✏️ Dados' : '📄 Contrato'}
          </button>
        ))}
      </div>

      {tab === 'dados' ? (
        <>
          {/* Campos fixos */}
          <div style={{ marginBottom: '.5rem', paddingBottom: '.75rem', borderBottom: '1px solid rgba(212,168,83,0.12)' }}>
            <div className="section-label" style={{ fontSize: '.63rem', color: '#d4a853', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.5rem' }}>
              Dados do Contrato
            </div>
            <Field label="Nome do Cliente *">
              <input
                className="glass-input"
                value={clienteNome}
                onChange={e => setClienteNome(e.target.value)}
              />
            </Field>
            <FieldRow>
              <Field label="Identificador *" half>
                <input
                  className="glass-input"
                  value={identificador}
                  onChange={e => setIdentificador(e.target.value)}
                />
              </Field>
              <Field label="Status" half>
                <select
                  className="glass-input"
                  value={status}
                  onChange={e => setStatus(e.target.value as ContratoCRMStatus)}
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </Field>
            </FieldRow>
          </div>

          {/* Campos dinâmicos */}
          {camposOrdenados.length > 0 && (
            <div>
              <div className="section-label" style={{ fontSize: '.63rem', color: '#d4a853', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '.5rem' }}>
                Campos do Contrato
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem .75rem' }}>
                {camposOrdenados.map(nome => {
                  const v = varMap.get(nome)
                  const label = v?.label ?? nome.replace(/_/g, ' ')
                  const tipo = v?.tipo ?? 'texto'
                  return (
                    <Field key={nome} label={label}>
                      {tipo === 'texto' && v?.nome?.includes('extenso') ? (
                        <textarea
                          className="glass-input"
                          value={campos[nome] ?? ''}
                          onChange={e => setCampos(p => ({ ...p, [nome]: e.target.value }))}
                          rows={2}
                          style={{ resize: 'vertical', fontSize: '.82rem' }}
                        />
                      ) : (
                        <input
                          className="glass-input"
                          type={getInputType(tipo)}
                          value={campos[nome] ?? ''}
                          onChange={e => setCampos(p => ({ ...p, [nome]: e.target.value }))}
                          step={tipo === 'valor' ? '0.01' : undefined}
                          placeholder={tipo === 'cpf' ? '000.000.000-00' : undefined}
                        />
                      )}
                    </Field>
                  )
                })}
              </div>
            </div>
          )}

          {saveError && <p className="mt-3 text-sm text-red-400">{saveError}</p>}

          <ModalFormFooter
            onCancel={onClose}
            onSubmit={handleSave}
            submitLabel="Salvar alterações"
            submittingLabel="Salvando..."
            submitting={saving}
          />
        </>
      ) : (
        /* Preview do conteúdo final */
        <div>
          <div
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(212,168,83,0.18)',
              borderRadius: 8,
              padding: '1.25rem',
              maxHeight: '60vh',
              overflowY: 'auto',
              fontSize: '.82rem',
              lineHeight: 1.7,
              color: '#e8d8ca',
              whiteSpace: 'pre-wrap',
              fontFamily: 'Georgia, serif',
            }}
          >
            {detalhe.conteudo_final || '— Sem conteúdo gerado —'}
          </div>
          <p className="section-label mt-2" style={{ fontSize: '.67rem' }}>
            Prévia do contrato gerado. Edite os dados na aba "Dados" e salve para atualizar os campos.
          </p>
          <div className="flex justify-end pt-3">
            <button type="button" className="btn btn-outline btn-md" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Página principal ─────────────────────────────────────────

interface Props { readOnly?: boolean }

export function Contratos({ readOnly }: Props) {
  const { data, loading, error, buscarDetalhe, atualizar, reload } = useContratos()
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos')
  const [search, setSearch] = useState('')
  const [editDetalhe, setEditDetalhe] = useState<ContratoCRMDetalhe | null>(null)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [detalheError, setDetalheError] = useState<string | null>(null)

  const filtered = data.filter(c => {
    if (filterStatus !== 'todos' && c.status !== filterStatus) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        c.cliente_nome.toLowerCase().includes(q) ||
        c.identificador.toLowerCase().includes(q)
      )
    }
    return true
  })

  const openEdit = async (c: ContratoCRM) => {
    setDetalheError(null)
    setLoadingDetalhe(true)
    try {
      const d = await buscarDetalhe(c.id)
      setEditDetalhe(d)
    } catch (e) {
      setDetalheError(e instanceof Error ? e.message : 'Erro ao carregar contrato.')
    } finally {
      setLoadingDetalhe(false)
    }
  }

  const handleSave = async (
    id: string,
    nome: string,
    ident: string,
    campos: Record<string, string>,
    status: ContratoCRMStatus,
  ) => {
    await atualizar(id, nome, ident, campos, status)
  }

  return (
    <div className="fade-in">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: '2.2rem', color: '#d4a853', letterSpacing: '.08em' }}>
            Contratos
          </h1>
          <p className="section-label mt-1">
            {filtered.length} contrato{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
            {' · '}CRM Garbo Movelaria
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-card mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterStatus('todos')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filterStatus === 'todos'
                ? 'border border-[#d4a853] bg-[rgba(212,168,83,0.14)] text-[#d4a853]'
                : 'border border-[rgba(212,168,83,0.2)] text-[#8a6a55] hover:text-cream'
            }`}
          >
            Todos ({data.length})
          </button>
          {STATUSES.map(s => {
            const count = data.filter(c => c.status === s).length
            if (count === 0) return null
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                style={filterStatus === s ? {
                  border: `1px solid ${STATUS_COLOR[s]}`,
                  background: STATUS_BG[s],
                  color: STATUS_COLOR[s],
                } : undefined}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  filterStatus === s
                    ? ''
                    : 'border border-[rgba(212,168,83,0.2)] text-[#8a6a55] hover:text-cream'
                }`}
              >
                {STATUS_LABEL[s]} ({count})
              </button>
            )
          })}
        </div>

        <div className="relative sm:ml-auto sm:min-w-[220px]">
          <input
            className="glass-input !pl-8"
            placeholder="Buscar por nome ou identificador..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8a6a55', fontSize: '.85rem', pointerEvents: 'none' }}>
            🔍
          </span>
        </div>
      </div>

      {detalheError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {detalheError}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Nenhum contrato encontrado"
          description={search ? 'Tente outro termo de busca.' : 'Nenhum contrato registrado ainda.'}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(c => (
            <div
              key={c.id}
              className="glass-card p-4"
              style={{ borderLeft: `3px solid ${STATUS_COLOR[c.status]}60` }}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <StatusBadge status={c.status} />
                    <span style={{ fontSize: '.68rem', color: '#8a6a55' }}>
                      {fmtDate(c.created_at)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#f4e4d6', fontSize: '.98rem', marginBottom: '.2rem' }}>
                    {c.cliente_nome}
                  </div>
                  <div className="section-label" style={{ fontSize: '.72rem' }}>
                    {c.identificador}
                  </div>
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm shrink-0"
                    disabled={loadingDetalhe}
                    onClick={() => void openEdit(c)}
                  >
                    {loadingDetalhe ? '...' : '✏️ Editar'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editDetalhe && (
        <EditModal
          detalhe={editDetalhe}
          onClose={() => setEditDetalhe(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
