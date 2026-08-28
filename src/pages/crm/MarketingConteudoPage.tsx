import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, FileUp, Kanban, Plus, Search, Settings, Sparkles } from 'lucide-react'
import { CrmPageFrame, CrmPageHeader } from '@/components/crm/CrmPageFrame'
import { CRM_KANBAN_COLUMN_SHELL_CLASS } from '@/lib/crm-kanban-layout'
import { Button } from '@/components/ui/button'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ModalFormFooter } from '@/components/ui/ModalFormFooter'
import { useApp } from '@/context/AppContext'
import { isCrmAdmin, isMarketingOnlyCrm } from '@/lib/crm-identity'
import { cardsDaColuna, filtrarTarefasDoMes, mesAtualKey, tarefasDoDia, type MktCard } from '@/lib/crm-marketing'
import { useCrmMarketing, useCrmMarketingMedias } from '@/hooks/useCrmMarketing'
import { showToast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { fmtDate } from '@/lib/utils'

type TabId = 'producao' | 'agendamento' | 'midias' | 'planejamento'

export function MarketingConteudoPage() {
  const { crmProfile } = useApp()
  const marketingOnly = isMarketingOnlyCrm(crmProfile)
  const showPlanejamento = isCrmAdmin(crmProfile) && !marketingOnly
  const { data, loading, error, salvarColuna, salvarCard, moverCard, excluirCard, salvarTarefa, salvarNode } = useCrmMarketing()
  const [params, setParams] = useSearchParams()
  const tabFromUrl = params.get('tab')
  const tab: TabId = tabFromUrl === 'agendamento' || tabFromUrl === 'midias' || tabFromUrl === 'planejamento'
    ? (tabFromUrl === 'planejamento' && !showPlanejamento ? 'producao' : tabFromUrl)
    : 'producao'
  const tabs: { id: TabId; label: string; icon: typeof Kanban }[] = [
    { id: 'producao', label: 'Produção', icon: Kanban },
    { id: 'agendamento', label: 'Agendamento', icon: CalendarDays },
    { id: 'midias', label: 'Mídias', icon: FileUp },
    ...(showPlanejamento ? [{ id: 'planejamento' as const, label: 'Planejamento', icon: Settings }] : []),
  ]

  return (
    <CrmPageFrame>
      <CrmPageHeader
        title="Marketing de conteúdo"
        subtitle="Produção, mídias, agenda e ideias — sem misturar com o Caixa da fábrica."
        icon={(
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/15">
            <Kanban className="h-4 w-4 text-rose-300" />
          </div>
        )}
        below={(
          <div className="flex flex-wrap gap-2">
            {tabs.map(item => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.set('tab', item.id)
                  setParams(next, { replace: true })
                }}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        )}
      />
      {loading && <LoadingState variant="page" message="Abrindo o marketing..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && tab === 'producao' && (
        <ProducaoBoard
          colunas={data.colunas}
          cards={data.cards}
          onNovaColuna={nome => salvarColuna(null, nome)}
          onSalvarCard={salvarCard}
          onMover={moverCard}
          onExcluir={excluirCard}
        />
      )}
      {!loading && !error && tab === 'agendamento' && (
        <AgendaTab tarefas={data.tarefas} onSalvar={salvarTarefa} />
      )}
      {!loading && !error && tab === 'midias' && (
        <MidiasTab pastas={data.pastas} semPasta={data.semPasta} total={data.totalMidias} />
      )}
      {!loading && !error && tab === 'planejamento' && (
        <PlanejamentoTab nodes={data.nodes} onSalvar={salvarNode} />
      )}
    </CrmPageFrame>
  )
}

