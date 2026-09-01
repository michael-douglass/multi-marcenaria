import { Pin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BibliotecaPinButtonProps {
  pinned: boolean
  onToggle: () => void
  label?: string
  tone?: 'paper' | 'dark'
}

/** Alfinete: no papel da casa ou no cartão escuro de eventos. */
export function BibliotecaPinButton({
  pinned,
  onToggle,
  label = 'Fixar nas favoritas',
  tone = 'paper',
}: BibliotecaPinButtonProps) {
  const isDark = tone === 'dark'
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
        'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
        isDark
          ? pinned
            ? 'border-amber-400/70 bg-amber-500/25 text-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.4)]'
            : 'border-white/10 bg-black/35 text-cream-faint backdrop-blur-sm hover:border-amber-400/40 hover:text-amber-100'
          : pinned
            ? 'border-[#6b3f12] bg-[#6b3f12] text-[#fffaf4] shadow-[0_0_14px_rgba(107,63,18,0.35)]'
            : 'border-[rgba(26,16,12,0.22)] bg-[#fffaf4]/90 text-[#6b5244] hover:border-[#6b3f12] hover:text-[#6b3f12]',
      )}
    >
      <Pin className={cn('h-3.5 w-3.5', pinned && 'fill-current')} />
    </button>
  )
}
