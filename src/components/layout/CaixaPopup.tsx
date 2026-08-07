import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Wallet, Maximize2, Minimize2, GripHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Caixa } from '@/pages/Caixa'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'
import {
  type CaixaPopupLayout,
  type CaixaResizeCorner,
  CAIXA_POPUP_STORAGE_KEY,
  CAIXA_POPUP_LEGACY_STORAGE_KEY,
  CAIXA_POPUP_LEGACY_LAYOUT_KEY,
  CAIXA_POPUP_MOBILE_BREAKPOINT,
  clampCaixaPopupLayout,
  defaultCaixaPopupLayout,
  readInitialCaixaPopupLayout,
  applyCaixaResize,
} from '@/lib/caixa-popup-layout'

interface CaixaPopupProps {
  open: boolean
  onClose: () => void
}

export function CaixaPopup({ open, onClose }: CaixaPopupProps) {
  const { userProfile } = useApp()
  const [layout, setLayout] = useState<CaixaPopupLayout>(readInitialCaixaPopupLayout)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < CAIXA_POPUP_MOBILE_BREAKPOINT,
  )

  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const resizeRef = useRef<{
    corner: CaixaResizeCorner
    startX: number
    startY: number
    startLayout: CaixaPopupLayout
  } | null>(null)
  const layoutRef = useRef(layout)
  const saveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  const persistLayout = useCallback(
    (next: CaixaPopupLayout) => {
      const clamped = clampCaixaPopupLayout(next)
      localStorage.setItem(CAIXA_POPUP_STORAGE_KEY, JSON.stringify(clamped))
      localStorage.removeItem(CAIXA_POPUP_LEGACY_STORAGE_KEY)
      localStorage.removeItem(CAIXA_POPUP_LEGACY_LAYOUT_KEY)
      localStorage.removeItem('caixa-contas-pagar-popup-layout')

      if (!userProfile?.id) return

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)

      saveTimerRef.current = window.setTimeout(() => {
        void supabase
          .from('movelaria_ui_settings')
          .upsert({
            usuario_id: userProfile.id,
            key: CAIXA_POPUP_STORAGE_KEY,
            value: clamped,
            atualizado_em: new Date().toISOString(),
          })
          .then(({ error }) => {
            if (error) console.error('[CaixaPopup] Erro ao salvar layout:', error)
          })
      }, 400)
    },
    [userProfile?.id],
  )

  useEffect(() => {
    if (!userProfile?.id || !open) return

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('movelaria_ui_settings')
          .select('value')
          .eq('usuario_id', userProfile.id)
          .eq('key', CAIXA_POPUP_STORAGE_KEY)
          .maybeSingle()

        if (error) throw error

        if (data?.value) {
          const next = clampCaixaPopupLayout(data.value as CaixaPopupLayout)
          setLayout(next)
          localStorage.setItem(CAIXA_POPUP_STORAGE_KEY, JSON.stringify(next))
          return
        }

        // Layout antigo (quase tela cheia): mantém só a posição e aplica tamanho novo (~metade).
        const base = defaultCaixaPopupLayout()
        const { data: legacyLayout } = await supabase
          .from('movelaria_ui_settings')
          .select('value')
          .eq('usuario_id', userProfile.id)
          .eq('key', CAIXA_POPUP_LEGACY_LAYOUT_KEY)
          .maybeSingle()

        const { data: legacyPosRow } = await supabase
          .from('movelaria_ui_settings')
          .select('value')
          .eq('usuario_id', userProfile.id)
          .eq('key', CAIXA_POPUP_LEGACY_STORAGE_KEY)
          .maybeSingle()

        const legacyVal = (legacyLayout?.value ?? legacyPosRow?.value) as
          | { x?: number; y?: number }
          | undefined

        if (legacyVal) {
          const next = clampCaixaPopupLayout({
            x: typeof legacyVal.x === 'number' ? legacyVal.x : base.x,
            y: typeof legacyVal.y === 'number' ? legacyVal.y : base.y,
            w: base.w,
            h: base.h,
          })
          setLayout(next)
          persistLayout(next)
        } else {
          const next = clampCaixaPopupLayout(base)
          setLayout(next)
          persistLayout(next)
        }
      } catch (err) {
        console.error('[CaixaPopup] Erro ao carregar layout:', err)
      }
    })()
  }, [userProfile?.id, open, persistLayout])

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < CAIXA_POPUP_MOBILE_BREAKPOINT
      setIsMobile(mobile)
      if (mobile) return
      setLayout(prev => {
        const next = clampCaixaPopupLayout(prev)
        if (
          next.x !== prev.x ||
          next.y !== prev.y ||
          next.w !== prev.w ||
          next.h !== prev.h
        ) {
          localStorage.setItem(CAIXA_POPUP_STORAGE_KEY, JSON.stringify(next))
        }
        return next
      })
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleDragStart = (e: React.PointerEvent) => {
    if (isMinimized || isMobile || isResizing) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    dragOffsetRef.current = {
      x: e.clientX - layout.x,
      y: e.clientY - layout.y,
    }
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handleResizeStart = (corner: CaixaResizeCorner) => (e: React.PointerEvent) => {
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
        const next = clampCaixaPopupLayout({
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
      setLayout(applyCaixaResize(resize.startLayout, resize.corner, dx, dy))
    }

    const onUp = () => {
      persistLayout(layoutRef.current)
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
    'absolute z-20 touch-none bg-transparent hover:bg-[rgba(240,210,140,0.14)]'

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
      aria-label="Caixa de Pagamentos"
      data-caixa-popup
      data-caixa-popup-w={!isMobile && !isMinimized ? layout.w : undefined}
      data-caixa-popup-h={!isMobile && !isMinimized ? layout.h : undefined}
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
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(240,210,140,0.12)] text-[#f2d892] ring-1 ring-[rgba(240,210,140,0.22)] sm:h-8 sm:w-8">
              <Wallet size={16} className="sm:hidden" />
              <Wallet size={18} className="hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display truncate text-xs tracking-widest text-[#f2d892] sm:text-sm">
                CAIXA DE PAGAMENTOS
              </h3>
              {!isMinimized && (
                <p className="truncate text-[0.6rem] text-[#edd9c4] sm:text-[0.65rem]">
                  Arraste · redimensione pelas bordas se precisar
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
            <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden p-2.5 sm:p-3">
              <Caixa embedded />
            </div>
          </div>
        )}

        {!isMobile && !isMinimized && (
          <>
            <div className="flex h-5 shrink-0 items-center justify-center border-t border-[rgba(240,210,140,0.08)] bg-[rgba(10,4,2,0.6)]">
              <GripHorizontal size={12} className="text-[rgba(240,210,140,0.35)]" />
            </div>

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
              <span className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-[rgba(240,210,140,0.55)]" />
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
