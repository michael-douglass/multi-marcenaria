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

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.05;
  float ang = atan(p.y, p.x);
  float fiber = fbm(p * 7.0 + vec2(uTime * 0.03, -uTime * 0.02));
  float ringA = smoothstep(0.09, 0.0, abs(r - 0.72));
  float ringB = smoothstep(0.07, 0.0, abs(r - 0.46));
  float rays = pow(max(0.0, sin(ang * 8.0 + fiber)), 6.0) * smoothstep(0.92, 0.18, r);
  float rim = pow(clamp(1.0 - abs(r - 0.62) * 2.4, 0.0, 1.0), 2.2);
  float pulse = 0.58 + 0.42 * sin(uTime * 1.15);
  vec3 leather = vec3(0.22, 0.10, 0.05);
  vec3 gold = vec3(0.94, 0.82, 0.45);
  vec3 amber = vec3(0.96, 0.62, 0.16);
  vec3 color = mix(leather, mix(amber, gold, fiber), 0.55 + uFill * 0.45);
  color = mix(color, gold, rim * 0.55);
  float alpha = (0.16 + ringA * 0.42 + ringB * 0.32 + rays * 0.18 + rim * 0.22 + uFill * 0.24) * pulse;
  alpha *= smoothstep(1.05, 0.52, r);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.78));
}
`

export function EventoPdfExportAura({ fill, className }: { fill: number; className?: string }) {
  const fillRef = useRef(fill)
  fillRef.current = fill
  const hostRef = useAtelieShaderPlane({
    fragment: FRAGMENT,
    uniforms: () => ({ uFill: { value: fillRef.current } }),
    pixelRatioMax: 1,
    pauseWhenHidden: true,
  })
  return <div ref={hostRef} className={cn('pointer-events-none', className)} aria-hidden />
}
