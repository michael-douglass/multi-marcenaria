import { useCallback, useEffect, useState } from 'react'
import { PWA_INSTALL_MIN_VISITS, PWA_STORAGE_KEYS } from '@/pwa/pwa-config'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function readVisitCount() {
  const raw = localStorage.getItem(PWA_STORAGE_KEYS.visitCount)
  const parsed = raw ? Number.parseInt(raw, 10) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

function isStandaloneDisplay() {
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  )
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplay)
  const [canPromptInstall, setCanPromptInstall] = useState(false)

  useEffect(() => {
    const visits = readVisitCount() + 1
    localStorage.setItem(PWA_STORAGE_KEYS.visitCount, String(visits))

    const dismissed = localStorage.getItem(PWA_STORAGE_KEYS.installDismissed) === '1'
    setCanPromptInstall(!dismissed && !isStandaloneDisplay() && visits >= PWA_INSTALL_MIN_VISITS)

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      setCanPromptInstall(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const dismissInstall = useCallback(() => {
    localStorage.setItem(PWA_STORAGE_KEYS.installDismissed, '1')
    setCanPromptInstall(false)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    setDeferredPrompt(null)

    if (outcome === 'accepted') {
      setIsInstalled(true)
      setCanPromptInstall(false)
      return true
    }

    return false
  }, [deferredPrompt])

  const showInstallBanner = Boolean(deferredPrompt) && canPromptInstall && !isInstalled

  return {
    isInstalled,
    showInstallBanner,
    canInstall: Boolean(deferredPrompt),
    promptInstall,
    dismissInstall,
  }
}
