import { garboBrandLogo } from '@/lib/garbo-brand'

interface LogoProps {
  full?: boolean
  /** Sombra atrás da marca. Desligue no menu para não cobrir o desenho. */
  halo?: boolean
}

export function Logo({ full = true, halo = true }: LogoProps) {
  if (full) {
    return (
      <div
        style={{
          background: 'transparent',
          borderRadius: '10px',
          padding: '4px 12px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: halo ? '0 6px 18px rgba(0,0,0,.25)' : 'none',
        }}
      >
        <img
          src={garboBrandLogo}
          alt="GARBO Movelaria"
          style={{
            height: 44,
            width: 'auto',
            display: 'block',
            filter: halo ? undefined : 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
          }}
          draggable={false}
        />
      </div>
    )
  }

  // Icon-only: keeps the whole logo visible inside the square
  return (
    <div
      style={{
        width: 40,
        height: 40,
        overflow: 'hidden',
        background: 'transparent',
        borderRadius: '10px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: halo ? '0 4px 14px rgba(0,0,0,.22)' : 'none',
      }}
    >
      <img
        src={garboBrandLogo}
        alt="GARBO"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
        draggable={false}
      />
    </div>
  )
}
