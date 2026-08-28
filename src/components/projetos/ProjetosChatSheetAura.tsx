import * as THREE from 'three'
import { useAtelieShaderPlane } from '@/hooks/useAtelieShaderPlane'
import { cn } from '@/lib/utils'

const FRAGMENT = `
uniform float uTime;
uniform vec2 uResolution;
uniform float uPulse;
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
  float t = uTime * 0.42;
  float n = noise(uv * vec2(9.0, 3.2) + vec2(t * 0.28, 0.0));
  float wave = 0.5 + 0.5 * sin(uv.x * 14.0 + t * 1.6 + n);
  float band = smoothstep(0.2, 0.0, abs(uv.y - 0.2 - wave * 0.045));
  float wash = smoothstep(0.7, 0.0, uv.y) * 0.18;
  float grain = hash(uv * 88.0 + t) * 0.05;
  vec3 gold = vec3(0.95, 0.85, 0.57);
  vec3 cyan = vec3(0.49, 0.83, 0.99);
  vec3 color = mix(gold, cyan, 0.28 + 0.22 * uv.x);
  float alpha = (band * 0.28 + wash + grain) * uPulse;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.38));
}
`

interface ProjetosChatSheetAuraProps {
  pulse?: number
  className?: string
}

export function ProjetosChatSheetAura({ pulse = 1, className }: ProjetosChatSheetAuraProps) {
  const hostRef = useAtelieShaderPlane({
    fragment: FRAGMENT,
    uniforms: () => ({
      uPulse: { value: pulse } as THREE.IUniform,
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
