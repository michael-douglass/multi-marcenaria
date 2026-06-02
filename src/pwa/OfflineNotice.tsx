import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/pwa/useOnlineStatus'

export function OfflineNotice() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 bg-[rgba(180,40,20,0.95)] px-4 py-2 text-center text-xs font-semibold text-[#fde8e0] backdrop-blur-sm safe-area-top-offset"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Sem conexão — algumas funções podem não funcionar até a internet voltar.
    </div>
  )
}
