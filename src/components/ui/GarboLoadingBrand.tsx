import { garboBrandLogo } from '@/lib/garbo-brand'
import { cn } from '@/lib/utils'

export interface GarboLoadingBrandProps {
  /** Texto abaixo da logo. */
  message?: string
  /** inline = bloco na página; page = ocupa a área útil centralizada; fullscreen = tela inteira; overlay = cobre o conteúdo atual. */
  variant?: 'inline' | 'page' | 'fullscreen' | 'overlay'
  className?: string
}

const LOGO_HEIGHT: Record<NonNullable<GarboLoadingBrandProps['variant']>, number> = {
  inline: 104,
  page: 176,
  fullscreen: 152,
  overlay: 132,
}

export function GarboLoadingBrand({
  message = 'Carregando...',
  variant = 'inline',
  className,
}: GarboLoadingBrandProps) {
  const logoHeight = LOGO_HEIGHT[variant]
  const haloSize = logoHeight + 56

  return (
    <div
      className={cn(
        'garbo-loading-brand',
        variant === 'fullscreen' && 'garbo-loading-brand--fullscreen',
        variant === 'overlay' && 'garbo-loading-brand--overlay',
        variant === 'page' && 'garbo-loading-brand--page',
        variant === 'inline' && 'garbo-loading-brand--inline',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message || 'Carregando...'}
    >
      <div
        className="garbo-loading-brand__stage"
        style={{ width: haloSize, height: haloSize }}
      >
        <div
          className="garbo-loading-brand__halo"
          style={{ width: haloSize, height: haloSize }}
          aria-hidden
        />
        <img
          src={garboBrandLogo}
          alt=""
          className="garbo-loading-brand__logo"
          style={{ height: logoHeight, width: 'auto' }}
          draggable={false}
        />
      </div>

      {message ? (
        <p className="garbo-loading-brand__message">{message}</p>
      ) : null}
    </div>
  )
}
