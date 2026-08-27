import { useEffect, useRef, useState } from 'react'

const VERT = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uTone;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 deep = vec3(0.055, 0.027, 0.016);
  vec3 mahogany = vec3(0.165, 0.094, 0.071);
  vec3 gold = vec3(0.949, 0.847, 0.573);
  vec3 ember = vec3(0.980, 0.520, 0.180);
  vec3 emerald = vec3(0.204, 0.831, 0.533);

  float grain = noise(uv * vec2(18.0, 36.0) + vec2(uTime * 0.04, uTime * 0.05));
  float vein = sin((uv.y * 9.0 + grain * 2.2 + uTime * 0.07) * 3.14159) * 0.5 + 0.5;
  float pulse = 0.55 + 0.45 * sin(uTime * 0.8);
  float accentMix = clamp(uTone, 0.0, 1.0);
  vec3 accent = mix(gold, emerald, accentMix);

  vec3 base = mix(deep, mahogany, uv.y * 0.7 + 0.15);
  vec3 wood = base + accent * (0.05 + vein * 0.07 + grain * 0.03);
  wood += ember * (1.0 - accentMix) * 0.04 * pulse;
  wood += emerald * accentMix * 0.05 * pulse;

  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float rim = pow(1.0 - clamp(edge * 3.4, 0.0, 1.0), 2.4);
  vec3 color = wood + accent * rim * (0.42 + pulse * 0.12);

  gl_FragColor = vec4(color, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface ObraEquipeConfirmBackdropProps {
  /** 0 = iniciar (ouro), 1 = concluir (esmeralda) */
  tone: number
}

/** Fundo vivo do aviso: a ação do admin vale para toda a equipe. */
export function ObraEquipeConfirmBackdrop({ tone }: ObraEquipeConfirmBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const toneRef = useRef(tone)
  const [fallback, setFallback] = useState(false)
  toneRef.current = tone

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (prefersReducedMotion()) {
      setFallback(true)
      return
    }

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' })
    if (!gl) {
      setFallback(true)
      return
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) {
      setFallback(true)
      return
    }

    const program = gl.createProgram()
    if (!program) {
      setFallback(true)
      return
    }
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setFallback(true)
      return
    }

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(program, 'uTime')
    const uResolution = gl.getUniformLocation(program, 'uResolution')
    const uTone = gl.getUniformLocation(program, 'uTone')

    let raf = 0
    let running = true
    const start = performance.now()

    const resize = () => {
      const parent = canvas.parentElement
      const w = Math.max(1, parent?.clientWidth ?? canvas.clientWidth)
      const h = Math.max(1, parent?.clientHeight ?? canvas.clientHeight)
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const tick = (now: number) => {
      if (!running) return
      gl.useProgram(program)
      gl.uniform1f(uTime, (now - start) / 1000)
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uTone, toneRef.current)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      raf = requestAnimationFrame(tick)
    }

    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    raf = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buffer)
    }
  }, [])

  if (fallback) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: tone > 0.5
            ? 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(18,8,5,0.85))'
            : 'linear-gradient(135deg, rgba(242,216,146,0.22), rgba(18,8,5,0.85))',
        }}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-80"
    />
  )
}
