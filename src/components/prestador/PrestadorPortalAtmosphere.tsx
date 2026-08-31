import { GarboPontuaPointsScene } from '@/components/marketing/apresentacao-empresa/GarboPontuaPointsScene';

interface PrestadorPortalAtmosphereProps {
  /** Pausa o loop 3D quando a seção do portal não está visível. */
  active?: boolean;
}

/**
 * Atmosfera do portal: ripado de madeira + pontos dourados orbitando a logo
 * (Three.js TextureLoader). Não captura clique — o menu e o texto passam por cima.
 */
export function PrestadorPortalAtmosphere({ active = true }: PrestadorPortalAtmosphereProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden" aria-hidden>
      <div
        className="absolute inset-y-0 right-0 hidden w-[46%] md:block"
        style={{
          background: `
            repeating-linear-gradient(
              90deg,
              rgba(196, 168, 130, 0.07) 0px,
              rgba(196, 168, 130, 0.07) 1px,
              transparent 1px,
              transparent 22px
            )
          `,
          maskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.95) 100%)',
        }}
      />
      <GarboPontuaPointsScene
        active={active}
        className="absolute inset-y-0 right-0 h-full w-full opacity-50 sm:w-[58%] sm:opacity-80"
      />
    </div>
  );
}
