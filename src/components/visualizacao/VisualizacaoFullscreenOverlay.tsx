import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { VIZ_OBRAS_DIA_SHOW_MS } from '@/hooks/useVisualizacaoObrasDoDiaAutoFullscreen'
import { VISUALIZACAO_PAINEIS, type VisualizacaoPainelId } from '@/lib/visualizacao-paineis'

interface VisualizacaoFullscreenOverlayProps {
  open: boolean
  panelId: VisualizacaoPainelId | null
  subtitle?: string
  onClose?: () => void
  showProgress?: boolean
  autoCloseMs?: number
  children: React.ReactNode
}

export function VisualizacaoFullscreenOverlay({
  open,
  panelId,
  subtitle,
  onClose,
  showProgress = false,
  autoCloseMs,
  children,
}: VisualizacaoFullscreenOverlayProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !panelId) return null

  const meta = VISUALIZACAO_PAINEIS.find(p => p.id === panelId)
  const title = meta?.label ?? 'Painel'

  return createPortal(
    <div className="viz-fs-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="viz-fs-overlay__backdrop" aria-hidden />
      <div className="viz-fs-overlay__panel">
        <header className="viz-fs-overlay__header">
          <div className="min-w-0">
            <p className="viz-fs-overlay__eyebrow">Visualização · tela cheia</p>
            <h2 className="viz-fs-overlay__title">{title}</h2>
            {subtitle ? <p className="viz-fs-overlay__subtitle">{subtitle}</p> : null}
          </div>
          <div className="viz-fs-overlay__header-actions">
            {onClose ? (
              <button
                type="button"
                className="viz-fs-overlay__close"
                onClick={onClose}
                aria-label="Fechar tela cheia"
              >
                <X size={22} />
              </button>
            ) : null}
          </div>
        </header>

        {showProgress ? (
          <div
            className="viz-fs-overlay__progress"
            style={{
              animationDuration: `${autoCloseMs ?? VIZ_OBRAS_DIA_SHOW_MS}ms`,
            }}
            aria-hidden
          />
        ) : null}

        <div
          className={
            panelId === 'obras_do_dia'
              ? 'viz-fs-overlay__body viz-fs-overlay__body--obras-dia'
              : 'viz-fs-overlay__body'
          }
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
