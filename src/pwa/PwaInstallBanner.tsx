import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PWA_CONFIG } from '@/pwa/pwa-config'

interface PwaInstallBannerProps {
  visible: boolean
  onInstall: () => void
  onDismiss: () => void
}

export function PwaInstallBanner({ visible, onInstall, onDismiss }: PwaInstallBannerProps) {
  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicativo"
      className="fixed inset-x-3 bottom-3 z-[9998] mx-auto max-w-lg animate-in slide-in-from-bottom-4 fade-in duration-300 safe-area-bottom-offset md:inset-x-auto md:right-6 md:bottom-6"
    >
      <div className="glass-card flex items-start gap-3 border-[rgba(212,168,83,0.35)] p-4 shadow-mogno-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(212,168,83,0.15)]">
          <Download className="h-5 w-5 text-[#d4a853]" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#f4e4d6]">Instalar {PWA_CONFIG.shortName}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#b8957f]">
            Use no celular como um app nativo — ícone na tela inicial, tela cheia e acesso rápido.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onInstall}>
              Instalar agora
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
              Agora não
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-[#8a6a55] transition-colors hover:bg-[rgba(212,168,83,0.1)] hover:text-[#dbb25a]"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
