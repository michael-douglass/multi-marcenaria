import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Wallet, Maximize2, Minimize2, GripHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Caixa } from '@/pages/Caixa'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

interface Position {
  x: number
  y: number
}

interface CaixaPopupProps {
  open: boolean
  onClose: () => void
}

const STORAGE_KEY = 'caixa-contas-pagar-popup-position'

export function CaixaPopup({ open, onClose }: CaixaPopupProps) {
  const { userProfile } = useApp()
  const [position, setPosition] = useState<Position>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as Position) : { x: 80, y: 72 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [isMinimized, setIsMinimized] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<number | null>(null)

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
          setPosition(data.value as Position)
        }
      } catch (err) {
        console.error('[CaixaPopup] Erro ao carregar posição:', err)
      }
    })()
  }, [userProfile?.id, open])

  const persistPosition = useCallback(
    (pos: Position) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))

      if (!userProfile?.id) return

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)

      saveTimerRef.current = window.setTimeout(() => {
        void supabase
          .from('movelaria_ui_settings')
          .upsert({
            usuario_id: userProfile.id,
            key: STORAGE_KEY,
            value: pos,
            atualizado_em: new Date().toISOString(),
          })
          .then(({ error }) => {
            if (error) console.error('[CaixaPopup] Erro ao salvar posição:', error)
          })
      }, 1000)
    },
    [userProfile?.id],
  )

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isMinimized) return
    e.preventDefault()
    const rect = popupRef.current?.getBoundingClientRect()
    if (rect) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return

      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y

      const maxX = window.innerWidth - (popupRef.current?.offsetWidth || 0)
      const maxY = window.innerHeight - (popupRef.current?.offsetHeight || 0)

      const nextPos = {
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      }

      setPosition(nextPos)
      persistPosition(nextPos)
    }

    const handlePointerUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging, dragOffset, persistPosition])

  if (!open) return null

  const isMobile = window.innerWidth < 768

  return createPortal(
    <div
      className={cn('fixed z-[110] transition-all duration-300 ease-in-out', isMobile ? 'inset-0' : '')}
      style={
        !isMobile
          ? {
              left: position.x,
              top: position.y,
              width: isMinimized ? '280px' : 'min(96vw, 1100px)',
              height: isMinimized ? 'auto' : 'min(88vh, 820px)',
            }
          : {}
      }
    >
      <div
        ref={popupRef}
        className={cn(
          'flex h-full w-full flex-col overflow-hidden glass-panel border border-[rgba(240,210,140,0.3)] shadow-2xl transition-transform',
          isDragging ? 'scale-[1.01] cursor-grabbing' : '',
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-between border-b border-[rgba(240,210,140,0.18)] bg-[rgba(10,4,2,0.85)] px-4 py-3',
            !isMobile && 'cursor-grab active:cursor-grabbing select-none',
          )}
          onPointerDown={!isMobile ? handlePointerDown : undefined}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(240,210,140,0.12)] text-[#f2d892]">
              <Wallet size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="font-display truncate text-sm tracking-widest text-[#f2d892] sm:text-base">
                CAIXA DE PAGAMENTOS
              </h3>
              {!isMinimized && (
                <p className="truncate text-[0.65rem] text-[#edd9c4]">
                  Arraste esta barra para mover · busca, filtros e ações completas
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isMobile && (
              <button
                type="button"
                onClick={() => setIsMinimized(v => !v)}
                className="rounded-md p-1.5 text-[#edd9c4] hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f5e0a8]"
                title={isMinimized ? 'Maximizar' : 'Minimizar'}
              >
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[#edd9c4] hover:bg-[rgba(255,0,0,0.1)] hover:text-red-400"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="relative min-h-0 flex-1 overflow-hidden bg-[rgba(52,34,26,0.4)]">
            <div className="absolute inset-0 overflow-auto p-3 sm:p-4">
              <Caixa embedded />
            </div>
          </div>
        )}

        {!isMobile && !isMinimized && (
          <div className="flex h-4 shrink-0 items-center justify-center border-t border-[rgba(240,210,140,0.08)] bg-[rgba(10,4,2,0.6)]">
            <GripHorizontal size={12} className="text-[rgba(240,210,140,0.3)]" />
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
