import { useAtelieShaderPlane } from '@/hooks/useAtelieShaderPlane'
import { cn } from '@/lib/utils'

const FRAGMENT = `
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float ang = atan(p.y, p.x);

  float ring = smoothstep(0.14, 0.04, abs(r - 0.72));
  float pulse = 0.55 + 0.45 * sin(uTime * 1.8 + ang * 2.0);
  float soft = smoothstep(1.05, 0.35, r);

  vec3 gold = vec3(0.95, 0.85, 0.57);
  vec3 cyan = vec3(0.49, 0.83, 0.99);
  vec3 color = mix(gold, cyan, 0.35 + 0.35 * sin(uTime * 0.9));

  float alpha = (ring * 0.9 + soft * 0.18) * pulse * soft;
  gl_FragColor = vec4(color, alpha * 0.85);
}
`

/** Aura discreta (1 canvas) só no ícone flutuante do chat do ateliê. */
export function FloatingProjetoChatAura({ className }: { className?: string }) {
  const hostRef = useAtelieShaderPlane({
    fragment: FRAGMENT,
    uniforms: () => ({}),
    pauseWhenHidden: true,
    pixelRatioMax: 1.5,
  })

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0', className)}
      aria-hidden
    />
  )
}
