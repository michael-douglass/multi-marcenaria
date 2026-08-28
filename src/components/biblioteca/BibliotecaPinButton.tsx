import { Pin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BibliotecaPinButtonProps {
  pinned: boolean
  onToggle: () => void
  label?: string
}

/** Pino CSS compartilhado (sem WebGL). Fixado = âmbar + glow. */
export function BibliotecaPinButton({ pinned, onToggle, label = 'Fixar no topo' }: BibliotecaPinButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
        pinned
          ? 'border-amber-400/70 bg-amber-500/25 text-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.4)]'
          : 'border-white/10 bg-black/35 text-cream-faint backdrop-blur-sm hover:border-amber-400/40 hover:text-amber-100',
      )}
    >
      <Pin className={cn('h-4 w-4', pinned && 'fill-current')} />
    </button>
  )
}
