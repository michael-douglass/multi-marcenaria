import { useAtelieShaderPlane } from '@/hooks/useAtelieShaderPlane'
import { cn } from '@/lib/utils'

const FRAGMENT = `
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 p = vUv;
  float t = uTime * 0.035;
  float gridX = abs(sin(p.x * 36.0));
  float gridY = abs(sin(p.y * 22.0));
  float grid = smoothstep(0.92, 1.0, max(gridX, gridY));
  float n = hash(p * 18.0 + t);
  float wash = exp(-length((p - vec2(0.5, 0.42)) * vec2(1.4, 1.8)) * 2.2);
  float ticks = step(0.97, fract(p.x * 28.0)) * smoothstep(0.06, 0.0, p.y);
  float vignette = smoothstep(0.0, 0.18, p.x) * smoothstep(1.0, 0.82, p.x)
    * smoothstep(0.0, 0.14, p.y) * smoothstep(1.0, 0.78, p.y);

  vec3 ink = vec3(0.07, 0.05, 0.035);
  vec3 cyan = vec3(0.49, 0.83, 0.99);
  vec3 gold = vec3(0.95, 0.85, 0.57);
  vec3 color = mix(ink, cyan, grid * 0.55);
  color = mix(color, gold, wash * 0.42);
  color += gold * ticks * 0.35;
  color += cyan * n * 0.05;
  float alpha = (0.22 + grid * 0.12 + wash * 0.18 + n * 0.04) * vignette;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.4));
}
`

export function ProjetosBoardAura({ className }: { className?: string }) {
  const hostRef = useAtelieShaderPlane({
    fragment: FRAGMENT,
    uniforms: () => ({}),
    pixelRatioMax: 1.5,
  })

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0 opacity-90', className)}
      aria-hidden
    />
  )
}
