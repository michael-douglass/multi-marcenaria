import { Compass } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjetoSignalTone } from '@/lib/projetos-atelie'

interface KanbanProjetoSignalProps {
  tone: ProjetoSignalTone
}

const COPY: Record<ProjetoSignalTone, string> = {
  waiting: 'Aguardando projetista',
  active: 'Em desenho agora',
  done: 'Projeto feito',
}

export function KanbanProjetoSignal({ tone }: KanbanProjetoSignalProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
        tone === 'waiting' && 'animate-pulse border-amber-400/40 bg-amber-400/10 text-amber-300',
        tone === 'active' && 'border-sky-400/40 bg-sky-950/40 text-sky-200',
        tone === 'done' && 'border-gold/40 bg-gold/10 text-gold',
      )}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <span
          className={cn(
            'absolute inset-0 rounded-full',
            tone === 'waiting' && 'bg-amber-400/30',
            tone === 'active' && 'animate-[spin_9s_linear_infinite]',
            tone === 'done' && 'bg-gold/25',
          )}
          style={
            tone === 'active'
              ? { background: 'conic-gradient(from 0deg, #7dd3fc, transparent 70%)' }
              : undefined
          }
        />
        <Compass className="relative h-3 w-3" aria-hidden />
      </span>
      {COPY[tone]}
    </span>
  )
}
