import { useState } from 'react'
import { MoreHorizontal, ListChecks, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BibliotecaPinButton } from '@/components/biblioteca/BibliotecaPinButton'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  formatarMoedaEvento,
  formatDataEventoIso,
  labelEventoQuando,
  parseDataEventoLocal,
} from '@/lib/evento-helpers'
import type { EventoPastaCard } from '@/lib/evento-types'
import { cn } from '@/lib/utils'

interface EventoFolderCardProps {
  pasta: EventoPastaCard
  onOpen: () => void
  onPin: () => void
  onTarefas: () => void
  onEdit: () => void
  onDelete: () => void
  onChangeDate: (iso: string) => void
}

export function EventoFolderCard({
  pasta,
  onOpen,
  onPin,
  onTarefas,
  onEdit,
  onDelete,
  onChangeDate,
}: EventoFolderCardProps) {
  const [calOpen, setCalOpen] = useState(false)
  const data = parseDataEventoLocal(pasta.data_evento)
  const mesAno = format(data, "MMMM · yyyy", { locale: ptBR })

  return (
    <article
      className={cn(
        'group relative animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-2xl overflow-hidden',
        pasta.fixado && 'border border-amber-400/70 shadow-[0_0_28px_rgba(245,158,11,0.18)]',
      )}
    >
      {pasta.fixado && <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-[#f0d28c]" />}
      <div
        className="relative isolate transition-transform duration-300 group-hover:-translate-y-1"
        style={{
          background: 'linear-gradient(165deg, rgba(92,64,48,0.98), #2a1812 48%, #1c100c)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(240,210,140,0.9) 0 1px, transparent 1px 12px), repeating-linear-gradient(90deg, rgba(240,210,140,0.9) 0 1px, transparent 1px 11px)',
          }}
        />
        <div
          className="absolute -top-px left-5 z-10 rounded-b-md px-3 py-1 text-[10px] font-bold tracking-[0.22em] text-[#2a1812]"
          style={{ background: 'linear-gradient(180deg, #f0d28c, #c9a07b)' }}
        >
          PASTA
        </div>

        <div className="relative z-10 flex items-start justify-between gap-2 px-4 pb-2 pt-8">
          <BibliotecaPinButton pinned={pasta.fixado} onToggle={onPin} />
          <div className="flex items-center gap-1">
            {pasta.tarefas_pendentes > 0 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onTarefas()
                }}
                className="rounded-full bg-amber-500/25 px-2.5 py-1 text-[11px] font-semibold text-amber-200"
              >
                {pasta.tarefas_pendentes} {pasta.tarefas_pendentes === 1 ? 'tarefa' : 'tarefas'}
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Mais ações da pasta"
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-cream-faint hover:bg-white/10 hover:text-gold"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem onClick={onPin}>{pasta.fixado ? 'Soltar pin' : 'Fixar no topo'}</DropdownMenuItem>
                <DropdownMenuItem onClick={onTarefas}>
                  <ListChecks className="mr-2 h-4 w-4" />
                  Tarefas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-400" onClick={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              className="relative z-10 block w-full px-5 pb-1 text-left"
              aria-label="Alterar data do evento"
            >
              <div
                className="font-display text-[42px] leading-none tracking-wide text-[#f0d28c]"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                {format(data, 'dd')}
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-cream-faint">{mesAno}</p>
              <p className="mt-1 text-sm text-gold/90">{labelEventoQuando(pasta.data_evento)}</p>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" onClick={(event) => event.stopPropagation()}>
            <Calendar
              mode="single"
              selected={data}
              onSelect={(next) => {
                if (!next) return
                onChangeDate(formatDataEventoIso(next))
                setCalOpen(false)
              }}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        <button type="button" onClick={onOpen} className="relative z-10 w-full px-5 pb-5 pt-3 text-left">
          <h3 className="title-page text-2xl leading-none">{pasta.titulo}</h3>
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.14em] text-cream-muted">
            <span>{pasta.pessoas} {pasta.pessoas === 1 ? 'pessoa' : 'pessoas'}</span>
            <span>{pasta.itens} {pasta.itens === 1 ? 'item' : 'itens'}</span>
            <span className="text-gold">{formatarMoedaEvento(pasta.valor_estimado)}</span>
          </div>
        </button>
      </div>
    </article>
  )
}
