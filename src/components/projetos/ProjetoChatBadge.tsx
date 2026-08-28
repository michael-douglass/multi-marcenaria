import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjetoChatBadgeProps {
  lastAutorId: string
  currentUserId?: string | null
  className?: string
}

export function ProjetoChatBadge({ lastAutorId, currentUserId, className }: ProjetoChatBadgeProps) {
  const fromOther = Boolean(currentUserId) && lastAutorId !== currentUserId

  return (
    <span
      className={cn(
        'relative inline-flex h-7 w-7 items-center justify-center rounded-full border',
        fromOther
          ? 'border-sky-400/50 bg-sky-950/50'
          : 'border-gold/40 bg-[#1a120e]',
        className,
      )}
      title={fromOther ? 'Nova mensagem no canal' : 'Canal do ateliê'}
    >
      {fromOther ? (
        <>
          <span className="absolute inset-0 animate-ping rounded-full bg-sky-400/30" />
          <span
            className="absolute inset-[-2px] rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, #7dd3fc, transparent 55%)',
              animation: 'spin 2.8s linear infinite',
            }}
          />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sky-400" />
        </>
      ) : null}
      <MessageSquare className={cn('relative h-3.5 w-3.5', fromOther ? 'text-sky-200' : 'text-gold')} />
    </span>
  )
}
