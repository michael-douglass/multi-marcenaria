import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PwaUpdatePromptProps {
  visible: boolean
  onUpdate: () => void
  onDismiss: () => void
}

export function PwaUpdatePrompt({ visible, onUpdate, onDismiss }: PwaUpdatePromptProps) {
  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Atualização disponível"
      className="fixed inset-x-3 bottom-3 z-[9998] mx-auto max-w-lg animate-in slide-in-from-bottom-4 fade-in duration-300 safe-area-bottom-offset md:inset-x-auto md:right-6 md:bottom-6"
    >
      <div className="glass-card flex items-center gap-3 border-[rgba(240,210,140,0.35)] p-4 shadow-mogno-lg">
        <RefreshCw className="h-5 w-5 shrink-0 text-[#f2d892]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#fffaf4]">Nova versão disponível</p>
          <p className="text-xs text-[#d4bc9f]">Atualize para usar a versão mais recente do sistema.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" size="sm" onClick={onUpdate}>
            Atualizar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Depois
          </Button>
        </div>
      </div>
    </div>
  )
}
