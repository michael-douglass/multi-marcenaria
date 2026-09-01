import { QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CaixaQrTriggerProps {
  onClick: () => void
  className?: string
  title?: string
}

/** Botão compacto do Sistema de QR Code — um clique abre gerar/ler. */
export function CaixaQrTrigger({
  onClick,
  className,
  title = 'Sistema de QR Code',
}: CaixaQrTriggerProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label="Abrir sistema de QR Code"
      onClick={event => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        'border border-[#f2d892]/35 bg-gradient-to-br from-[#f2d892]/20 to-[#b88f44]/15',
        'text-[#f2d892] shadow-sm transition-all',
        'hover:border-[#f2d892]/60 hover:from-[#f2d892]/30 hover:to-[#b88f44]/25 hover:text-[#f8e6b0] hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d892]/40',
        'active:scale-[0.97]',
        className,
      )}
    >
      <QrCode className="h-4 w-4" />
    </button>
  )
}
