import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, BarChart3, Maximize2, Minimize2, GripHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MetricasObras } from '@/pages/MetricasObras'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

interface PopupLayout {
  x: number
  y: number
  w: number
  h: number
}

interface MetricasObrasPopupProps {
  open: boolean
  onClose: () => void
}

const STORAGE_KEY = 'metricas-obras-popup-layout'
const LEGACY_STORAGE_KEY = 'metricas-obras-popup-position'

const MIN_W = 360
const MIN_H = 280
const MOBILE_BREAKPOINT = 768

function defaultLayout(): PopupLayout {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const w = Math.min(720, Math.max(MIN_W, Math.round(vw * 0.55)))
  const h = Math.min(520, Math.max(MIN_H, Math.round(vh * 0.62)))
  return {
    x: Math.max(16, vw - w - 96),
    y: Math.max(72, Math.round((vh - h) / 2)),
    w,
    h,
  }
}

function clampLayout(layout: PopupLayout): PopupLayout {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxW = Math.max(MIN_W, vw - 16)
  const maxH = Math.max(MIN_H, vh - 16)
  const w = Math.min(Math.max(layout.w, MIN_W), maxW)
  const h = Math.min(Math.max(layout.h, MIN_H), maxH)
  const x = Math.min(Math.max(layout.x, 0), Math.max(0, vw - w))
  const y = Math.min(Math.max(layout.y, 0), Math.max(0, vh - h))
  return { x, y, w, h }
}

function parseStoredLayout(raw: string | null): PopupLayout | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PopupLayout>
    if (
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number'
    ) {
      return null
    }
    const base = defaultLayout()
    return clampLayout({
      x: parsed.x,
      y: parsed.y,
      w: typeof parsed.w === 'number' ? parsed.w : base.w,
      h: typeof parsed.h === 'number' ? parsed.h : base.h,
    })
  } catch {
    return null
  }
}

function readInitialLayout(): PopupLayout {
  if (typeof window === 'undefined') return { x: 60, y: 64, w: 720, h: 520 }
  return (
    parseStoredLayout(localStorage.getItem(STORAGE_KEY))
    ?? parseStoredLayout(localStorage.getItem(LEGACY_STORAGE_KEY))
    ?? clampLayout(defaultLayout())
  )
}

type ResizeCorner = 'se' | 'sw' | 'ne' | 'nw' | 'e' | 's' | 'w' | 'n'

