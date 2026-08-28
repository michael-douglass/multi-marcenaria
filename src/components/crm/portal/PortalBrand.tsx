import { garboBrandLogo } from '@/lib/garbo-brand'

interface PortalBrandProps {
  onGoHome: () => void
}

export function PortalBrand({ onGoHome }: PortalBrandProps) {
  return (
    <button
      type="button"
      onClick={onGoHome}
      className="flex flex-col items-start gap-2 text-left"
      aria-label="Ir para a página principal do portal"
    >
      <span
        className="flex items-center justify-center rounded-lg border p-1.5"
        style={{
          background: 'linear-gradient(145deg, rgba(196,165,116,0.12) 0%, rgba(8,8,8,0.88) 100%)',
          borderColor: 'rgba(196, 165, 116, 0.35)',
        }}
      >
        <img src={garboBrandLogo} alt="" className="h-11 w-11 object-contain sm:h-[52px] sm:w-[52px]" draggable={false} />
      </span>
      <span
        className="font-display text-[0.68rem] uppercase leading-tight"
        style={{ letterSpacing: '0.2em', color: 'rgba(196, 165, 116, 0.95)' }}
      >
        Garbo movelaria
      </span>
    </button>
  )
}
