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
import { ProjetosAbertosCard } from '@/components/projetos/ProjetosAbertosCard'
import { ProjetosChatPreview } from '@/components/projetos/ProjetosChatPreview'
import { ProjetosLeadSearch } from '@/components/projetos/ProjetosLeadSearch'
import { ProjetosBoardAura } from '@/components/projetos/ProjetosBoardAura'
import { ProjetoKanbanColumn } from '@/components/projetos/ProjetoKanbanColumn'
import { ProjetoKanbanCard } from '@/components/projetos/ProjetoKanbanCard'
import { CriarLeadProjetoDialog } from '@/components/projetos/CriarLeadProjetoDialog'
import { ProjetoStagesConfigDialog } from '@/components/projetos/ProjetoStagesConfigDialog'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/EmptyState'
import {
  useLeadProjetoChatBoard,
  useLeadProjetoMutations,
  useLeadProjetos,
  useProjetoStages,
  type LeadProjeto,
} from '@/hooks/useLeadProjetos'
import { useLeadLembretesCountMap } from '@/hooks/useLeadLembretes'
import { useAuth } from '@/contexts/AuthContext'
import {
  canPegarProjeto,
  canSolicitarNovamente,
  canSoltarOuReabrir,
  classifyProjetoStage,
  isProjetoEmDesenho,
} from '@/lib/projetos-atelie'
import { isProjetistaAdminRole, isProjetistaOnly } from '@/lib/app-roles'

function resolveDropStageId(
  overId: string | number,
  projetos: LeadProjeto[],
  stageIds: Set<string>,
): string | null {
  const id = String(overId)
  if (stageIds.has(id)) return id
  return projetos.find((projeto) => projeto.id === id)?.stage_id ?? null
}

type ConfirmKind = 'soltar' | 'reabrir' | 'solicitar' | 'puxar' | 'concluir'

const CONFIRM_COPY: Record<ConfirmKind, { title: string; body: string }> = {
  soltar: {
    title: 'Soltar este desenho?',
    body: 'O brilho para. O card volta para a fila e outro projetista pode pegar.',
  },
  reabrir: {
    title: 'Reabrir o projeto?',
    body: 'Volta para a fila. Quem estava desenhando continua marcado.',
  },
  solicitar: {
    title: 'Solicitar novamente?',
    body: 'O card volta à fila e o dono do desenho é liberado.',
  },
  puxar: {
    title: 'Puxar este lead para o ateliê?',
    body: 'Ele entra na prancheta. Se você for projetista, já fica com o desenho.',
  },
  concluir: {
    title: 'Concluir o projeto?',
    body: 'O card vai para a última coluna (feitos).',
  },
}