function ProducaoBoard({
  colunas,
  cards,
  onNovaColuna,
  onSalvarCard,
  onMover,
  onExcluir,
}: {
  colunas: { id: string; nome: string }[]
  cards: MktCard[]
  onNovaColuna: (nome: string) => Promise<void>
  onSalvarCard: (input: { id: string | null; titulo: string; scriptCopy: string; columnId: string; urgente?: boolean }) => Promise<void>
  onMover: (id: string, columnId: string) => Promise<void>
  onExcluir: (id: string) => Promise<void>
}) {
  const [colunaNome, setColunaNome] = useState('')
  const [edit, setEdit] = useState<MktCard | 'new' | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const primeira = colunas[0]?.id ?? ''

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="glass-input max-w-xs" placeholder="Nova coluna" value={colunaNome} onChange={e => setColunaNome(e.target.value)} />
        <Button size="sm" type="button" onClick={() => {
          if (!colunaNome.trim()) return
          void onNovaColuna(colunaNome.trim())
            .then(() => { setColunaNome(''); showToast('Coluna criada.') })
            .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
        }}>
          <Plus className="h-4 w-4" /> Coluna
        </Button>
        <Button size="sm" type="button" disabled={!primeira} onClick={() => setEdit('new')}>
          <Plus className="h-4 w-4" /> Card
        </Button>
      </div>
      {colunas.length === 0 ? (
        <EmptyState message="Crie a primeira coluna para começar a produção." />
      ) : (
        <div className="flex min-h-[22rem] gap-3 overflow-x-auto pb-4">
          {colunas.map(col => {
            const items = cardsDaColuna(cards, col.id)
            return (
              <section
                key={col.id}
                className={CRM_KANBAN_COLUMN_SHELL_CLASS}
                onDragOver={e => e.preventDefault()}
                onDrop={() => {
                  if (dragId) void onMover(dragId, col.id).catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
                  setDragId(null)
                }}
              >
                <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                  <h2 className="truncate text-sm font-semibold">{col.nome}</h2>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </header>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {items.map(card => (
                    <button
                      key={card.id}
                      type="button"
                      draggable
                      onDragStart={() => setDragId(card.id)}
                      onClick={() => setEdit(card)}
                      className="rounded-lg border border-border/70 bg-background/60 p-2.5 text-left text-sm hover:border-amber-400/40"
                    >
                      <p className="font-medium leading-snug">{card.titulo}</p>
                      {card.urgente && <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-rose-300">Urgente</span>}
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
      <CardModal
        open={edit != null}
        card={edit === 'new' ? null : edit}
        colunas={colunas}
        defaultColumn={primeira}
        onClose={() => setEdit(null)}
        onSave={onSalvarCard}
        onDelete={onExcluir}
      />
    </>
  )
}

function CardModal({
  open,
  card,
  colunas,
  defaultColumn,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  card: MktCard | null
  colunas: { id: string; nome: string }[]
  defaultColumn: string
  onClose: () => void
  onSave: (input: { id: string | null; titulo: string; scriptCopy: string; columnId: string; urgente?: boolean }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [titulo, setTitulo] = useState(card?.titulo ?? '')
  const [script, setScript] = useState(card?.scriptCopy ?? '')
  const [columnId, setColumnId] = useState(card?.columnId ?? defaultColumn)
  const [urgente, setUrgente] = useState(card?.urgente ?? false)
  const [saving, setSaving] = useState(false)
  const [iaLoading, setIaLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitulo(card?.titulo ?? '')
    setScript(card?.scriptCopy ?? '')
    setColumnId(card?.columnId ?? defaultColumn)
    setUrgente(card?.urgente ?? false)
  }, [card, defaultColumn, open])

  return (
    <Modal open={open} onClose={onClose} title={card ? 'Editar card' : 'Novo card'} closeOnBackdrop={false}>
      <Field label="Título">
        <input className="glass-input w-full" value={titulo} onChange={e => setTitulo(e.target.value)} />
      </Field>
      <Field label="Coluna">
        <select className="glass-input w-full" value={columnId} onChange={e => setColumnId(e.target.value)}>
          {colunas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Field>
      <Field label="Copy / roteiro">
        <textarea className="glass-input min-h-28 w-full" value={script} onChange={e => setScript(e.target.value)} />
      </Field>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={urgente} onChange={e => setUrgente(e.target.checked)} />
        Urgente
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mb-4"
        disabled={iaLoading}
        onClick={() => {
          setIaLoading(true)
          void supabase.functions.invoke('gerar-marketing-copy', {
            body: { tipo_geracao: 'Criar com sugestão', titulo, sugestao: script || titulo },
          }).then(({ data, error }) => {
            if (error) throw error
            const texto = typeof data === 'object' && data && 'copy' in data
              ? String((data as { copy?: unknown }).copy ?? '')
              : typeof data === 'string' ? data : JSON.stringify(data)
            if (texto) setScript(texto)
            else showToast('A IA não devolveu um texto. Você pode escrever o roteiro na mão.', 'error')
          }).catch(err => showToast(err instanceof Error ? err.message : 'IA indisponível neste momento. Escreva o roteiro na mão.', 'error'))
            .finally(() => setIaLoading(false))
        }}
      >
        <Sparkles className="h-4 w-4" /> {iaLoading ? 'Gerando...' : 'Gerar com IA'}
      </Button>
      {card && (
        <button
          type="button"
          className="btn btn-outline btn-sm mb-3 text-rose-300"
          onClick={() => {
            void onDelete(card.id).then(() => { showToast('Card excluído.'); onClose() }).catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
          }}
        >
          Excluir card
        </button>
      )}
      <ModalFormFooter
        onCancel={onClose}
        submitLabel="Salvar"
        submitting={saving}
        onSubmit={() => {
          if (!titulo.trim()) { showToast('Informe o título.', 'error'); return }
          setSaving(true)
          void onSave({ id: card?.id ?? null, titulo, scriptCopy: script, columnId, urgente })
            .then(() => { showToast('Card salvo.'); onClose() })
            .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
            .finally(() => setSaving(false))
        }}
      />
    </Modal>
  )
}

function AgendaTab({
  tarefas,
  onSalvar,
}: {
  tarefas: { id: string; titulo: string; status: string; dataAgendada: string | null }[]
  onSalvar: (input: { id: string | null; titulo: string; data: string; status?: string }) => Promise<void>
}) {
  const ym = mesAtualKey()
  const doMes = filtrarTarefasDoMes(tarefas, ym)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const doDia = tarefasDoDia(tarefas, data)
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border/80 bg-card p-4">
        <p className="mb-3 text-sm font-semibold capitalize">{first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-muted-foreground">
          {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].map(d => <span key={d}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <span key={`e-${idx}`} />
            const iso = `${ym}-${String(day).padStart(2, '0')}`
            const count = tarefasDoDia(tarefas, iso).length
            return (
              <button
                key={iso}
                type="button"
                className={`h-9 rounded-md text-sm ${data === iso ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/50'}`}
                onClick={() => setData(iso)}
              >
                {day}
                {count > 0 && <span className="ml-0.5 text-[10px] text-amber-300">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <input className="glass-input" placeholder="Tarefa" value={titulo} onChange={e => setTitulo(e.target.value)} />
          <Button size="sm" type="button" onClick={() => {
            if (!titulo.trim() || !data) { showToast('Informe título e data.', 'error'); return }
            void onSalvar({ id: null, titulo, data }).then(() => { setTitulo(''); showToast('Agendado.') })
              .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
          }}>Agendar</Button>
        </div>
        <p className="text-xs text-muted-foreground">{doMes.length} no mês · {doDia.length} no dia escolhido</p>
        {doDia.length === 0 ? <EmptyState message="Nada neste dia." /> : (
          <ul className="divide-y divide-border/50 rounded-xl border border-border/80">
            {doDia.map(t => (
              <li key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{t.titulo}</span>
                <span className="text-muted-foreground">{fmtDate(t.dataAgendada)} · {t.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function MidiasTab({ pastas, semPasta, total }: { pastas: { id: string; nome: string; total: number }[]; semPasta: number; total: number }) {
  const medias = useCrmMarketingMedias()
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{total} arquivos na biblioteca. Abrimos em páginas para não travar o celular.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={!medias.folderId && !medias.semPasta ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'} onClick={() => { medias.setFolderId(null); medias.setSemPasta(false); medias.setOffset(0) }}>
          Todas ({total})
        </button>
        <button type="button" className={medias.semPasta ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'} onClick={() => { medias.setFolderId(null); medias.setSemPasta(true); medias.setOffset(0) }}>
          Sem pasta ({semPasta})
        </button>
        {pastas.map(p => (
          <button key={p.id} type="button" className={medias.folderId === p.id ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'} onClick={() => { medias.setFolderId(p.id); medias.setSemPasta(false); medias.setOffset(0) }}>
            {p.nome} ({p.total})
          </button>
        ))}
      </div>
      <label className="relative block max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input className="glass-input w-full pl-9" placeholder="Buscar mídia" value={medias.busca} onChange={e => { medias.setBusca(e.target.value); medias.setOffset(0) }} />
      </label>
      {medias.loading && <LoadingState message="Carregando mídias..." />}
      {!medias.loading && medias.items.length === 0 && <EmptyState message="Nenhuma mídia nesta pasta." />}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {medias.items.map(item => (
          <a key={item.id} href={item.fileUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-border/70 bg-card">
            {item.tipo === 'imagem'
              ? <img src={item.fileUrl} alt={item.titulo} className="h-28 w-full object-cover" loading="lazy" />
              : <div className="flex h-28 items-center justify-center text-xs uppercase text-muted-foreground">{item.tipo}</div>}
            <p className="truncate px-2 py-1.5 text-xs">{item.titulo || item.fileName}</p>
          </a>
        ))}
      </div>
      {medias.total > medias.limit && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={medias.offset === 0} onClick={() => medias.setOffset(Math.max(0, medias.offset - medias.limit))}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={medias.offset + medias.limit >= medias.total} onClick={() => medias.setOffset(medias.offset + medias.limit)}>Próxima</Button>
        </div>
      )}
    </div>
  )
}

function PlanejamentoTab({
  nodes,
  onSalvar,
}: {
  nodes: { id: string; titulo: string; conteudo: string | null }[]
  onSalvar: (input: { id: string | null; titulo: string; conteudo: string }) => Promise<void>
}) {
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Aqui entram as ideias antes de virar card de produção.</p>
      <Field label="Título"><input className="glass-input w-full" value={titulo} onChange={e => setTitulo(e.target.value)} /></Field>
      <Field label="Conteúdo"><textarea className="glass-input min-h-24 w-full" value={conteudo} onChange={e => setConteudo(e.target.value)} /></Field>
      <Button size="sm" type="button" onClick={() => {
        if (!titulo.trim()) { showToast('Informe o título.', 'error'); return }
        void onSalvar({ id: null, titulo, conteudo }).then(() => { setTitulo(''); setConteudo(''); showToast('Ideia salva.') })
          .catch(err => showToast(err instanceof Error ? err.message : 'Erro', 'error'))
      }}>Salvar ideia</Button>
      {nodes.length === 0 ? <EmptyState message="Nenhuma ideia ainda." /> : (
        <ul className="space-y-2">
          {nodes.map(n => (
            <li key={n.id} className="rounded-lg border border-border/70 p-3">
              <p className="font-medium">{n.titulo}</p>
              {n.conteudo && <p className="mt-1 text-sm text-muted-foreground">{n.conteudo}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
