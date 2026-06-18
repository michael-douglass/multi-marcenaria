import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, CalendarDays, Maximize2, Minimize2, GripHorizontal, LayoutGrid, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgendaObras } from '@/pages/AgendaObras'
import { CalendarioObras } from '@/pages/CalendarioObras'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

interface Position {
  x: number
  y: number
}

interface AgendaPopupProps {
  open: boolean
  onClose: () => void
}

const STORAGE_KEY = 'agenda-popup-position'

export function AgendaPopup({ open, onClose }: AgendaPopupProps) {
  const { userProfile } = useApp()
  const [tab, setTab] = useState<'agenda' | 'calendario'>('agenda')
  const [position, setPosition] = useState<Position>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : { x: 100, y: 100 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [isMinimized, setIsMinimized] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<number | null>(null)

  // Load from Supabase on mount
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
        console.error('[AgendaPopup] Erro ao carregar posição:', err)
      }
    })()
  }, [userProfile?.id, open])

  const persistPosition = useCallback((pos: Position) => {
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
          atualizado_em: new Date().toISOString()
        })
        .then(({ error }) => {
          if (error) console.error('[AgendaPopup] Erro ao salvar posição:', error)
        })
    }, 1000)
  }, [userProfile?.id])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isMinimized) return
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
      
      // Boundary checks
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
      className={cn(
        "fixed z-[100] transition-all duration-300 ease-in-out",
        isMobile ? "inset-0" : ""
      )}
      style={!isMobile ? {
        left: position.x,
        top: position.y,
        width: isMinimized ? '300px' : 'min(90vw, 1000px)',
        height: isMinimized ? 'auto' : 'min(85vh, 800px)',
      } : {}}
    >
      <div 
        ref={popupRef}
        className={cn(
          "flex h-full w-full flex-col overflow-hidden glass-panel border border-[rgba(240,210,140,0.3)] shadow-2xl transition-transform",
          isDragging ? "scale-[1.01] cursor-grabbing" : ""
        )}
      >
        {/* Header/Draggable area */}
        <div 
          className={cn(
            "flex shrink-0 items-center justify-between border-b border-[rgba(240,210,140,0.18)] bg-[rgba(10,4,2,0.85)] px-4 py-3",
            !isMobile && "cursor-grab"
          )}
          onPointerDown={!isMobile ? handlePointerDown : undefined}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(240,210,140,0.12)] text-[#f2d892]">
              <CalendarDays size={18} />
            </div>
            <div>
              <h3 className="font-display text-sm tracking-widest text-[#f2d892] sm:text-base">AGENDA E CALENDÁRIO</h3>
              {!isMinimized && (
                <div className="mt-1 flex gap-4">
                  <button 
                    onClick={() => setTab('agenda')}
                    className={cn(
                      "flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider transition-colors",
                      tab === 'agenda' ? "text-[#f5e0a8]" : "text-[#edd9c4] hover:text-[#f5e0a8]"
                    )}
                  >
                    <LayoutGrid size={12} />
                    Kanban
                  </button>
                  <button 
                    onClick={() => setTab('calendario')}
                    className={cn(
                      "flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider transition-colors",
                      tab === 'calendario' ? "text-[#f5e0a8]" : "text-[#edd9c4] hover:text-[#f5e0a8]"
                    )}
                  >
                    <Calendar size={12} />
                    Calendário
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isMobile && (
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="rounded-md p-1.5 text-[#edd9c4] hover:bg-[rgba(240,210,140,0.1)] hover:text-[#f5e0a8]"
                title={isMinimized ? "Maximizar" : "Minimizar"}
              >
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-[#edd9c4] hover:bg-[rgba(255,0,0,0.1)] hover:text-red-400"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="relative flex-1 overflow-hidden bg-[rgba(52,34,26,0.4)]">
             <div className="absolute inset-0 overflow-auto p-2 sm:p-4">
               {tab === 'agenda' ? <AgendaObras /> : <CalendarioObras />}
             </div>
          </div>
        )}
        
        {/* Resize handle (optional, but let's keep it simple with fixed size or maximized) */}
        {!isMobile && !isMinimized && (
          <div className="flex h-4 items-center justify-center border-t border-[rgba(240,210,140,0.08)] bg-[rgba(10,4,2,0.6)]">
            <GripHorizontal size={12} className="text-[rgba(240,210,140,0.3)]" />
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
