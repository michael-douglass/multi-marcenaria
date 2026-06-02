import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { PwaIosInstallHint } from '@/pwa/PwaIosInstallHint'
import { OfflineNotice } from '@/pwa/OfflineNotice'
import { PwaInstallBanner } from '@/pwa/PwaInstallBanner'
import { PwaUpdatePrompt } from '@/pwa/PwaUpdatePrompt'
import { usePwaInstall } from '@/pwa/usePwaInstall'

export function PwaManager() {
  const { showInstallBanner, promptInstall, dismissInstall } = usePwaInstall()
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateServiceWorkerRef = useRef<((reload?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    let intervalId: number | undefined

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onRegistered(registration) {
        if (!registration) return

        intervalId = window.setInterval(() => {
          void registration.update()
        }, 60 * 60 * 1000)
      },
      onRegisterError(error) {
        console.error('[PWA] Falha ao registrar service worker:', error)
      },
    })

    updateServiceWorkerRef.current = updateSW

    return () => {
      if (intervalId != null) window.clearInterval(intervalId)
    }
  }, [])

  async function handleUpdate() {
    if (updateServiceWorkerRef.current) {
      await updateServiceWorkerRef.current(true)
    }
    setNeedRefresh(false)
  }

  return (
    <>
      <OfflineNotice />
      <PwaInstallBanner
        visible={showInstallBanner && !needRefresh}
        onInstall={() => void promptInstall()}
        onDismiss={dismissInstall}
      />
      <PwaIosInstallHint />
      <PwaUpdatePrompt
        visible={needRefresh}
        onUpdate={() => void handleUpdate()}
        onDismiss={() => setNeedRefresh(false)}
      />
    </>
  )
}
