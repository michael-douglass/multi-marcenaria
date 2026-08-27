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
uniform float uActive;
uniform float uAtrasoHeat;

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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.07;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 mahogany = vec3(0.165, 0.094, 0.071);
  vec3 deep = vec3(0.055, 0.027, 0.016);
  vec3 gold = vec3(0.949, 0.847, 0.573);
  vec3 ember = vec3(0.980, 0.420, 0.160);
  vec3 rust = vec3(0.720, 0.160, 0.110);
  vec3 steel = vec3(0.420, 0.620, 0.780);

  float grain = fbm(uv * vec2(14.0, 32.0) + vec2(uTime * 0.028, uTime * 0.04));
  float vein = sin((uv.y * 10.0 + grain * 2.6 + uTime * 0.05) * 3.14159) * 0.5 + 0.5;
  float ribbon = sin((uv.x * 6.2 - uv.y * 2.4 + uTime * 0.09) * 3.14159) * 0.5 + 0.5;

  float zoneMes = 1.0 - smoothstep(0.28, 0.42, uv.x);
  float zoneNext = smoothstep(0.58, 0.72, uv.x);
  float zoneLate = 1.0 - zoneMes - zoneNext;

  float pulse = 0.58 + 0.42 * sin(uTime * 0.62);
  float activeMes = (1.0 - step(1.5, uActive)) * step(0.5, uActive);
  float activeLate = (1.0 - step(2.5, uActive)) * step(1.5, uActive);
  float activeNext = step(2.5, uActive);

  vec3 base = mix(deep, mahogany, uv.y * 0.7 + 0.12);
  vec3 wood = base + gold * (0.035 + vein * 0.055 + grain * 0.03);
  wood += gold * zoneMes * (0.045 + activeMes * 0.12 * pulse);
  wood += mix(ember, rust, 0.45) * zoneLate * (0.04 + uAtrasoHeat * 0.08 + activeLate * 0.16 * pulse);
  wood += steel * zoneNext * (0.05 + activeNext * 0.12 * pulse);
  wood += ember * ribbon * 0.03 * pulse;

  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float rim = pow(1.0 - clamp(edge * 3.1, 0.0, 1.0), 2.5);
  vec3 color = wood + gold * rim * (0.34 + pulse * 0.1);

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

interface AgendaEntregaShaderBackdropProps {
  /** 0 = nenhum, 1 = este mês, 2 = atraso, 3 = próximo mês */
  active: number
  atrasoHeat: number
}

/** Placa de mogno viva atrás dos cards de entrega — um único contexto WebGL. */
export function AgendaEntregaShaderBackdrop({
  active,
  atrasoHeat,
}: AgendaEntregaShaderBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef(active)
  const heatRef = useRef(atrasoHeat)
  const [fallback, setFallback] = useState(false)

  activeRef.current = active
  heatRef.current = atrasoHeat

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (prefersReducedMotion()) {
      setFallback(true)
      return
    }

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'low-power',
    })
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
    const uActive = gl.getUniformLocation(program, 'uActive')
    const uAtrasoHeat = gl.getUniformLocation(program, 'uAtrasoHeat')

    let raf = 0
    let running = true
    let visible = true
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
      if (visible) {
        gl.useProgram(program)
        gl.uniform1f(uTime, (now - start) / 1000)
        gl.uniform2f(uResolution, canvas.width, canvas.height)
        gl.uniform1f(uActive, activeRef.current)
        gl.uniform1f(uAtrasoHeat, heatRef.current)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      raf = requestAnimationFrame(tick)
    }

    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    const io = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting)
    })
    io.observe(canvas)

    raf = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
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
          background:
            'linear-gradient(105deg, rgba(242,216,146,0.18) 0%, rgba(18,8,5,0.2) 32%, rgba(239,68,68,0.16) 50%, rgba(18,8,5,0.2) 68%, rgba(125,211,252,0.16) 100%), linear-gradient(180deg, #160904 0%, #27150c 100%)',
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
