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

void main() {
  vec2 p = vUv;
  float t = uTime;
  float waveG = 0.5 + 0.28 * sin(p.x * 14.0 + t);
  float waveC = 0.5 + 0.24 * sin(p.x * 12.0 - t);
  float lineG = smoothstep(0.045, 0.008, abs(p.y - waveG));
  float lineC = smoothstep(0.045, 0.008, abs(p.y - waveC));
  float fade = smoothstep(0.0, 0.08, p.x) * smoothstep(1.0, 0.92, p.x);
  float grain = hash(p * 40.0 + t) * 0.12;
  vec3 gold = vec3(0.95, 0.85, 0.57);
  vec3 cyan = vec3(0.49, 0.83, 0.99);
  vec3 color = gold * lineG + cyan * lineC;
  float alpha = (lineG * 0.9 + lineC * 0.9 + grain) * fade * uPulse;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}
`

interface ProjetosChatWaveformProps {
  mode: 'idle' | 'active' | 'urgent'
  className?: string
}

export function ProjetosChatWaveform({ mode, className }: ProjetosChatWaveformProps) {
  const pulse = mode === 'urgent' ? 1.25 : mode === 'active' ? 1 : 0.35
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
      className={cn('pointer-events-none h-7 w-full', className)}
      aria-hidden
    />
  )
}
