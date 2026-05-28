interface LogoProps {
  full?: boolean
}

import garboLogo from '../../imagens/identidade vizual.pdf (1).png'

export function Logo({ full = true }: LogoProps) {
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
          boxShadow: '0 6px 18px rgba(0,0,0,.25)',
        }}
      >
        <img
          src={garboLogo}
          alt="GARBO Movelaria"
          style={{ height: 44, width: 'auto', display: 'block' }}
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
        boxShadow: '0 4px 14px rgba(0,0,0,.22)',
      }}
    >
      <img
        src={garboLogo}
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
