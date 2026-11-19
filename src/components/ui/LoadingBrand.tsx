import { empresaDocumento } from '@/lib/empresa-identidade'
import { cn } from '@/lib/utils'

export interface LoadingBrandProps {
  /** Texto abaixo da logo. */
  message?: string
  /** inline = bloco na página; page = ocupa a área útil centralizada; fullscreen = tela inteira; overlay = cobre o conteúdo atual. */
  variant?: 'inline' | 'page' | 'fullscreen' | 'overlay'
  className?: string
}

const LOGO_HEIGHT: Record<NonNullable<LoadingBrandProps['variant']>, number> = {
  inline: 104,
  page: 176,
  fullscreen: 152,
  overlay: 132,
}

export function LoadingBrand({
  message = 'Carregando...',
  variant = 'inline',
  className,
}: LoadingBrandProps) {
  const logoHeight = LOGO_HEIGHT[variant]
  const haloSize = logoHeight + 56

  return (
    <div
      className={cn(
        'app-loading-brand',
        variant === 'fullscreen' && 'app-loading-brand--fullscreen',
        variant === 'overlay' && 'app-loading-brand--overlay',
        variant === 'page' && 'app-loading-brand--page',
        variant === 'inline' && 'app-loading-brand--inline',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message || 'Carregando...'}
    >
      <div
        className="app-loading-brand__stage"
        style={{ width: haloSize, height: haloSize }}
      >
        <div
          className="app-loading-brand__halo"
          style={{ width: haloSize, height: haloSize }}
          aria-hidden
        />
        <img
          src={empresaDocumento().logoUrl}
          alt=""
          className="app-loading-brand__logo"
          style={{ height: logoHeight, width: 'auto' }}
          draggable={false}
        />
      </div>

      {message ? (
        <p className="app-loading-brand__message">{message}</p>
      ) : null}
    </div>
  )
}
