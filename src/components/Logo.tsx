interface LogoProps {
  full?: boolean
}

export function Logo({ full = true }: LogoProps) {
  if (full) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: '7px',
          padding: '3px 10px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 6px rgba(0,0,0,.18)',
        }}
      >
        <img
          src="/garbo-logo.png"
          alt="GARBO Movelaria"
          style={{ height: 36, width: 'auto', display: 'block' }}
          draggable={false}
        />
      </div>
    )
  }

  // Icon-only: crops to the diamond-G mark (top half of the square image)
  return (
    <div
      style={{
        width: 34,
        height: 34,
        overflow: 'hidden',
        background: '#fff',
        borderRadius: '7px',
        flexShrink: 0,
        position: 'relative',
        boxShadow: '0 1px 4px rgba(0,0,0,.18)',
      }}
    >
      <img
        src="/garbo-logo.png"
        alt="GARBO"
        style={{
          position: 'absolute',
          width: 68,
          height: 68,
          top: 0,
          left: -17,
        }}
        draggable={false}
      />
    </div>
  )
}
