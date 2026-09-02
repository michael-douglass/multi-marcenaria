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
}

export function ProjetosAbertosCard({ fila, visitas, desenho, feitos }: ProjetosAbertosCardProps) {
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
        'relative min-w-0 overflow-hidden rounded-[1.7rem] p-[3px] md:max-w-[20.5rem]',
        'bg-gradient-to-br from-sky-400/70 via-[#120c09] to-gold/70',
        'transition-transform duration-700 hover:-translate-y-0.5',
      )}
    >
      <div className="relative flex items-center gap-3 rounded-[1.55rem] bg-[#fffcf8] px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.28em] text-[#0e7490]">ABERTOS</p>
          <p
            className="font-display text-[2.35rem] leading-none text-gold sm:text-[2.75rem]"
            style={{ textShadow: '0 0 18px rgba(242,216,146,0.45)' }}
          >
            {abertos}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] sm:mt-2">
            <span className="text-amber-800">Fila {fila}</span>
            <span className="text-teal-800">Visitas {visitas}</span>
            <span className="text-sky-800">Desenho {desenho}</span>
          </div>
        </div>
        <div ref={hostRef} className="h-16 w-16 shrink-0 sm:h-24 sm:w-24" aria-hidden />
      </div>
    </article>
  )
}
