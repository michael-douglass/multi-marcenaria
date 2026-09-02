import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import {
  LEAD_MODAL_SIZE_STORAGE_KEY,
  applyLeadModalResize,
  clampLeadModalSize,
  defaultLeadModalSize,
  parseLeadModalSize,
  readInitialLeadModalSize,
  type LeadModalSize,
  type LeadResizeEdge,
} from '@/lib/lead-modal-size'

/**
 * Tamanho do card do lead por usuário.
 * Salva no navegador na hora e no banco (para o mesmo tamanho em outro aparelho).
 */
export function useLeadModalSize(open: boolean) {
  const { user } = useAuth()
  const [size, setSize] = useState<LeadModalSize>(readInitialLeadModalSize)
  const [isResizing, setIsResizing] = useState(false)
  const sizeRef = useRef(size)
  const saveTimerRef = useRef<number | null>(null)
  const resizeRef = useRef<{
    edge: LeadResizeEdge
    startX: number
    startY: number
    startSize: LeadModalSize
  } | null>(null)

  useEffect(() => {
    sizeRef.current = size
  }, [size])

  const persistSize = useCallback(
    (next: LeadModalSize) => {
      const clamped = clampLeadModalSize(next)
      localStorage.setItem(LEAD_MODAL_SIZE_STORAGE_KEY, JSON.stringify(clamped))

      if (!user?.id) return

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => {
        void supabase
          .from('movelaria_ui_settings')
          .upsert({
            usuario_id: user.id,
            key: LEAD_MODAL_SIZE_STORAGE_KEY,
            value: clamped,
            atualizado_em: new Date().toISOString(),
          })
          .then(({ error }) => {
            if (error) console.error('[LeadModal] Erro ao salvar tamanho do card:', error)
          })
      }, 400)
    },
    [user?.id],
  )

  useEffect(() => {
    if (!user?.id || !open) return

    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('movelaria_ui_settings')
          .select('value')
          .eq('usuario_id', user.id)
          .eq('key', LEAD_MODAL_SIZE_STORAGE_KEY)
          .maybeSingle()

        if (cancelled) return
        if (error) throw error

        const parsed = parseLeadModalSize(data?.value)
        if (parsed) {
          setSize(parsed)
          localStorage.setItem(LEAD_MODAL_SIZE_STORAGE_KEY, JSON.stringify(parsed))
          return
        }

        const next = clampLeadModalSize(defaultLeadModalSize())
        setSize(next)
        persistSize(next)
      } catch (err) {
        console.error('[LeadModal] Erro ao carregar tamanho do card:', err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, open, persistSize])

  useEffect(() => {
    const onViewportResize = () => {
      setSize((prev) => {
        const next = clampLeadModalSize(prev)
        if (next.x !== prev.x || next.y !== prev.y || next.w !== prev.w || next.h !== prev.h) {
          localStorage.setItem(LEAD_MODAL_SIZE_STORAGE_KEY, JSON.stringify(next))
        }
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

  const beginResize = useCallback((edge: LeadResizeEdge, e: { preventDefault: () => void; stopPropagation: () => void; clientX: number; clientY: number }) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startSize: { ...sizeRef.current },
    }
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const onMove = (e: PointerEvent) => {
      const resize = resizeRef.current
      if (!resize) return
      const dx = e.clientX - resize.startX
      const dy = e.clientY - resize.startY
      setSize(applyLeadModalResize(resize.startSize, resize.edge, dx, dy))
    }

    const onUp = () => {
      persistSize(sizeRef.current)
      setIsResizing(false)
      resizeRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isResizing, persistSize])

  const resetSize = useCallback(() => {
    const next = clampLeadModalSize(defaultLeadModalSize())
    setSize(next)
    persistSize(next)
  }, [persistSize])

  return {
    size,
    isResizing,
    beginResize,
    resetSize,
  }
}
