import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, Factory, GripVertical, Hourglass, Lamp, RotateCcw, Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeadLembretesPopover } from '@/components/agenda/LeadLembretesPopover'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  classifyProjetoStage,
  isProjetoEmDesenho,
  shouldPulseFeitoAwaitingOrcamento,
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
  /** Projetista admin: botão "Enviar para produção" nos cards feitos. */
  canEnviarProducao?: boolean
  naProducao?: boolean
  isEnviandoProducao?: boolean
  chatThread?: LeadProjetoChatThread | null
  lembretesCount?: number
  onOpen: (leadId: number) => void
  onPegar?: (projetoId: string) => void
  onSoltar?: (projetoId: string) => void
  onReabrir?: (projetoId: string) => void
  onSolicitar?: (projeto: LeadProjeto) => void
  onEnviarProducao?: (projeto: LeadProjeto) => void
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
  canEnviarProducao,
  naProducao,
  isEnviandoProducao,
  chatThread,
  lembretesCount = 0,
  onOpen,
  onPegar,
  onSoltar,
  onReabrir,
  onSolicitar,
  onEnviarProducao,
}: ProjetoKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: projeto.id,
  })
  const stage = stages.find((item) => item.id === projeto.stage_id)
  const kind = stage ? classifyProjetoStage(stage, stages) : 'other'
  const emDesenho = isProjetoEmDesenho(projeto) && kind !== 'feito'
  const devePulsarFeito =
    kind === 'feito' && shouldPulseFeitoAwaitingOrcamento(projeto.lead_status)
  const delay = Math.min(appearIndex, 8) * 40

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        animationDelay: `${delay}ms`,
        background: '#fffcf8',
        // Glow animado controla a sombra quando em desenho / pulso de Feitos.
        boxShadow:
          emDesenho || devePulsarFeito ? undefined : '0 8px 18px rgba(42, 24, 18, 0.1)',
      }}
      className={cn(
        'relative w-full cursor-pointer overflow-hidden rounded-lg border-2 border-[#c9a35a]/50 text-left text-[#2a1812] touch-manipulation',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[#c9a35a]',
        !isDragging && 'animate-in fade-in slide-in-from-top-2 duration-300 fill-mode-backwards',
        isDragging && 'z-50 scale-[1.03] rotate-1 ring-2 ring-sky-400/40',
        emDesenho && 'projeto-card-claimed',
        devePulsarFeito && 'projeto-card-feito-pulse',
      )}
      onClick={() => onOpen(projeto.lead_id)}
    >
      {emDesenho ? (
        <div
          className="projeto-card-claimed-rim flex items-center gap-2 border-b border-sky-400/30 bg-sky-50 px-2 py-1.5"
          role="status"
          aria-live="polite"
        >
          <ProjetoClaimedAura />
          <p className="min-w-0 font-display text-sm tracking-wide text-[#8d5e22]">
            Em desenho · {projeto.arquiteto_nome ?? 'projetista'}
          </p>
        </div>
      ) : kind === 'feito' ? (
        <div
          className={cn(
            'flex items-center gap-2 border-b border-emerald-500/25 bg-emerald-50/80 px-2 py-1.5',
            devePulsarFeito && 'projeto-card-feito-pulse-rim',
          )}
          role="status"
        >
          <p className="min-w-0 font-display text-sm tracking-wide text-emerald-800">
            Feito por {projeto.concluido_por_nome ?? 'Equipe'}
          </p>
        </div>
      ) : null}

      <div className="flex items-start gap-1.5 p-2.5 pl-3.5">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-[#8a7060] hover:bg-[#2a1812]/5"
          aria-label="Arrastar card"
          data-dnd-handle
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base leading-snug text-[#8d5e22]">{projeto.lead_nome}</p>
          {projeto.aguardando_resposta ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
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

          <div className="mt-2 space-y-0.5 text-[11px] text-[#6b5244]">
            <p className="flex items-center gap-1 truncate">
              <User className="h-3 w-3 text-[#8d5e22]" />
              Titular: {projeto.titular_nome ?? '—'}
            </p>
            {projeto.parceiro_nome ? (
              <p className="flex items-center gap-1 truncate">
                <Lamp className="h-3 w-3 text-sky-600" />
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
            {canEnviarProducao && kind === 'feito' ? (
              naProducao ? (
                <span
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-[#2d8c78]/30 bg-[#2d8c78]/10 px-2 text-[10px] font-semibold text-[#1f5f52]"
                  role="status"
                >
                  <Check className="h-3 w-3" />
                  Na produção
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 gap-1 bg-[#2d8c78] px-2 text-[10px] text-white hover:bg-[#247a68]"
                  disabled={isEnviandoProducao}
                  onClick={() => onEnviarProducao?.(projeto)}
                >
                  <Factory className="h-3 w-3" />
                  Enviar para produção
                </Button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
