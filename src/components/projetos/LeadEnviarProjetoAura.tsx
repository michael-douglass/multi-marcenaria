import * as THREE from 'three'
import { useAtelieShaderPlane } from '@/hooks/useAtelieShaderPlane'
import { cn } from '@/lib/utils'

const FRAGMENT = `
uniform float uTime;
uniform vec2 uResolution;
uniform float uReady;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.38;
  float grain = hash(uv * vec2(92.0, 48.0) + t) * 0.07;
  float wood = noise(uv * vec2(14.0, 3.4) + vec2(t * 0.08, 0.0));
  float lamp = exp(-length((uv - vec2(0.78, 0.18)) * vec2(1.6, 2.4)) * 2.2);
  float sweep = smoothstep(0.12, 0.0, abs(uv.y - 0.22 - 0.04 * sin(uv.x * 9.0 + t * 1.4)));
  float dust = smoothstep(0.72, 0.96, hash(uv * 40.0 + vec2(t * 1.8, 0.0)));
  float send = mix(0.35, 1.0, clamp(uReady, 0.0, 1.0));

  vec3 ink = vec3(0.09, 0.045, 0.025);
  vec3 gold = vec3(0.95, 0.85, 0.57);
  vec3 cream = vec3(1.0, 0.96, 0.92);
  vec3 color = mix(ink, gold, wood * 0.22 + lamp * 0.34 * send);
  color = mix(color, cream, sweep * 0.18 * send);
  color += gold * (grain * 0.45 + dust * 0.12 * send);

  float alpha = 0.16 + lamp * 0.22 * send + sweep * 0.12 + grain * 0.08;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.42));
}
`

interface LeadEnviarProjetoAuraProps {
  ready?: boolean
  className?: string
}

/** Véu dourado do recado ao ateliê — poeira e lampejo, sem bloquear clique. */
export function LeadEnviarProjetoAura({ ready = false, className }: LeadEnviarProjetoAuraProps) {
  const hostRef = useAtelieShaderPlane({
    fragment: FRAGMENT,
    uniforms: () => ({
      uReady: { value: ready ? 1 : 0.28 } as THREE.IUniform,
    }),
    pauseWhenHidden: true,
  })

  return (
    <div
      ref={hostRef}
      className={cn('pointer-events-none absolute inset-0', className)}
      aria-hidden
    />
  )
}