export function MetricasObrasPopup({ open, onClose }: MetricasObrasPopupProps) {
  const { userProfile } = useApp()
  const [layout, setLayout] = useState<PopupLayout>(readInitialLayout)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  )

  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const resizeRef = useRef<{
    corner: ResizeCorner
    startX: number
    startY: number
    startLayout: PopupLayout
  } | null>(null)
  const layoutRef = useRef(layout)
  const saveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  const persistLayout = useCallback(
    (next: PopupLayout) => {
      const clamped = clampLayout(next)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped))
      // limpa chave antiga se existir
      localStorage.removeItem(LEGACY_STORAGE_KEY)

      if (!userProfile?.id) return

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)

      saveTimerRef.current = window.setTimeout(() => {
        void supabase
          .from('movelaria_ui_settings')
          .upsert({
            usuario_id: userProfile.id,
            key: STORAGE_KEY,
            value: clamped,
            atualizado_em: new Date().toISOString(),
          })
          .then(({ error }) => {
            if (error) console.error('[MetricasObrasPopup] Erro ao salvar layout:', error)
          })
      }, 400)
    },
    [userProfile?.id],
  )

  // Carrega layout salvo no Supabase (posição + tamanho)
  useEffect(() => {
    if (!userProfile?.id || !open) return

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('movelaria_ui_settings')
          .select('value')
          .eq('usuario_id', userProfile.id)
          .eq('key', STORAGE_KEY)
          .maybeSingle()

        if (error) throw error

        if (data?.value) {
          const next = clampLayout(data.value as PopupLayout)
          setLayout(next)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
          return
        }

        // fallback: chave antiga só com x/y
        const { data: legacy } = await supabase
          .from('movelaria_ui_settings')
          .select('value')
          .eq('usuario_id', userProfile.id)
          .eq('key', LEGACY_STORAGE_KEY)
          .maybeSingle()

        if (legacy?.value) {
          const base = defaultLayout()
          const legacyPos = legacy.value as { x?: number; y?: number }
          const next = clampLayout({
            x: typeof legacyPos.x === 'number' ? legacyPos.x : base.x,
            y: typeof legacyPos.y === 'number' ? legacyPos.y : base.y,
            w: base.w,
            h: base.h,
          })
          setLayout(next)
          persistLayout(next)
        }
      } catch (err) {
        console.error('[MetricasObrasPopup] Erro ao carregar layout:', err)
      }
    })()
  }, [userProfile?.id, open, persistLayout])

  // Responsivo: ao redimensionar a janela, mantém o popup dentro da tela
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(mobile)
      if (mobile) return
      setLayout(prev => {
        const next = clampLayout(prev)
        if (
          next.x !== prev.x ||
          next.y !== prev.y ||
          next.w !== prev.w ||
          next.h !== prev.h
        ) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        }
        return next
      })
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleDragStart = (e: React.PointerEvent) => {
    if (isMinimized || isMobile || isResizing) return
    // não iniciar drag em botões
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    dragOffsetRef.current = {
      x: e.clientX - layout.x,
      y: e.clientY - layout.y,
    }
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handleResizeStart = (corner: ResizeCorner) => (e: React.PointerEvent) => {
    if (isMinimized || isMobile) return
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startLayout: { ...layoutRef.current },
    }
    setIsResizing(true)
  }

  useEffect(() => {
    if (!isDragging && !isResizing) return

    const onMove = (e: PointerEvent) => {
      if (isDragging) {
        const next = clampLayout({
          ...layoutRef.current,
          x: e.clientX - dragOffsetRef.current.x,
          y: e.clientY - dragOffsetRef.current.y,
        })
        setLayout(next)
        return
      }

      const resize = resizeRef.current
      if (!resize) return

      const dx = e.clientX - resize.startX
      const dy = e.clientY - resize.startY
      const { startLayout: s, corner } = resize
      let next: PopupLayout = { ...s }

      if (corner.includes('e')) next.w = s.w + dx
      if (corner.includes('s')) next.h = s.h + dy
      if (corner.includes('w')) {
        next.w = s.w - dx
        next.x = s.x + dx
      }
      if (corner.includes('n')) {
        next.h = s.h - dy
        next.y = s.y + dy
      }

      // Impede colapso abaixo do mínimo ajustando posição
      if (next.w < MIN_W) {
        if (corner.includes('w')) next.x = s.x + s.w - MIN_W
        next.w = MIN_W
      }
      if (next.h < MIN_H) {
        if (corner.includes('n')) next.y = s.y + s.h - MIN_H
        next.h = MIN_H
      }

      setLayout(clampLayout(next))
    }

    const onUp = () => {
      const current = layoutRef.current
      persistLayout(current)
      setIsDragging(false)
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
  }, [isDragging, isResizing, persistLayout])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleStyle =
    'absolute z-20 touch-none bg-transparent hover:bg-[rgba(74,222,128,0.18)]'

  return createPortal(
    <div
      className={cn(
        'fixed z-[110] animate-in fade-in zoom-in-95 duration-300 ease-out',
        isMobile ? 'inset-0' : '',
        (isDragging || isResizing) && 'select-none',
      )}
      style={
        !isMobile
          ? {
              left: layout.x,
              top: layout.y,
              width: isMinimized ? 280 : layout.w,
              height: isMinimized ? 'auto' : layout.h,
              maxWidth: 'calc(100vw - 8px)',
              maxHeight: 'calc(100vh - 8px)',
            }
          : undefined
      }
      role="dialog"
      aria-modal="true"
      aria-label="Métricas de Obras"
    >
      <div
        className={cn(
          'relative flex h-full w-full flex-col overflow-hidden glass-panel border border-[rgba(240,210,140,0.3)] shadow-2xl',
          isDragging && 'cursor-grabbing',
          isResizing && 'cursor-nwse-resize',
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-between border-b border-[rgba(240,210,140,0.18)] bg-[rgba(10,4,2,0.85)] px-3 py-2.5 sm:px-4 sm:py-3',
            !isMobile && 'cursor-grab active:cursor-grabbing select-none',
          )}
          onPointerDown={!isMobile ? handleDragStart : undefined}
        >
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(74,222,128,0.12)] text-[#86efac] ring-1 ring-[rgba(74,222,128,0.25)] sm:h-8 sm:w-8">
              <BarChart3 size={16} className="sm:hidden" />
              <BarChart3 size={18} className="hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display truncate text-xs tracking-widest text-[#f2d892] sm:text-sm">
                MÉTRICAS DE OBRAS
              </h3>
              {!isMinimized && (
                <p className="truncate text-[0.6rem] text-[#edd9c4] sm:text-[0.65rem]">
                  Arraste · redimensione pelas bordas · posição salva
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {!isMobile && (
              <button
                type="button"
                onClick={() => setIsMinimized(v => !v)}
                className="rounded-md p-1.5 text-[#edd9c4] transition-colors hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f5e0a8]"
                title={isMinimized ? 'Restaurar' : 'Minimizar'}
              >
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[#edd9c4] transition-colors hover:bg-[rgba(255,0,0,0.1)] hover:text-red-400"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="relative min-h-0 flex-1 overflow-hidden bg-[rgba(52,34,26,0.4)]">
            <div className="absolute inset-0 overflow-auto p-2 sm:p-3">
              <MetricasObras embedded />
            </div>
          </div>
        )}

        {!isMobile && !isMinimized && (
          <>
            <div className="flex h-5 shrink-0 items-center justify-center border-t border-[rgba(240,210,140,0.08)] bg-[rgba(10,4,2,0.6)]">
              <GripHorizontal size={12} className="text-[rgba(240,210,140,0.35)]" />
            </div>

            {/* Alças de redimensionamento */}
            <div
              className={cn(handleStyle, 'right-0 top-8 bottom-5 w-1.5 cursor-ew-resize')}
              onPointerDown={handleResizeStart('e')}
              aria-hidden
            />
            <div
              className={cn(handleStyle, 'left-0 top-8 bottom-5 w-1.5 cursor-ew-resize')}
              onPointerDown={handleResizeStart('w')}
              aria-hidden
            />
            <div
              className={cn(handleStyle, 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize')}
              onPointerDown={handleResizeStart('s')}
              aria-hidden
            />
            <div
              className={cn(handleStyle, 'top-0 left-3 right-3 h-1.5 cursor-ns-resize')}
              onPointerDown={handleResizeStart('n')}
              aria-hidden
            />
            <div
              className={cn(handleStyle, 'bottom-0 right-0 h-4 w-4 cursor-nwse-resize')}
              onPointerDown={handleResizeStart('se')}
              title="Redimensionar"
              aria-hidden
            >
              <span className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-[rgba(134,239,172,0.55)]" />
            </div>
            <div
              className={cn(handleStyle, 'bottom-0 left-0 h-4 w-4 cursor-nesw-resize')}
              onPointerDown={handleResizeStart('sw')}
              aria-hidden
            />
            <div
              className={cn(handleStyle, 'top-0 right-0 h-4 w-4 cursor-nesw-resize')}
              onPointerDown={handleResizeStart('ne')}
              aria-hidden
            />
            <div
              className={cn(handleStyle, 'top-0 left-0 h-4 w-4 cursor-nwse-resize')}
              onPointerDown={handleResizeStart('nw')}
              aria-hidden
            />
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
