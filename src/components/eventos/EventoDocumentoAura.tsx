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
  vec2 p = vUv - 0.5;
  float fiber = hash(vUv * 18.0);
  float ink = hash(p * 4.2 + 1.7);
  float r = length(p) * 2.0;
  float ring = smoothstep(0.92, 0.72, r) * smoothstep(0.18, 0.42, r);
  float pulse = 0.5 + 0.5 * sin(uTime * 1.6);
  vec3 cream = vec3(0.957, 0.902, 0.784);
  vec3 gold = vec3(0.941, 0.824, 0.549);
  vec3 inkc = vec3(0.227, 0.141, 0.094);
  vec3 color = mix(cream, gold, fiber * 0.55 + pulse * 0.15);
  color = mix(color, inkc, ink * 0.22 * ring);
  float alpha = (0.22 + ring * 0.28 + fiber * 0.08) * pulse;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.5));
}
`

export function EventoDocumentoAura({ className }: { className?: string }) {
  const hostRef = useAtelieShaderPlane({
    fragment: FRAGMENT,
    uniforms: () => ({}),
    pixelRatioMax: 1,
    pauseWhenHidden: true,
  })
  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none', className)}
      aria-hidden
    />
  )
}