export default function Projetos() {
  const { user, userRoles, isSuperAdmin } = useAuth()
  const { data: stages = [], isLoading: loadingStages, error: stagesError } = useProjetoStages()
  const { data: projetos = [], isLoading: loadingProjetos, error: projetosError } = useLeadProjetos({
    realtime: true,
  })
  const { data: chatThreads = [] } = useLeadProjetoChatBoard({ realtime: false })
  const { mover, pegar, soltar, reabrir, solicitarNovamente, puxarParaProjeto } = useLeadProjetoMutations()
  const lembretesCountMap = useLeadLembretesCountMap()
  const [searchParams, setSearchParams] = useSearchParams()
  const [novoOpen, setNovoOpen] = useState(false)
  const [colunasOpen, setColunasOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; run: () => void } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedLeadId = searchParams.get('id') ? Number(searchParams.get('id')) : null
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const stageIds = useMemo(() => new Set(stages.map((stage) => stage.id)), [stages])
  const chatByLead = useMemo(
    () => new Map(chatThreads.map((thread) => [thread.lead_id, thread])),
    [chatThreads],
  )

  const projetistaOnly = isProjetistaOnly(userRoles, isSuperAdmin)
  const canConfig = isProjetistaAdminRole(userRoles, isSuperAdmin)
  const canPegar = canPegarProjeto(userRoles, isSuperAdmin)
  const canSoltar = canSoltarOuReabrir(userRoles, isSuperAdmin)
  const canSolicitar = canSolicitarNovamente(userRoles, isSuperAdmin)

  const columns = useMemo(
    () =>
      stages.map((stage) => ({
        stage,
        items: projetos.filter((projeto) => projeto.stage_id === stage.id),
      })),
    [projetos, stages],
  )

  const counts = useMemo(() => {
    let fila = 0
    let visitas = 0
    let desenho = 0
    let feitos = 0
    for (const projeto of projetos) {
      const stage = stages.find((item) => item.id === projeto.stage_id)
      const kind = stage ? classifyProjetoStage(stage, stages) : 'other'
      if (kind === 'feito') {
        feitos += 1
        continue
      }
      if (kind === 'visita') visitas += 1
      else if (kind === 'waiting' || projeto.aguardando_resposta) fila += 1
      if (isProjetoEmDesenho(projeto) && kind !== 'visita') desenho += 1
    }
    return { fila, visitas, desenho, feitos }
  }, [projetos, stages])

  const activeProjeto = activeId ? projetos.find((projeto) => projeto.id === activeId) : null

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
    const projetoId = String(event.active.id)
    const overId = event.over?.id
    setActiveId(null)
    if (overId == null) return
    const stageId = resolveDropStageId(overId, projetos, stageIds)
    const current = projetos.find((projeto) => projeto.id === projetoId)
    if (!stageId || !current || current.stage_id === stageId) return
    mover.mutate({ projetoId, stageId })
  }

  const loading = loadingStages || loadingProjetos
  const error = stagesError ?? projetosError

  return (
    <div className="relative">
      <ProjetosBoardAura />

      <header className="sticky top-0 z-20 -mx-1 mb-1 flex flex-col gap-3 bg-gradient-to-b from-[#f8f4ee] from-75% to-transparent px-1 pb-5 pt-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-md space-y-3">
          <div>
            <p className="font-display text-[11px] tracking-[0.28em] text-[#8d5e22]">SETOR</p>
            <h1 className="font-display text-2xl text-[#2a1812] md:text-3xl">Projetos</h1>
            <p className="mt-1 max-w-md text-xs text-[#6b5244]">
              Todos os projetistas veem o mesmo quadro. Puxar o lead marca o card na Pipeline.
            </p>
          </div>
          <ProjetosLeadSearch
            projetos={projetos}
            onOpenLead={openLead}
            onPuxarLead={(leadId) => askConfirm('puxar', () => puxarParaProjeto.mutate(leadId))}
          />
        </div>
        <ProjetosAbertosCard
          fila={counts.fila}
          visitas={counts.visitas}
          desenho={counts.desenho}
          feitos={counts.feitos}
        />
        <ProjetosChatPreview onOpenLead={openLead} />
        <div className="flex flex-wrap items-center gap-2">
          <KanbanPageZoomControls variant="inline" />
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-gold text-[#1a120e] hover:bg-gold/90"
            onClick={() => setNovoOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Novo lead
          </Button>
          {canConfig ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 border-[#8d5e22]/40 text-[#8d5e22]"
              onClick={() => setColunasOpen(true)}
            >
              <Columns3 className="h-4 w-4" />
              Colunas
            </Button>
          ) : null}
        </div>
      </header>

      {loading && (
        <div className="relative z-20">
          <LoadingState variant="page" message="Abrindo a prancheta..." />
        </div>
      )}
      {!loading && error && (
        <div className="relative z-20">
          <ErrorState message={error instanceof Error ? error.message : 'Falha ao carregar projetos'} />
        </div>
      )}
      {!loading && !error && stages.length === 0 && (
        <div className="relative z-20">
          <EmptyState message="Ainda não há colunas de projetos neste CRM." />
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
                  <ProjetoKanbanColumn
                    key={stage.id}
                    stage={stage}
                    stages={stages}
                    items={items.map((item) => item.id)}
                    count={items.length}
                  >
                    {items.map((projeto, index) => (
                      <ProjetoKanbanCard
                        key={projeto.id}
                        projeto={projeto}
                        stages={stages}
                        appearIndex={index}
                        currentUserId={user?.id}
                        canPegar={canPegar}
                        canSoltar={canSoltar}
                        canReabrir={canSoltar}
                        canSolicitar={canSolicitar}
                        chatThread={chatByLead.get(projeto.lead_id) ?? null}
                        lembretesCount={lembretesCountMap.get(projeto.lead_id) ?? 0}
                        onOpen={openLead}
                        onPegar={(id) => pegar.mutate(id)}
                        onSoltar={(id) => askConfirm('soltar', () => soltar.mutate(id))}
                        onReabrir={(id) => askConfirm('reabrir', () => reabrir.mutate(id))}
                        onSolicitar={(item) =>
                          askConfirm('solicitar', () =>
                            solicitarNovamente.mutate({ leadId: item.lead_id, projetoId: item.id }),
                          )
                        }
                      />
                    ))}
                  </ProjetoKanbanColumn>
                ))}
              </div>
              <FloatingHorizontalScrollbar targetRef={scrollRef} deps={[columns.length, projetos.length]} />
            </div>
            <DragOverlay>
              {activeProjeto ? (
                <div className="w-[200px] rounded-lg border border-[#f2d892]/50 bg-[#1a100c] p-2.5 shadow-lg">
                  <p className="truncate font-display text-[#f2d892]">{activeProjeto.lead_nome}</p>
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
        contextoProjeto
        modoProjeto={projetistaOnly}
        statusChangeOnSelect={false}
        onLeadDuplicated={openLead}
        onLeadCreated={openLead}
      />

      <CriarLeadProjetoDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        onCreated={openLead}
      />
      <ProjetoStagesConfigDialog open={colunasOpen} onOpenChange={setColunasOpen} />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent className="border-gold/20 bg-[#120c09]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-gold">
              {confirm ? CONFIRM_COPY[confirm.kind].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? CONFIRM_COPY[confirm.kind].body : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gold text-[#1a120e]"
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
