import { useAtelieShaderPlane } from '@/hooks/useAtelieShaderPlane'
import { cn } from '@/lib/utils'

/** Couro de ateliê: fibra, vinco dourado e tinta viva — só no fundo, atrás da folha. */
const FRAGMENT = `
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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

float fbm(vec2 st) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(st);
    st *= 2.07;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv - 0.5;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  p.x *= aspect;

  float grain = fbm(uv * vec2(14.0, 18.0) + uTime * 0.015);
  float vein = fbm(uv * vec2(3.2, 7.5) + 2.4);
  float ink = hash(p * 6.1 + 1.7);

  float edge = 1.0 - smoothstep(0.18, 0.72, length(p));
  float rim = pow(1.0 - edge, 2.4);
  float pulse = 0.55 + 0.45 * sin(uTime * 0.85);

  vec3 mahogany = vec3(0.145, 0.078, 0.047);
  vec3 leather = vec3(0.322, 0.196, 0.118);
  vec3 gold = vec3(0.941, 0.824, 0.549);
  vec3 cream = vec3(0.957, 0.902, 0.784);

  vec3 color = mix(mahogany, leather, grain);
  color = mix(color, gold, vein * 0.22 + rim * 0.35);
  color = mix(color, cream, ink * 0.08 * edge);
  color += gold * rim * pulse * 0.18;

  float alpha = 0.42 + grain * 0.18 + rim * 0.28;
  alpha *= 0.55 + pulse * 0.12;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.78));
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
