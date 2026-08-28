import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Copy, Plus, Search } from 'lucide-react'
import { AgendaComercialCalendar } from '@/components/crm/AgendaComercialCalendar'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState } from '@/components/ui/EmptyState'
import { Field, FieldRow } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { useCrmAgenda } from '@/hooks/useCrmAgenda'
import {
  AGENDA_STATUS_LABEL,
  addMinutesIso,
  filtrarReunioes,
  fromDatetimeLocal,
  linkPublicoAgenda,
  reunioesDoDia,
  reunioesHoje,
  toDatetimeLocal,
  type AgendaStatus,
  type CrmReuniao,
} from '@/lib/crm-agenda'
import { showToast } from '@/lib/toast'

function fmtDateTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const EMPTY_FORM = {
  titulo: '',
  inicio: '',
  fim: '',
  convidado: '',
  whatsapp: '',
  status: 'pendente' as AgendaStatus,
  leadId: '',
  observacoes: '',
}

export function AgendaComercialPage() {
  const { data, loading, error, salvar, criar } = useCrmAgenda()
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('all')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [editing, setEditing] = useState<CrmReuniao | 'novo' | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const reunioesFiltradas = useMemo(() => {
    const bySearch = filtrarReunioes(data.reunioes, busca)
    if (statusFiltro === 'all') return bySearch
    return bySearch.filter(item => item.status === statusFiltro)
  }, [data.reunioes, busca, statusFiltro])
  const listaDoDia = useMemo(
    () => reunioesDoDia(reunioesFiltradas, selectedDate),
    [reunioesFiltradas, selectedDate],
  )
  const hoje = useMemo(() => reunioesHoje(data.reunioes), [data.reunioes])
  const pendentes = useMemo(
    () => data.reunioes.filter(item => item.status === 'pendente' || item.status === 'confirmado').length,
    [data.reunioes],
  )
  const linkPublico = linkPublicoAgenda(data.config.slug)
  const duracao = data.config.duracao_minutos || 30

  const abrirNovo = () => {
    const inicio = new Date(selectedDate)
    const agora = new Date()
    inicio.setHours(agora.getHours(), agora.getMinutes(), 0, 0)
    const inicioIso = inicio.toISOString()
    setForm({
      ...EMPTY_FORM,
      titulo: '',
      inicio: toDatetimeLocal(inicioIso),
      fim: toDatetimeLocal(addMinutesIso(inicioIso, duracao)),
    })
    setEditing('novo')
  }

  const abrir = (item: CrmReuniao) => {
    setForm({
      titulo: item.titulo,
      inicio: toDatetimeLocal(item.data_hora_inicio),
      fim: toDatetimeLocal(item.data_hora_fim),
      convidado: item.convidado_nome ?? '',
      whatsapp: item.convidado_whatsapp ?? '',
      status: item.status,
      leadId: item.lead_id ? String(item.lead_id) : '',
      observacoes: item.observacoes ?? '',
    })
    setEditing(item)
  }

  const copiarLink = async () => {
    if (!linkPublico) return
    try {
      await navigator.clipboard.writeText(linkPublico)
      showToast('Link de agendamento copiado.')
    } catch {
      showToast('Não foi possível copiar o link.', 'error')
    }
  }

  return (
    <CrmPageFrame padded>
      <CrmPageHeader
        title="Agenda comercial"
        subtitle={`${data.config.nome_agenda} · ${listaDoDia.length} no dia escolhido`}
        actions={(
          <Button size="sm" className="gap-2" onClick={abrirNovo}>
            <Plus className="h-4 w-4" />
            Nova reunião
          </Button>
        )}
        below={(
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="glass-input w-full pl-9"
                placeholder="Buscar reunião, convidado ou lead"
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </label>
            <select
              className="glass-input min-w-[150px]"
              value={statusFiltro}
              onChange={e => setStatusFiltro(e.target.value)}
            >
              <option value="all">Todos os status</option>
              {Object.entries(AGENDA_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {linkPublico && (
              <Button type="button" variant="outline" size="sm" onClick={() => void copiarLink()}>
                <Copy className="h-4 w-4" />
                Link público
              </Button>
            )}
          </div>
        )}
      />

      {linkPublico && (
        <p className="text-xs text-[#b8957f]">
          Página pública de agendamento: <span className="text-[#d4bc9f]">{linkPublico}</span>
        </p>
      )}

      {loading && <LoadingState variant="page" message="Carregando agenda comercial..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/80 bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reuniões hoje</p>
              <p className="text-lg font-semibold tabular-nums">{hoje.length}</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-card px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pendentes</p>
              <p className="text-lg font-semibold tabular-nums text-amber-300">{pendentes}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-border/80 bg-card px-3 py-2 sm:col-span-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Duração padrão</p>
              <p className="text-lg font-semibold tabular-nums">{duracao} min</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AgendaComercialCalendar
              reunioes={data.reunioes}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
            <div className="space-y-3">
              <h2 className="text-sm font-semibold capitalize text-foreground">
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h2>
              {listaDoDia.length === 0 ? (
                <p className="rounded-xl border border-border/80 bg-card px-3 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma reunião neste dia.
                </p>
              ) : (
                <div className="glass-card overflow-hidden">
                  <ul className="divide-y divide-border/50">
                    {listaDoDia.map(item => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-white/5"
                          onClick={() => abrir(item)}
                        >
                          <span className="font-medium text-[#f2d892]">{item.titulo}</span>
                          <span className="text-xs text-[#d4bc9f]">{fmtDateTime(item.data_hora_inicio)}</span>
                          <span className="text-xs text-[#edd9c4]">
                            {item.convidado_nome ?? item.lead_nome ?? 'Sem convidado'}
                            {' · '}
                            {AGENDA_STATUS_LABEL[item.status] ?? item.status}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Modal
        open={editing != null}
        onClose={() => setEditing(null)}
        title={editing === 'novo' ? 'Nova reunião' : editing?.titulo ?? 'Reunião'}
        closeOnBackdrop={false}
      >
        <Field label="Título">
          <input className="glass-input w-full" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
        </Field>
        <FieldRow>
          <Field label="Início" half>
            <input
              type="datetime-local"
              className="glass-input w-full"
              value={form.inicio}
              onChange={e => {
                const inicio = e.target.value
                const iso = fromDatetimeLocal(inicio)
                setForm(f => ({
                  ...f,
                  inicio,
                  fim: iso ? toDatetimeLocal(addMinutesIso(iso, duracao)) : f.fim,
                }))
              }}
            />
          </Field>
          <Field label="Fim" half>
            <input
              type="datetime-local"
              className="glass-input w-full"
              value={form.fim}
              onChange={e => setForm(f => ({ ...f, fim: e.target.value }))}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Convidado" half>
            <input className="glass-input w-full" value={form.convidado} onChange={e => setForm(f => ({ ...f, convidado: e.target.value }))} />
          </Field>
          <Field label="WhatsApp" half>
            <input className="glass-input w-full" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Lead" half>
            <select
              className="glass-input w-full"
              value={form.leadId}
              onChange={e => {
                const value = e.target.value
                const lead = data.leads.find(l => String(l.id) === value)
                setForm(f => ({
                  ...f,
                  leadId: value,
                  convidado: f.convidado || lead?.nome || '',
                  titulo: f.titulo || (lead ? `Reunião com ${lead.nome}` : f.titulo),
                }))
              }}
            >
              <option value="">Sem lead</option>
              {data.leads.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </Field>
          {editing !== 'novo' && (
            <Field label="Status" half>
              <select
                className="glass-input w-full"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as AgendaStatus }))}
              >
                {Object.entries(AGENDA_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          )}
        </FieldRow>
        <Field label="Observações">
          <textarea className="glass-input w-full" rows={3} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
        </Field>
        <ModalFormFooter
          onCancel={() => setEditing(null)}
          submitting={saving}
          submitDisabled={!form.titulo.trim() || !form.inicio}
          onSubmit={() => {
            const inicioIso = fromDatetimeLocal(form.inicio)
            const fimIso = fromDatetimeLocal(form.fim) || addMinutesIso(inicioIso, duracao)
            const payload = {
              titulo: form.titulo.trim(),
              inicio: inicioIso,
              fim: fimIso,
              convidado: form.convidado,
              whatsapp: form.whatsapp,
              leadId: form.leadId ? Number(form.leadId) : null,
            }
            setSaving(true)
            const run = editing === 'novo' || !editing
              ? criar(payload)
              : salvar({ ...payload, id: editing.id, status: form.status, observacoes: form.observacoes })
            void run.then(() => {
              showToast(editing === 'novo' ? 'Reunião criada.' : 'Reunião salva.')
              setEditing(null)
            }).catch(err => {
              showToast(err instanceof Error ? err.message : 'Não foi possível salvar.', 'error')
            }).finally(() => setSaving(false))
          }}
          submitLabel={editing === 'novo' ? 'Criar reunião' : 'Salvar'}
        />
      </Modal>
    </CrmPageFrame>
  )
}
