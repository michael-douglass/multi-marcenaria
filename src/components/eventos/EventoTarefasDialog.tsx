import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useEventoTarefas } from '@/hooks/useEventoTarefas'
import { labelEventoQuando } from '@/lib/evento-helpers'
import { cn } from '@/lib/utils'

interface EventoTarefasDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventoId: string | null
  titulo: string
  dataEvento: string
}

export function EventoTarefasDialog({
  open,
  onOpenChange,
  eventoId,
  titulo,
  dataEvento,
}: EventoTarefasDialogProps) {
  const { tarefas, criar, toggle, excluir } = useEventoTarefas(open ? eventoId : null, {
    dataEvento,
    tituloEvento: titulo,
  })
  const [nova, setNova] = useState('')

  const add = async () => {
    const texto = nova.trim()
    if (!texto) return
    await criar.mutateAsync(texto)
    setNova('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Tarefas</DialogTitle>
          <DialogDescription className="sr-only">
            Checklist do evento. Cada tarefa também entra na Agenda no dia do evento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <p className="font-[Cormorant_Garamond] text-2xl text-[#f0d28c]">{labelEventoQuando(dataEvento)}</p>
          <p className="text-sm text-cream-muted">
            {labelEventoQuando(dataEvento)} · {titulo}
          </p>
          <p className="text-[11px] text-cream-faint">
            Incluir aqui também cria a tarefa na Agenda (dia do evento), com as mesmas opções da Agenda Pessoal.
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void add()
          }}
        >
          <Input
            aria-label="Nova tarefa"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Confirmar palco"
          />
          <button type="submit" className="btn btn-proforco btn-md" disabled={criar.isPending}>
            Incluir
          </button>
        </form>
        <ul className="space-y-2">
          {tarefas.length === 0 && (
            <li className="rounded-lg border border-dashed border-gold-border px-3 py-6 text-center text-sm text-cream-faint">
              Nenhuma tarefa ainda. Ao incluir, ela aparece também na Agenda no dia do evento.
            </li>
          )}
          {tarefas.map((tarefa) => (
            <li key={tarefa.id} className="flex items-center gap-2 rounded-lg border border-gold-border/40 px-2 py-2">
              <Checkbox
                checked={tarefa.concluida}
                onCheckedChange={(value) => toggle.mutate({ id: tarefa.id, concluida: value === true })}
                aria-label={tarefa.titulo}
              />
              <span className={cn('flex-1 text-sm', tarefa.concluida && 'text-cream-faint line-through')}>
                {tarefa.titulo}
              </span>
              <button
                type="button"
                className="text-cream-faint hover:text-red-400"
                aria-label="Excluir tarefa"
                onClick={() => excluir.mutate(tarefa.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
