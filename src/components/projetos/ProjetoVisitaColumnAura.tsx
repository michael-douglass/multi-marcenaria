import { MapPin } from 'lucide-react'
import { useAtelieShaderPlane } from '@/hooks/useAtelieShaderPlane'
import { cn } from '@/lib/utils'

const FRAGMENT = `
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float ang = atan(p.y, p.x) - uTime * 0.18;
  float rays = abs(sin(ang * 2.0));
  float ring = smoothstep(0.12, 0.04, abs(r - 0.62));
  float ticks = step(0.9, abs(sin(ang * 6.0))) * smoothstep(0.18, 0.06, abs(r - 0.62));
  vec3 teal = vec3(0.37, 0.92, 0.83);
  vec3 gold = vec3(0.95, 0.85, 0.57);
  vec3 color = mix(teal, gold, rays * 0.55);
  color *= (0.25 + rays * 0.45 + ring + ticks);
  float alpha = (0.2 + rays * 0.25 + ring * 0.7 + ticks * 0.4) * smoothstep(1.05, 0.35, r);
  gl_FragColor = vec4(color, alpha);
}
`

export function ProjetoVisitaColumnAura({ className }: { className?: string }) {
  const hostRef = useAtelieShaderPlane({
    fragment: FRAGMENT,
    uniforms: () => ({}),
    pauseWhenHidden: true,
  })

  return (
    <div className={cn('relative h-9 w-9 shrink-0', className)}>
      <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden />
      <MapPin className="absolute inset-0 m-auto h-3.5 w-3.5 text-teal-200" aria-hidden />
    </div>
  )
}
