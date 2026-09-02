import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckCircle2, GripVertical, MessageCircle, Play, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { classifyProducaoStage } from '@/lib/projetos-producao'
import type { ObraProducao, ProducaoChatThread, ProducaoStage } from '@/hooks/useObraProducao'
import '@/components/projetos-producao/producao-board.css'

interface ProducaoKanbanCardProps {
  card: ObraProducao
  stages: ProducaoStage[]
  appearIndex?: number
  currentUserId?: string | null
  canMover?: boolean
  chatThread?: ProducaoChatThread | null
  onOpen: (leadId: number) => void
  onIniciar?: (id: string) => void
  onConcluir?: (id: string) => void
  onOpenChat?: (card: ObraProducao) => void
}

export function ProducaoKanbanCard({
  card,
  stages,
  appearIndex = 0,
  canMover = true,
  chatThread,
  onOpen,
  onIniciar,
  onConcluir,
  onOpenChat,
}: ProducaoKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !canMover,
  })
  const stage = stages.find((item) => item.id === card.stage_id)
  const kind = stage ? classifyProducaoStage(stage, stages) : 'other'
  const delay = Math.min(appearIndex, 8) * 40
  const iniciado = Boolean(card.iniciado_em) && kind !== 'feito'

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        animationDelay: `${delay}ms`,
      }}
      className={cn(
        'producao-card-light relative w-full cursor-pointer overflow-hidden rounded-xl border border-[#2a3a36]/12 text-left text-[#24302c]',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[#2d8c78]',
        isDragging && 'z-50 scale-[1.03] rotate-1 ring-2 ring-[#2d8c78]/40',
        iniciado && 'producao-card-live border-[#2d8c78]/35',
      )}
      onClick={() => onOpen(card.lead_id)}
    >
      {iniciado ? (
        <div
          className="flex items-center gap-2 border-b border-[#2d8c78]/20 bg-[#e8f6f1] px-2.5 py-1.5"
          role="status"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#2d8c78]" aria-hidden />
          <p className="min-w-0 font-display text-sm tracking-wide text-[#1f5f52]">
            Em produção · {card.responsavel_nome ?? 'equipe'}
          </p>
        </div>
      ) : null}

      <div className="flex items-start gap-1.5 p-2.5 pl-3.5">
        {canMover ? (
          <button
            type="button"
            className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-[#6b7c76] hover:bg-[#2a3a36]/5"
            aria-label="Arrastar card"
            onClick={(event) => event.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base leading-snug text-[#1c2824]">{card.lead_nome}</p>
          {card.obra_cliente_nome && card.obra_cliente_nome !== card.lead_nome ? (
            <p className="mt-0.5 truncate text-[11px] text-[#6b7c76]">{card.obra_cliente_nome}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {chatThread ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#2d8c78]/25 bg-[#e8f6f1] px-1.5 py-0.5 text-[10px] font-medium text-[#1f5f52]">
                <MessageCircle className="h-2.5 w-2.5" />
                Chat
              </span>
            ) : null}
            {card.titular_nome ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#6b7c76]">
                <User className="h-2.5 w-2.5" />
                {card.titular_nome}
              </span>
            ) : null}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            {kind === 'pendente' && onIniciar ? (
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 bg-[#2d8c78] text-white shadow-sm hover:bg-[#247a68]"
                onClick={() => onIniciar(card.id)}
              >
                <Play className="h-3 w-3" />
                Iniciar
              </Button>
            ) : null}
            {kind === 'iniciado' && onConcluir ? (
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 bg-[#3f9a68] text-white shadow-sm hover:bg-[#348459]"
                onClick={() => onConcluir(card.id)}
              >
                <CheckCircle2 className="h-3 w-3" />
                Concluir
              </Button>
            ) : null}
            {onOpenChat ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 border-[#2a3a36]/18 bg-white/70 text-[#2a3a36] hover:bg-white"
                onClick={() => onOpenChat(card)}
              >
                <MessageCircle className="h-3 w-3" />
                Conversas
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
