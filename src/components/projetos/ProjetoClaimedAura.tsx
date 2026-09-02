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
  float ring = smoothstep(0.1, 0.03, abs(r - 0.72));
  float hub = smoothstep(0.22, 0.0, r);
  float ticks = step(0.92, abs(sin(ang * 8.0))) * smoothstep(0.16, 0.05, abs(r - 0.72));
  float lamp = 0.55 + 0.45 * sin(uTime * 3.2);
  float sweep = 0.5 + 0.5 * sin(ang * 2.0 + uTime * 1.1);
  vec3 gold = vec3(0.95, 0.85, 0.57);
  vec3 cyan = vec3(0.49, 0.83, 0.99);
  vec3 color = mix(cyan, gold, sweep);
  color *= (ring + hub * 0.85 + ticks) * lamp;
  float alpha = (ring * 0.95 + hub * 0.7 + ticks * 0.5) * lamp;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}
`

export function ProjetoClaimedAura({ className }: { className?: string }) {
  const hostRef = useAtelieShaderPlane({
    fragment: FRAGMENT,
    uniforms: () => ({}),
    pauseWhenHidden: true,
    // Um canvas por card “em desenho” estoura o limite de WebGL no celular.
    skipOnPhone: true,
  })

  return (
    <div
      ref={hostRef}
      className={cn(
        'pointer-events-none relative h-9 w-9 shrink-0 overflow-hidden rounded-full',
        'bg-[radial-gradient(circle_at_50%_45%,rgba(242,216,146,0.55),rgba(125,211,252,0.15)_55%,transparent_72%)]',
        'ring-1 ring-[#f2d892]/50',
        className,
      )}
      aria-hidden
    />
  )
}
