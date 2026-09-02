import * as THREE from 'three'
import { useAtelieShaderPlane } from '@/hooks/useAtelieShaderPlane'
import { cn } from '@/lib/utils'

const FRAGMENT = `
uniform float uTime;
uniform vec2 uResolution;
uniform float uProgress;
varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float ang = atan(p.y, p.x);
  float ring = abs(r - 0.74);
  float trilha = smoothstep(0.08, 0.02, ring);
  float fill = step(ang + 3.14159, mix(-3.14159, 3.14159, clamp(uProgress, 0.0, 1.0)));
  float ticks = step(0.96, abs(sin(ang * 12.0))) * smoothstep(0.12, 0.04, abs(r - 0.74));
  float pulse = 0.55 + 0.45 * sin(uTime * 1.4);
  vec3 gold = vec3(0.95, 0.85, 0.57);
  vec3 cyan = vec3(0.49, 0.83, 0.99);
  vec3 color = mix(gold, cyan, fill);
  color *= trilha * pulse;
  color += gold * ticks * 0.6;
  float alpha = trilha * 0.9 + ticks * 0.35;
  gl_FragColor = vec4(color, alpha);
}
`

interface ProjetosAbertosCardProps {
  fila: number
  visitas: number
  desenho: number
  feitos: number
  /** Faixa baixa no cabeçalho — libera espaço para as colunas do quadro. */
  compact?: boolean
}

export function ProjetosAbertosCard({
  fila,
  visitas,
  desenho,
  feitos,
  compact = false,
}: ProjetosAbertosCardProps) {
  const abertos = fila + visitas + desenho
  const total = abertos + feitos
  const progress = total > 0 ? abertos / total : 0
  const hostRef = useAtelieShaderPlane({
    fragment: FRAGMENT,
    uniforms: () => ({
      uProgress: { value: progress } as THREE.IUniform,
    }),
    pixelRatioMax: 1.5,
    pauseWhenHidden: true,
  })

  return (
    <article
      className={cn(
        'relative min-w-0 overflow-hidden p-[2px]',
        compact
          ? 'rounded-xl bg-gradient-to-br from-sky-400/60 via-[#120c09] to-gold/60'
          : 'rounded-[1.7rem] bg-gradient-to-br from-sky-400/70 via-[#120c09] to-gold/70 md:max-w-[20.5rem] transition-transform duration-700 hover:-translate-y-0.5',
      )}
    >
      <div
        className={cn(
          'relative flex items-center bg-[#fffcf8]',
          compact
            ? 'gap-2 rounded-[0.65rem] px-2.5 py-1.5'
            : 'gap-3 rounded-[1.55rem] px-3 py-2.5 sm:px-4 sm:py-3',
        )}
      >
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'font-display tracking-[0.28em] text-[#0e7490]',
              compact ? 'text-[9px]' : 'text-[10px]',
            )}
          >
            ABERTOS
          </p>
          <p
            className={cn(
              'font-display leading-none text-gold',
              compact ? 'text-[1.55rem]' : 'text-[2.35rem] sm:text-[2.75rem]',
            )}
            style={{ textShadow: '0 0 18px rgba(242,216,146,0.45)' }}
          >
            {abertos}
          </p>
          <div
            className={cn(
              'flex flex-wrap gap-x-2.5 gap-y-0.5',
              compact ? 'mt-0.5 text-[10px]' : 'mt-1.5 text-[11px] sm:mt-2',
            )}
          >
            <span className="text-amber-800">Fila {fila}</span>
            <span className="text-teal-800">Visitas {visitas}</span>
            <span className="text-sky-800">Desenho {desenho}</span>
          </div>
        </div>
        <div
          ref={hostRef}
          className={cn('shrink-0', compact ? 'h-11 w-11' : 'h-16 w-16 sm:h-24 sm:w-24')}
          aria-hidden
        />
      </div>
    </article>
  )
}
