import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FloatingProjetoChatAura } from '@/components/layout/FloatingProjetoChatAura'

interface FloatingProjetoChatIconProps {
  count: number
  onClick: () => void
  isActive?: boolean
}

export function FloatingProjetoChatIcon({
  count,
  onClick,
  isActive = false,
}: FloatingProjetoChatIconProps) {
  const hasUnread = count > 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex h-14 w-14 items-center justify-center rounded-full border-2',
        'bg-gradient-to-br from-[rgba(28,12,6,0.98)] to-[rgba(8,3,1,0.98)]',
        'shadow-[0_8px_28px_rgba(0,0,0,0.5)] transition-all duration-300',
        'hover:scale-105 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(125,211,252,0.55)]',
        isActive && 'scale-105',
      )}
      style={{
        borderColor: isActive
          ? '#7dd3fc'
          : hasUnread
            ? 'rgba(125,211,252,0.7)'
            : 'rgba(240,210,140,0.45)',
        boxShadow: isActive
          ? '0 0 28px rgba(125,211,252,0.35)'
          : hasUnread
            ? '0 0 22px rgba(125,211,252,0.28)'
            : undefined,
      }}
      title={
        isActive
          ? 'Fechar chat do ateliê'
          : hasUnread
            ? `${count} ${count === 1 ? 'mensagem' : 'mensagens'} não lida${count === 1 ? '' : 's'}`
            : 'Abrir chat do ateliê'
      }
      aria-label={isActive ? 'Fechar chat do ateliê' : 'Abrir chat do ateliê'}
      aria-pressed={isActive}
    >
      <FloatingProjetoChatAura className="opacity-90" />
      <MessageSquare className="relative h-6 w-6 text-[#e8f7fc]" />

      {hasUnread ? (
        <span
          className={cn(
            'absolute -top-1 -right-1 min-w-5 h-5 px-1.5',
            'flex items-center justify-center',
            'bg-sky-300 text-[#0c2a36]',
            'text-xs font-bold rounded-full',
            'border-2 border-[rgba(10,4,2,0.9)]',
            'animate-[pulse_2.4s_ease-in-out_infinite]',
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  )
}
