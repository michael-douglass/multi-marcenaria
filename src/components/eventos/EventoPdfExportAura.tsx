import { useRef } from 'react'
import { useAtelieShaderPlane } from '@/hooks/useAtelieShaderPlane'
import { cn } from '@/lib/utils'

const FRAGMENT = `
uniform float uTime;
uniform float uFill;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.05;
  float ang = atan(p.y, p.x);
  float wax = hash(p * 9.0 + uTime * 0.04);
  float ringA = smoothstep(0.08, 0.0, abs(r - 0.72));
  float ringB = smoothstep(0.07, 0.0, abs(r - 0.48));
  float rays = pow(max(0.0, sin(ang * 8.0)), 6.0) * smoothstep(0.9, 0.2, r);
  float pulse = 0.55 + 0.45 * sin(uTime * 1.4);
  vec3 gold = vec3(0.94, 0.82, 0.45);
  vec3 amber = vec3(0.96, 0.62, 0.16);
  vec3 color = mix(amber, gold, wax * 0.5 + uFill * 0.35);
  float alpha = (0.18 + ringA * 0.45 + ringB * 0.35 + rays * 0.2 + uFill * 0.22) * pulse;
  alpha *= smoothstep(1.05, 0.55, r);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.72));
}
`

export function EventoPdfExportAura({ fill, className }: { fill: number; className?: string }) {
  const fillRef = useRef(fill)
  fillRef.current = fill
  const hostRef = useAtelieShaderPlane({
    fragment: FRAGMENT,
    uniforms: () => ({ uFill: { value: fillRef.current } }),
    pixelRatioMax: 1,
  })
  return <div ref={hostRef} className={cn('pointer-events-none', className)} aria-hidden />
}
