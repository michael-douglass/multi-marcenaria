import { ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
  /** Conteúdo no topo do cabeçalho, acima do título */
  headerTop?: ReactNode
  /** Conteúdo extra no cabeçalho (ex.: resumo financeiro do fornecedor) */
  headerExtra?: ReactNode
  /** Ações à esquerda do botão Fechar (ex.: Exportar PDF) */
  headerActions?: ReactNode
  /** Se false, clique no fundo escuro não fecha (útil em formulários longos) */
  closeOnBackdrop?: boolean
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  headerTop,
  headerExtra,
  headerActions,
  closeOnBackdrop = true,
}: ModalProps) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        target.blur()
        return
      }
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open) return null

  const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) return
    if (e.target === e.currentTarget) onCloseRef.current()
  }

  return createPortal(
    <div
      className="modal-overlay"
      onPointerDown={handleBackdropPointerDown}
      aria-hidden={false}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'glass-panel modal-panel flex w-full min-w-0 flex-col',
          wide
            ? 'max-w-[min(780px,calc(100vw-1.5rem))]'
            : 'max-w-[min(520px,calc(100vw-1.5rem))]',
        )}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-panel-header shrink-0 border-b border-[rgba(240,210,140,0.18)] px-4 py-3 sm:px-5 sm:py-4">
          {headerTop ? <div className="mb-3">{headerTop}</div> : null}
          <div className="flex items-center justify-between gap-3">
            <span
              id="modal-title"
              className="min-w-0 flex-1 truncate font-display text-lg tracking-widest text-[#f2d892] sm:text-xl"
            >
              {title}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <button
                type="button"
                onClick={() => onCloseRef.current()}
                className="btn btn-outline btn-sm !px-2 !py-1"
                aria-label="Fechar"
              >
                <X size={15} />
              </button>
            </div>
          </div>
          {headerExtra ? <div className="mt-3">{headerExtra}</div> : null}
        </div>

        <div className="modal-panel-body min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
