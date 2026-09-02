import { useCallback, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Columns3, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FloatingHorizontalScrollbar } from '@/components/kanban/FloatingHorizontalScrollbar'
import { KanbanPageZoomShell } from '@/components/kanban/KanbanPageZoomShell'
import { KanbanPageZoomControls } from '@/components/kanban/KanbanPageZoomControls'
import { LeadModal } from '@/components/leads/LeadModal'
import { ProducaoBoardAura } from '@/components/projetos-producao/ProducaoBoardAura'
import { ProducaoKanbanColumn } from '@/components/projetos-producao/ProducaoKanbanColumn'
import { ProducaoKanbanCard } from '@/components/projetos-producao/ProducaoKanbanCard'
import { ProducaoLeadSearch } from '@/components/projetos-producao/ProducaoLeadSearch'
import { ProducaoStagesConfigDialog } from '@/components/projetos-producao/ProducaoStagesConfigDialog'
import { ProducaoDualChatPanel } from '@/components/projetos-producao/ProducaoDualChatPanel'
import { AdicionarLeadProducaoDialog } from '@/components/projetos-producao/AdicionarLeadProducaoDialog'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import {
  useObraProducaoCards,
  useObraProducaoChatBoard,
  useObraProducaoMutations,
  useProducaoStages,
  type ObraProducao,
} from '@/hooks/useObraProducao'
import { useAuth } from '@/contexts/AuthContext'
import { useApp } from '@/context/AppContext'
import {
  canConfigurarProducaoColunas,
  canMoverProducaoCard,
  classifyProducaoStage,
} from '@/lib/projetos-producao'
import type { AppUserRole } from '@/lib/app-roles'
import { colaboradorCrmRoles } from '@/lib/crm-identity'

function resolveDropStageId(
  overId: string | number,
  cards: ObraProducao[],
  stageIds: Set<string>,
): string | null {
  const id = String(overId)
  if (stageIds.has(id)) return id
  return cards.find((card) => card.id === id)?.stage_id ?? null
}

type ConfirmKind = 'iniciar' | 'concluir'

const CONFIRM_COPY: Record<ConfirmKind, { title: string; body: string }> = {
  iniciar: {
    title: 'Iniciar este projeto?',
    body: 'O card vai para a coluna Projeto iniciado. A Agenda de Obras não muda.',
  },
  concluir: {
    title: 'Concluir a produção?',
    body: 'O card vai para Projetos concluídos. A Agenda de Obras não muda.',
  },
}

