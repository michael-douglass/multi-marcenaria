import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import {
  LEAD_MODAL_SIZE_STORAGE_KEY,
  applyLeadModalResize,
  clampLeadModalSize,
  isLeadModalMobileViewport,
  maximizedLeadModalSize,
  readInitialLeadModalLayout,
  resolveLeadModalDisplaySize,
  restoredLeadModalSize,
  type LeadModalLayout,
  type LeadResizeEdge,
} from '@/lib/lead-modal-size'
import { isTouchUiViewport } from '@/lib/viewport-ui'

/** Sempre abre em tamanho reduzido (janela média). Maximizar fica no botão □. */
function openingLeadModalLayout(): LeadModalLayout {
  return { ...restoredLeadModalSize(), mode: 'restored' }
}

/**
 * Janela do card do lead por usuário.
 * Abertura: sempre tamanho reduzido (restored).
 * Controles estilo Windows: minimizar, maximizar/restaurar, redimensionar pelas bordas.
 */
export function useLeadModalSize(open: boolean) {
  const { user } = useAuth()
  const [layout, setLayout] = useState<LeadModalLayout>(() => {
    if (open) return openingLeadModalLayout()
    return readInitialLeadModalLayout()
  })
  const [isResizing, setIsResizing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const layoutRef = useRef(layout)
  const saveTimerRef = useRef<number | null>(null)
  const resizeRef = useRef<{
    edge: LeadResizeEdge
    startX: number
    startY: number
    startSize: LeadModalLayout
  } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  )
  const hydratedRef = useRef(false)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  const displaySize = useMemo(() => resolveLeadModalDisplaySize(layout), [layout])

  const persistLayout = useCallback(
    (next: LeadModalLayout) => {
      const normalized: LeadModalLayout =
        next.mode === 'maximized'
          ? { ...maximizedLeadModalSize(), mode: 'maximized' }
          : { ...clampLeadModalSize(next), mode: next.mode }

      localStorage.setItem(LEAD_MODAL_SIZE_STORAGE_KEY, JSON.stringify(normalized))

      if (!user?.id) return

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => {
        void supabase
          .from('movelaria_ui_settings')
          .upsert({
            usuario_id: user.id,
            key: LEAD_MODAL_SIZE_STORAGE_KEY,
            value: normalized,
            atualizado_em: new Date().toISOString(),
          })
          .then(({ error }) => {
            if (error) console.error('[LeadModal] Erro ao salvar tamanho do card:', error)
          })
      }, 400)
    },
    [user?.id],
  )

  const commitLayout = useCallback(
    (next: LeadModalLayout) => {
      setLayout(next)
      persistLayout(next)
    },
    [persistLayout],
  )

  // Antes do paint: ao abrir, força janela reduzida (nunca tela cheia).
  useLayoutEffect(() => {
    if (!open) {
      hydratedRef.current = false
      wasOpenRef.current = false
      return
    }

    // Só na transição fechado → aberto (não desfaz um maximizar manual).
    if (wasOpenRef.current) return
    wasOpenRef.current = true

    const next = openingLeadModalLayout()
    layoutRef.current = next
    setLayout(next)
    persistLayout(next)
    hydratedRef.current = true
  }, [open, persistLayout])

  useEffect(() => {
    if (!open || !user?.id || !hydratedRef.current) return

    const next = layoutRef.current.mode === 'restored'
      ? layoutRef.current
      : openingLeadModalLayout()

    void supabase
      .from('movelaria_ui_settings')
      .upsert({
        usuario_id: user.id,
        key: LEAD_MODAL_SIZE_STORAGE_KEY,
        value: next,
        atualizado_em: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error('[LeadModal] Erro ao sincronizar tamanho do card:', error)
      })
  }, [open, user?.id])

  useEffect(() => {
    let lastWidth = typeof window !== 'undefined' ? window.innerWidth : 0

    const onViewportResize = () => {
      const vw = window.innerWidth
      const widthChanged = Math.abs(vw - lastWidth) >= 2
      lastWidth = vw

      setLayout((prev) => {
        if (prev.mode === 'maximized') {
          // Celular/tablet toque (Tab S9 Ultra incluso): barra do navegador muda só a altura.
          // Só recalcula o maximizado quando a largura muda (rotação / split view).
          if ((isLeadModalMobileViewport(vw) || isTouchUiViewport()) && !widthChanged) {
            return prev
          }
          if (!widthChanged && (vw <= 1024 || isTouchUiViewport())) {
            const nextProbe = maximizedLeadModalSize()
            if (Math.abs(nextProbe.h - prev.h) < 64 && Math.abs(nextProbe.w - prev.w) < 2) {
              return prev
            }
          }
          const next = { ...maximizedLeadModalSize(), mode: 'maximized' as const }
          localStorage.setItem(LEAD_MODAL_SIZE_STORAGE_KEY, JSON.stringify(next))
          return next
        }
        const next = { ...clampLeadModalSize(prev), mode: prev.mode }
        localStorage.setItem(LEAD_MODAL_SIZE_STORAGE_KEY, JSON.stringify(next))
        return next
      })
    }
    window.addEventListener('resize', onViewportResize)
    return () => window.removeEventListener('resize', onViewportResize)
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [])

  const beginResize = useCallback(
    (
      edge: LeadResizeEdge,
      e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number },
    ) => {
      if (layoutRef.current.mode === 'minimized') return
      e.preventDefault()
      e.stopPropagation()
      const current =
        layoutRef.current.mode === 'maximized'
          ? { ...maximizedLeadModalSize(), mode: 'restored' as const }
          : { ...layoutRef.current, mode: 'restored' as const }
      resizeRef.current = {
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startSize: current,
      }
      setLayout(current)
      setIsResizing(true)
    },
    [],
  )

  const beginDrag = useCallback((e: { preventDefault: () => void; clientX: number; clientY: number }) => {
    if (layoutRef.current.mode === 'maximized') return
    e.preventDefault()
    const display = resolveLeadModalDisplaySize(layoutRef.current)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: display.x,
      originY: display.y,
    }
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isResizing && !isDragging) return

    const onMove = (e: PointerEvent) => {
      if (isDragging && dragRef.current) {
        const dx = e.clientX - dragRef.current.startX
        const dy = e.clientY - dragRef.current.startY
        setLayout((prev) => {
          const base = resolveLeadModalDisplaySize(prev)
          return {
            ...prev,
            mode: prev.mode === 'minimized' ? 'minimized' : 'restored',
            ...clampLeadModalSize({
              x: dragRef.current!.originX + dx,
              y: dragRef.current!.originY + dy,
              w: base.w,
              h: base.h,
            }),
          }
        })
        return
      }

      const resize = resizeRef.current
      if (!resize) return
      const dx = e.clientX - resize.startX
      const dy = e.clientY - resize.startY
      const nextSize = applyLeadModalResize(resize.startSize, resize.edge, dx, dy)
      setLayout({ ...nextSize, mode: 'restored' })
    }

    const onUp = () => {
      persistLayout(layoutRef.current)
      setIsResizing(false)
      setIsDragging(false)
      resizeRef.current = null
      dragRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isResizing, isDragging, persistLayout])

  const maximize = useCallback(() => {
    commitLayout({ ...maximizedLeadModalSize(), mode: 'maximized' })
  }, [commitLayout])

  const restore = useCallback(() => {
    const prev = layoutRef.current
    const size =
      prev.mode === 'maximized' || prev.mode === 'minimized'
        ? restoredLeadModalSize()
        : clampLeadModalSize(prev)
    commitLayout({ ...size, mode: 'restored' })
  }, [commitLayout])

  const minimize = useCallback(() => {
    const prev = layoutRef.current
    const base =
      prev.mode === 'maximized' ? restoredLeadModalSize() : clampLeadModalSize(prev)
    commitLayout({ ...base, mode: 'minimized' })
  }, [commitLayout])

  const toggleMaximize = useCallback(() => {
    if (layoutRef.current.mode === 'maximized') restore()
    else maximize()
  }, [maximize, restore])

  const resetSize = useCallback(() => {
    maximize()
  }, [maximize])

  return {
    size: displaySize,
    layout,
    mode: layout.mode,
    isResizing,
    isDragging,
    beginResize,
    beginDrag,
    maximize,
    restore,
    minimize,
    toggleMaximize,
    resetSize,
  }
}
