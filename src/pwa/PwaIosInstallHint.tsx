import { Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PWA_CONFIG, PWA_INSTALL_MIN_VISITS, PWA_STORAGE_KEYS } from '@/pwa/pwa-config'

function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  return isIos && !isStandalone
}

function canShowIosHint() {
  if (!isIosSafari()) return false
  if (localStorage.getItem(PWA_STORAGE_KEYS.installDismissed) === '1') return false
  const visits = Number.parseInt(localStorage.getItem(PWA_STORAGE_KEYS.visitCount) ?? '0', 10)
  return visits >= PWA_INSTALL_MIN_VISITS
}

export function PwaIosInstallHint() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(canShowIosHint())
  }, [])

  function dismiss() {
    localStorage.setItem(PWA_STORAGE_KEYS.installDismissed, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Instalar no iPhone"
      className="fixed inset-x-3 bottom-3 z-[9998] mx-auto max-w-lg animate-in slide-in-from-bottom-4 fade-in duration-300 safe-area-bottom-offset md:hidden"
    >
      <div className="glass-card border-[rgba(240,210,140,0.35)] p-4 shadow-mogno-lg">
        <div className="flex items-start gap-3">
          <Share className="mt-0.5 h-5 w-5 shrink-0 text-[#f2d892]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#fffaf4]">Instalar {PWA_CONFIG.shortName} no iPhone</p>
            <p className="mt-1 text-xs leading-relaxed text-[#d4bc9f]">
              Toque em <strong className="text-[#f2d892]">Compartilhar</strong> na barra do Safari e escolha{' '}
              <strong className="text-[#f2d892]">Adicionar à Tela de Início</strong>.
            </p>
            <Button type="button" size="sm" variant="ghost" className="mt-3" onClick={dismiss}>
              Entendi
            </Button>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-md p-1 text-[#edd9c4] transition-colors hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f5e0a8]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
