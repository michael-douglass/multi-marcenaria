import { useCallback, useEffect, useRef, useState } from 'react'

/** Tempo que Obras do Dia fica em tela cheia (ms). */
export const VIZ_OBRAS_DIA_SHOW_MS = 8_000

export function useVisualizacaoObrasDoDiaAutoFullscreen(enabled: boolean) {
  const [open, setOpen] = useState(false)
  const hideTimerRef = useRef<number | null>(null)

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const trigger = useCallback(() => {
    if (!enabled) return

    setOpen(true)
    clearHideTimer()
    hideTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      hideTimerRef.current = null
    }, VIZ_OBRAS_DIA_SHOW_MS)
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      clearHideTimer()
      setOpen(false)
    }
    return clearHideTimer
  }, [enabled])

  return { open, trigger }
}