export default function ProjetosProducao() {
  const { user, isSuperAdmin } = useAuth()
  const { roles: casaRoles, crmProfile } = useApp()
  const { data: stages = [], isLoading: loadingStages, error: stagesError } = useProducaoStages()
  const { data: cards = [], isLoading: loadingCards, error: cardsError } = useObraProducaoCards({
    realtime: true,
  })
  const { data: chatThreads = [] } = useObraProducaoChatBoard({ realtime: false })
  const { mover, iniciar, concluir } = useObraProducaoMutations()
  const [searchParams, setSearchParams] = useSearchParams()
  const [colunasOpen, setColunasOpen] = useState(false)
  const [adicionarOpen, setAdicionarOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; run: () => void } | null>(null)
  const [chatCard, setChatCard] = useState<ObraProducao | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedLeadId = searchParams.get('id') ? Number(searchParams.get('id')) : null
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const stageIds = useMemo(() => new Set(stages.map((stage) => stage.id)), [stages])
  const chatByCard = useMemo(
    () => new Map(chatThreads.map((thread) => [thread.obra_producao_id, thread])),
    [chatThreads],
  )

  const crmRoles = colaboradorCrmRoles(crmProfile) as AppUserRole[]
  const canConfig = canConfigurarProducaoColunas(crmRoles, casaRoles, isSuperAdmin)
  const canMover = canMoverProducaoCard(crmProfile, casaRoles, isSuperAdmin)

  const columns = useMemo(
    () =>
      stages.map((stage) => ({
        stage,
        items: cards.filter((card) => card.stage_id === stage.id),
      })),
    [cards, stages],
  )

  const counts = useMemo(() => {
    let pendentes = 0
    let iniciados = 0
    let feitos = 0
    for (const card of cards) {
      const stage = stages.find((item) => item.id === card.stage_id)
      const kind = stage ? classifyProducaoStage(stage, stages) : 'other'
      if (kind === 'feito') feitos += 1
      else if (kind === 'iniciado') iniciados += 1
      else if (kind === 'pendente') pendentes += 1
    }
    return { pendentes, iniciados, feitos, total: cards.length }
  }, [cards, stages])

  const activeCard = activeId ? cards.find((card) => card.id === activeId) : null

  const openLead = useCallback(
    (leadId: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('id', String(leadId))
        return next
      })
    },
    [setSearchParams],
  )

  const closeLead = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('id')
      return next
    })
  }, [setSearchParams])

  const askConfirm = (kind: ConfirmKind, run: () => void) => setConfirm({ kind, run })

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const cardId = String(event.active.id)
    const overId = event.over?.id
    setActiveId(null)
    if (overId == null || !canMover) return
    const stageId = resolveDropStageId(overId, cards, stageIds)
    const current = cards.find((card) => card.id === cardId)
    if (!stageId || !current || current.stage_id === stageId) return
    mover.mutate({ id: cardId, stageId })
  }

  const loading = loadingStages || loadingCards
  const error = stagesError ?? cardsError

  return (
    <div className="relative min-h-[min(80vh,calc(100svh-5rem))]">
      <ProducaoBoardAura />

      <header className="sticky top-0 z-20 -mx-1 mb-2 flex flex-col gap-4 bg-gradient-to-b from-[#f7faf8]/95 from-70% via-[#f7faf8]/70 to-transparent px-1 pb-6 pt-2 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 max-w-lg space-y-3">
          <div>
            <p className="font-display text-[11px] tracking-[0.32em] text-[#2d8c78]">OFICINA</p>
            <h1 className="font-display text-3xl tracking-tight text-[#1c2824] md:text-4xl">
              Projetos de produção
            </h1>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#5a6b66]">
              Depois da entrada no caixa, o pedido cai aqui — paralelo à Agenda de Obras.
            </p>
          </div>
          <ProducaoLeadSearch cards={cards} onOpenLead={openLead} />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="rounded-2xl border border-[#2a3a36]/10 bg-white/70 px-4 py-3 shadow-[0_12px_30px_rgba(42,58,54,0.06)] backdrop-blur-md">
            <p className="font-display text-[10px] tracking-[0.24em] text-[#6b7c76]">RESUMO</p>
            <div className="mt-2.5 flex gap-5">
              <div>
                <p className="text-xl font-semibold tabular-nums text-[#a67c2d]">{counts.pendentes}</p>
                <p className="text-[10px] text-[#6b7c76]">Pendentes</p>
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums text-[#2d8c78]">{counts.iniciados}</p>
                <p className="text-[10px] text-[#6b7c76]">Iniciados</p>
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums text-[#3f9a68]">{counts.feitos}</p>
                <p className="text-[10px] text-[#6b7c76]">Concluídos</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-0.5">
            <KanbanPageZoomControls variant="inline" />
            {canMover ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 bg-[#2d8c78] text-white shadow-sm hover:bg-[#247a68]"
                onClick={() => setAdicionarOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar lead
              </Button>
            ) : null}
            {canConfig ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-[#2a3a36]/15 bg-white/80 text-[#2a3a36] hover:bg-white"
                onClick={() => setColunasOpen(true)}
              >
                <Columns3 className="h-4 w-4" />
                Colunas
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {loading && (
        <div className="relative z-20">
          <LoadingState variant="page" message="Abrindo a oficina…" />
        </div>
      )}
      {!loading && error && (
        <div className="relative z-20">
          <ErrorState message={error instanceof Error ? error.message : 'Falha ao carregar produção'} />
        </div>
      )}
      {!loading && !error && stages.length === 0 && (
        <div className="relative z-20">
          <EmptyState message="Ainda não há colunas de produção. Configure as colunas." />
        </div>
      )}

      {!loading && !error && stages.length > 0 && (
        <KanbanPageZoomShell className="relative z-10 min-h-[min(72vh,calc(100svh-14rem))] overflow-visible">
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="relative flex h-auto w-full min-w-0 flex-col overflow-visible pb-8">
              <div
                ref={scrollRef}
                className="scrollbar-always-visible relative z-[1] flex h-auto min-h-[min(72vh,calc(100svh-14rem))] min-w-0 items-stretch gap-4 overflow-x-auto overflow-y-visible overscroll-x-contain px-1 pb-6 md:gap-5"
              >
                {columns.map(({ stage, items }) => (
                  <ProducaoKanbanColumn
                    key={stage.id}
                    stage={stage}
                    stages={stages}
                    items={items.map((item) => item.id)}
                    count={items.length}
                  >
                    {items.map((card, index) => (
                      <ProducaoKanbanCard
                        key={card.id}
                        card={card}
                        stages={stages}
                        appearIndex={index}
                        currentUserId={user?.id}
                        canMover={canMover}
                        chatThread={chatByCard.get(card.id) ?? null}
                        onOpen={openLead}
                        onIniciar={(id) => askConfirm('iniciar', () => iniciar.mutate(id))}
                        onConcluir={(id) => askConfirm('concluir', () => concluir.mutate(id))}
                        onOpenChat={setChatCard}
                      />
                    ))}
                  </ProducaoKanbanColumn>
                ))}
              </div>
              <FloatingHorizontalScrollbar targetRef={scrollRef} deps={[columns.length, cards.length]} />
            </div>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[200px] rounded-xl border border-[#2d8c78]/30 bg-white p-2.5 shadow-lg">
                  <p className="truncate font-display text-[#1c2824]">{activeCard.lead_nome}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </KanbanPageZoomShell>
      )}

      <LeadModal
        isOpen={selectedLeadId != null && !Number.isNaN(selectedLeadId)}
        onClose={closeLead}
        leadId={selectedLeadId}
        statusChangeOnSelect={false}
        onLeadDuplicated={openLead}
        onLeadCreated={openLead}
      />

      <ProducaoStagesConfigDialog open={colunasOpen} onOpenChange={setColunasOpen} />
      <AdicionarLeadProducaoDialog
        open={adicionarOpen}
        onOpenChange={setAdicionarOpen}
        cards={cards}
        onPuxado={openLead}
      />
      <ProducaoDualChatPanel
        open={Boolean(chatCard)}
        onOpenChange={(open) => !open && setChatCard(null)}
        card={chatCard}
      />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="border-[#2a3a36]/12 bg-[#fffcf7]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[#1c2824]">
              {confirm ? CONFIRM_COPY[confirm.kind].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#5a6b66]">
              {confirm ? CONFIRM_COPY[confirm.kind].body : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#2a3a36]/15">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#2d8c78] text-white hover:bg-[#247a68]"
              onClick={() => {
                confirm?.run()
                setConfirm(null)
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
