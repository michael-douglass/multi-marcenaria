import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Hourglass, Lamp, RotateCcw, Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeadLembretesPopover } from '@/components/agenda/LeadLembretesPopover'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  classifyProjetoStage,
  isProjetoEmDesenho,
} from '@/lib/projetos-atelie'
import type { LeadProjeto, LeadProjetoChatThread, ProjetoStage } from '@/hooks/useLeadProjetos'
import { ProjetoClaimedAura } from '@/components/projetos/ProjetoClaimedAura'
import { ProjetoChatBadge } from '@/components/projetos/ProjetoChatBadge'
import '@/components/projetos/projeto-claimed.css'

interface ProjetoKanbanCardProps {
  projeto: LeadProjeto
  stages: ProjetoStage[]
  appearIndex?: number
  currentUserId?: string | null
  canPegar?: boolean
  canSoltar?: boolean
  canReabrir?: boolean
  canSolicitar?: boolean
  chatThread?: LeadProjetoChatThread | null
  lembretesCount?: number
  onOpen: (leadId: number) => void
  onPegar?: (projetoId: string) => void
  onSoltar?: (projetoId: string) => void
  onReabrir?: (projetoId: string) => void
  onSolicitar?: (projeto: LeadProjeto) => void
}

export function ProjetoKanbanCard({
  projeto,
  stages,
  appearIndex = 0,
  currentUserId,
  canPegar,
  canSoltar,
  canReabrir,
  canSolicitar,
  chatThread,
  lembretesCount = 0,
  onOpen,
  onPegar,
  onSoltar,
  onReabrir,
  onSolicitar,
}: ProjetoKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: projeto.id,
  })
  const stage = stages.find((item) => item.id === projeto.stage_id)
  const kind = stage ? classifyProjetoStage(stage, stages) : 'other'
  const emDesenho = isProjetoEmDesenho(projeto) && kind !== 'feito'
  const delay = Math.min(appearIndex, 8) * 40

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        animationDelay: `${delay}ms`,
        background: '#3a2418',
        boxShadow: '0 8px 18px rgba(8, 4, 2, 0.55)',
      }}
      className={cn(
        'relative w-full cursor-pointer overflow-hidden rounded-lg border-2 border-[#f2d892]/70 text-left text-[#fff8ee]',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[#f2d892]',
        !isDragging && 'animate-in fade-in slide-in-from-top-2 duration-300 fill-mode-backwards',
        isDragging && 'z-50 scale-[1.03] rotate-1 ring-2 ring-sky-400/40',
        emDesenho && 'projeto-card-claimed',
      )}
      onClick={() => onOpen(projeto.lead_id)}
    >
      {emDesenho ? (
        <div
          className="projeto-card-claimed-rim flex items-center gap-2 border-b border-sky-400/30 bg-sky-950/40 px-2 py-1.5"
          role="status"
          aria-live="polite"
        >
          <ProjetoClaimedAura />
          <p className="min-w-0 font-display text-sm tracking-wide text-[#f2d892]">
            Em desenho · {projeto.arquiteto_nome ?? 'projetista'}
          </p>
        </div>
      ) : null}

      <div className="flex items-start gap-1.5 p-2.5 pl-3.5">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-[#f6ead8] hover:bg-white/10"
          aria-label="Arrastar card"
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base leading-snug text-[#f2d892]">{projeto.lead_nome}</p>
          {projeto.aguardando_resposta ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              <Hourglass className="h-2.5 w-2.5" />
              Aguardando projetista
            </span>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {chatThread ? (
              <ProjetoChatBadge
                lastAutorId={chatThread.last.autor_id}
                currentUserId={currentUserId}
              />
            ) : null}
            <LeadLembretesPopover leadId={projeto.lead_id} leadName={projeto.lead_nome}>
              <button
                type="button"
                className="relative flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="Lembretes deste lead"
              >
                <Bell className="h-3.5 w-3.5" />
                {lembretesCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive text-[8px] font-bold">
                    {lembretesCount > 9 ? '9+' : lembretesCount}
                  </span>
                ) : null}
              </button>
            </LeadLembretesPopover>
          </div>

          <div className="mt-2 space-y-0.5 text-[11px] text-[#f6ead8]">
            <p className="flex items-center gap-1 truncate">
              <User className="h-3 w-3 text-[#f2d892]" />
              Titular: {projeto.titular_nome ?? '—'}
            </p>
            {projeto.parceiro_nome ? (
              <p className="flex items-center gap-1 truncate">
                <Lamp className="h-3 w-3 text-sky-300" />
                Arquiteto: {projeto.parceiro_nome}
              </p>
            ) : null}
          </div>

          <div
            className="mt-2 flex flex-wrap gap-1"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {canPegar && !emDesenho && kind !== 'feito' ? (
              <Button type="button" size="sm" className="h-7 px-2 text-[10px]" onClick={() => onPegar?.(projeto.id)}>
                Pegar para projetar
              </Button>
            ) : null}
            {canSoltar && emDesenho ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px]"
                onClick={() => onSoltar?.(projeto.id)}
              >
                Soltar
              </Button>
            ) : null}
            {canReabrir && kind === 'feito' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-[10px]"
                onClick={() => onReabrir?.(projeto.id)}
              >
                <RotateCcw className="h-3 w-3" />
                Reabrir
              </Button>
            ) : null}
            {canSolicitar && kind === 'feito' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-[10px]"
                onClick={() => onSolicitar?.(projeto)}
              >
                <Send className="h-3 w-3" />
                Solicitar novamente
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
