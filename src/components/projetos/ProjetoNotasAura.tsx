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
  float ribbonA = smoothstep(0.12, 0.02, abs(p.y - p.x * 0.18));
  float ribbonB = smoothstep(0.12, 0.02, abs(p.y + p.x * 0.22));
  float ring = smoothstep(0.1, 0.03, abs(r - 0.78));
  vec3 gold = vec3(0.95, 0.85, 0.57);
  vec3 cyan = vec3(0.49, 0.83, 0.99);
  vec3 color = gold * ribbonA + cyan * ribbonB + mix(gold, cyan, 0.5) * ring;
  float pulse = 0.75 + 0.25 * sin(uTime * 1.6);
  float alpha = (ribbonA * 0.85 + ribbonB * 0.85 + ring * 0.7) * pulse * smoothstep(1.05, 0.4, r);
  gl_FragColor = vec4(color, alpha);
}
`

export function ProjetoNotasAura({ className }: { className?: string }) {
  const hostRef = useAtelieShaderPlane({
    fragment: FRAGMENT,
    uniforms: () => ({}),
    pauseWhenHidden: true,
  })

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none h-8 w-8', className)}
      aria-hidden
    />
  )
}
